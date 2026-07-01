import os
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from passlib.context import CryptContext
import ucn_api 
from dotenv import load_dotenv

# --- INICIALIZACIÓN ---
load_dotenv()
app = FastAPI(title="Sistema Ayudantías UCN")

@app.get("/debug/env")
def debug_env():
    return {
        "ESTUDIANTES": os.getenv("UCN_URL_ESTUDIANTES"),
        "ASIGNATURAS": os.getenv("UCN_URL_ASIGNATURAS"),
        "PROFESORES": os.getenv("UCN_URL_PROFESORES"),
        "TOKEN": os.getenv("UCN_TOKEN"),
        "HEADER": os.getenv("UCN_HEADER_AUTH")
    }

@app.get("/debug/ucn-estudiantes")
async def debug_ucn_estudiantes():
    import ucn_api
    try:
        datos = await ucn_api.obtener_todos_los_estudiantes()
        return {
            "tipo_de_dato": str(type(datos)),
            "longitud": len(datos) if isinstance(datos, list) else "No es una lista",
            "primer_elemento": datos[0] if isinstance(datos, list) and len(datos) > 0 else "Vacío o formato inesperado"
        }
    except Exception as e:
        return {"error": str(e)}


app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

supabase: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- MODELOS (Pydantic) ---
class LoginData(BaseModel):
    rut: str
    password: str

class ActivarData(BaseModel):
    rut: str
    nueva_password: str

# --- ENDPOINTS DE AUTENTICACIÓN ---

@app.post("/api/auth/login")
def login(data: LoginData):
    # 1. Buscar alumno en Supabase
    response = supabase.table("estudiantes").select("*").eq("rut", data.rut).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="RUT no encontrado en el periodo activo.")
    
    alumno = response.data[0]

    # 2. Verificar si ya activó su cuenta (tiene contraseña)
    if not alumno.get("password_hash"):
        raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION") # Señal especial para el frontend
    
    # 3. Verificar contraseña
    if not pwd_context.verify(data.password, alumno["password_hash"]):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta.")

    # 4. Login exitoso (No enviamos el password_hash al frontend por seguridad)
    alumno.pop("password_hash", None)
    return {"message": "Login exitoso", "user": alumno}

@app.post("/api/auth/activar")
def activar_cuenta(data: ActivarData):
    # Verificar que el RUT existe
    response = supabase.table("estudiantes").select("rut").eq("rut", data.rut).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="RUT no válido.")
    
    if len(data.nueva_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    # Encriptar y guardar
    hash_guardado = pwd_context.hash(data.nueva_password)
    
    supabase.table("estudiantes").update({"password_hash": hash_guardado}).eq("rut", data.rut).execute()
    
    return {"message": "Cuenta activada correctamente. Ya puedes iniciar sesión."}


# --- ENDPOINT DE SINCRONIZACIÓN (ADMIN) ---

@app.post("/api/admin/sincronizar")
async def sincronizar_ucn():
    resultados = {"estudiantes": 0, "notas": 0, "asignaturas": 0, "errores": []}
    
    try:
        # 1. Traer asignaturas (Catálogo general)
        asignaturas = await ucn_api.obtener_catalogo_asignaturas()
        for a in asignaturas:
            supabase.table("ramos").upsert({"codigo": a["codigo"], "nombre": a["nombre"]}, on_conflict="codigo").execute()
            resultados["asignaturas"] += 1

        # 2. Traer la lista gigante de estudiantes
        estudiantes_ucn = await ucn_api.obtener_todos_los_estudiantes()
        
        for est in estudiantes_ucn:
            try:
                rut = est["rut"]
                # Upsert del estudiante (sin sobreescribir la contraseña si ya la creó)
                supabase.table("estudiantes").upsert(
                    {
                        "rut": rut,
                        "nombre": est["nombre"],
                        "correo": est["correo"],
                        "ppa": est["ppa"],
                        "carrera": est.get("carrera", {}).get("nombre", "Sin carrera")
                    }, 
                    on_conflict="rut"
                ).execute()
                resultados["estudiantes"] += 1

                # Guardar sus notas aprobadas
                for nota in est.get("asignaturasAprobadas", []):
                    supabase.table("notas_api").upsert(
                        {
                            "rut_estudiante": rut,
                            "nrc": nota["nrc"],
                            "codigo": nota["codigo"],
                            "nombre": nota["nombre"],
                            "nota": nota["nota"],
                            "periodo": nota["periodo"]
                        },
                        on_conflict="rut_estudiante,nrc,periodo" # Evita duplicados exactos
                    ).execute()
                    resultados["notas"] += 1

            except Exception as e:
                resultados["errores"].append(f"Error procesando RUT {est.get('rut', 'Desconocido')}: {str(e)}")

        return {"message": "Sincronización completada", "data": resultados}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al conectar con la UCN: {str(e)}")


# --- ENDPOINTS DEL ESTUDIANTE (Con datos reales) ---

@app.get("/api/estudiante/{rut}/ramos-disponibles")
def obtener_ramos_para_postular(rut: str):
    # 1. Traer solo las notas >= 4.0 de este alumno desde Supabase
    response_notas = supabase.table("notas_api").select("codigo").eq("rut_estudiante", rut).gte("nota", 4.0).execute()
    
    codigos_aprobados = [n["codigo"] for n in response_notas.data]
    
    if not codigos_aprobados:
        return []

    # 2. Traer las ayudantías abiertas de la tabla de configuración
    # (Aún no creamos esta tabla en Supabase, pero así será la consulta)
    """
    response_ayudantias = supabase.table("configuracion_ayudantias").select("*").in_("codigo_ramo", codigos_aprobados).eq("esta_abierto", True).execute()
    return response_ayudantias.data
    """
    # Mientras tanto, devolvemos los códigos para que el frontend sepa qué mostrar
    return codigos_aprobados

@app.get("/api/ramos")
def obtener_ramos_publicos():
    """El que usa tu landing page"""
    response = supabase.table("ramos").select("*").execute()
    return response.data