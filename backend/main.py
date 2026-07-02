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
        "ESTUDIANTES_CONFIGURADO": bool(os.getenv("UCN_URL_ESTUDIANTES")),
        "ASIGNATURAS_CONFIGURADO": bool(os.getenv("UCN_URL_ASIGNATURAS")),
        "PROFESORES_CONFIGURADO": bool(os.getenv("UCN_URL_PROFESORES")),
        "TOKEN_CONFIGURADO": bool(os.getenv("UCN_TOKEN")),
        "HEADER_CONFIGURADO": bool(os.getenv("UCN_HEADER_AUTH")),
    }

@app.get("/debug/ucn-estudiantes")
async def debug_ucn_estudiantes(periodo: str = "202520"):
    try:
        return await ucn_api.diagnosticar_estudiantes(periodo)
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
    rol: str  # "estudiante" o "profesor"

class PostulacionData(BaseModel):
    nrc: str

# --- ENDPOINTS DE AUTENTICACIÓN ---

# --- ENDPOINTS DE AUTENTICACIÓN (UNIFICADO) ---

@app.post("/api/auth/login")
async def login(data: LoginData):
    # 1. Intentamos buscarlo como ESTUDIANTE
    resp_est = supabase.table("estudiantes").select("*").eq("rut", data.rut).execute()
    
    if resp_est.data:
        alumno = resp_est.data[0]
        if not alumno.get("password_hash"):
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_STUDENT")
        if not pwd_context.verify(data.password, alumno["password_hash"]):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
        alumno.pop("password_hash", None)
        return {"message": "Login exitoso", "user": alumno, "rol": "estudiante"}

    # 2. Si no es estudiante, intentamos como PROFESOR
    resp_prof = supabase.table("profesores").select("*").eq("rut", data.rut).execute()
    
    if resp_prof.data:
        prof = resp_prof.data[0]
        if not prof.get("password_hash"):
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_PROFESSOR")
        if not pwd_context.verify(data.password, prof["password_hash"]):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
        prof.pop("password_hash", None)
        return {"message": "Login exitoso", "user": prof, "rol": "profesor"}

    # 3. No está en ninguna tabla. ¿Es un profe de la UCN que entra por primera vez?
    try:
        datos_ucn = await ucn_api.obtener_ramos_profesor(data.rut)
        if datos_ucn and datos_ucn.get("nombre"):
            # Lo registramos automáticamente en la BD
            supabase.table("profesores").insert({"rut": data.rut, "nombre": datos_ucn["nombre"]}).execute()
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_PROFESSOR")
        else:
            raise HTTPException(status_code=404, detail="RUT no encontrado en registros UCN.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al validar RUT con la UCN: {str(e)}")


@app.post("/api/auth/activar")
def activar_cuenta(data: ActivarData):
    tabla = "estudiantes" if data.rol == "estudiante" else "profesores"
    
    response = supabase.table(tabla).select("rut").eq("rut", data.rut).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="RUT no válido.")
    
    if len(data.nueva_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    hash_guardado = pwd_context.hash(data.nueva_password)
    supabase.table(tabla).update({"password_hash": hash_guardado}).eq("rut", data.rut).execute()
    
    return {"message": "Cuenta activada correctamente. Ya puedes iniciar sesión."}

# --- ENDPOINT DE SINCRONIZACIÓN (ADMIN) ---
class SincronizarData(BaseModel):
    periodo: str = "202520"


@app.post("/api/admin/sincronizar")
async def sincronizar_ucn(data: SincronizarData = SincronizarData()):
    resultados = {"estudiantes": 0, "notas": 0, "asignaturas": 0, "errores": []}

    try:
        # 1. Traer asignaturas, se mantiene porque ramos ya funciona
        asignaturas = await ucn_api.obtener_catalogo_asignaturas()

        for a in asignaturas:
            supabase.table("ramos").upsert(
                {
                    "codigo": a["codigo"],
                    "nombre": a["nombre"]
                },
                on_conflict="codigo"
            ).execute()

            resultados["asignaturas"] += 1

        # 2. Traer estudiantes del periodo
        estudiantes_ucn = await ucn_api.obtener_todos_los_estudiantes(data.periodo)

        for est in estudiantes_ucn:
            try:
                rut = est.get("rut")

                if not rut:
                    resultados["errores"].append("Estudiante sin RUT recibido desde API UCN.")
                    continue

                carrera_data = est.get("carrera")

                if isinstance(carrera_data, dict):
                    carrera_nombre = carrera_data.get("nombre", "Sin carrera")
                else:
                    carrera_nombre = carrera_data or "Sin carrera"

                # 3. Guardar o actualizar estudiante
                supabase.table("estudiantes").upsert(
                    {
                        "rut": rut,
                        "nombre": est.get("nombre"),
                        "correo": est.get("correo"),
                        "ppa": est.get("ppa"),
                        "carrera": carrera_nombre,
                    },
                    on_conflict="rut"
                ).execute()

                resultados["estudiantes"] += 1

                # 4. Guardar notas aprobadas
                for nota in est.get("asignaturasAprobadas", []):
                    nrc = nota.get("nrc")
                    periodo_nota = nota.get("periodo") or data.periodo

                    if not nrc or not periodo_nota:
                        resultados["errores"].append(
                            f"Nota sin NRC o periodo para RUT {rut}."
                        )
                        continue

                    supabase.table("notas_api").upsert(
                        {
                            "rut_estudiante": rut,
                            "nrc": nrc,
                            "codigo": nota.get("codigo"),
                            "nombre": nota.get("nombre"),
                            "nota": nota.get("nota"),
                            "periodo": periodo_nota,
                        },
                        on_conflict="rut_estudiante,nrc,periodo"
                    ).execute()

                    resultados["notas"] += 1

            except Exception as e:
                resultados["errores"].append(
                    f"Error procesando RUT {est.get('rut', 'Desconocido')}: {str(e)}"
                )

        return {
            "message": "SincronizaciÃ³n completada",
            "periodo": data.periodo,
            "data": resultados
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al sincronizar datos UCN: {str(e)}"
        )


# --- ENDPOINTS DEL ESTUDIANTE (Con datos reales) ---

# --- ENDPOINTS DEL ESTUDIANTE (Postulaciones reales) ---

@app.post("/api/estudiante/{rut}/postular")
def crear_postulacion(rut: str, data: PostulacionData):
    # 1. Verificar que el NRC existe y está abierto en la configuración
    config = supabase.table("configuracion_ayudantias").select("*, ramos(codigo, nombre)").eq("nrc", data.nrc).eq("esta_abierto", True).execute()
    if not config.data:
        raise HTTPException(status_code=404, detail="La ayudantía no existe o no está abierta.")
    
    ramo_config = config.data[0]
    codigo_ramo = ramo_config["codigo_ramo"]

    # 2. Verificar que el alumno aprobó el ramo (nota >= 4.0)
    nota = supabase.table("notas_api").select("nota").eq("rut_estudiante", rut).eq("codigo", codigo_ramo).gte("nota", 4.0).execute()
    if not nota.data:
        raise HTTPException(status_code=403, detail="No cumples con los requisitos (nota < 4.0) para postular a este ramo.")

    # 3. Verificar si ya postuló a este NRC
    ya_postulo = supabase.table("postulaciones").select("id").eq("rut_estudiante", rut).eq("nrc", data.nrc).eq("estado", "revision").execute()
    if ya_postulo.data:
        raise HTTPException(status_code=400, detail="Ya tienes una postulación activa para este NRC.")

    # 4. Crear postulación
    supabase.table("postulaciones").insert({
        "rut_estudiante": rut,
        "nrc": data.nrc,
        "estado": "revision"
    }).execute()

    return {"message": f"Postulación a {ramo_config['ramos']['nombre']} (NRC {data.nrc}) realizada con éxito."}


@app.delete("/api/estudiante/{rut}/postular/{nrc}")
def retirar_postulacion(rut: str, nrc: str):
    resp = supabase.table("postulaciones").select("id, estado").eq("rut_estudiante", rut).eq("nrc", nrc).eq("estado", "revision").execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="No se encontró postulación activa para retirar.")
    
    supabase.table("postulaciones").update({"estado": "retirada"}).eq("id", resp.data[0]["id"]).execute()
    return {"message": "Postulación retirada correctamente."}


@app.get("/api/estudiante/{rut}/mis-postulaciones")
def obtener_mis_postulaciones(rut: str):
    # Usamos un join para traer el nombre del ramo desde la tabla configuracion_ayudantias
    response = supabase.table("postulaciones").select("*, configuracion_ayudantias(codigo_ramo, ramos(nombre))").eq("rut_estudiante", rut).neq("estado", "retirada").execute()
    return response.data


@app.get("/api/estudiante/{rut}/ramos-disponibles")
def obtener_ramos_para_postular(rut: str):
    # 1. Traer los códigos de ramos donde el alumno sacó >= 4.0
    response_notas = supabase.table("notas_api").select("codigo").eq("rut_estudiante", rut).gte("nota", 4.0).execute()
    codigos_aprobados = [n["codigo"] for n in response_notas.data]
    
    if not codigos_aprobados:
        return []

    response_ayudantias = supabase.table("configuracion_ayudantias").select("*, ramos(*)").in_("codigo_ramo", codigos_aprobados).eq("esta_abierto", True).execute()
    return response_ayudantias.data

@app.get("/api/ramos")
def obtener_ramos_publicos():
    """El que usa tu landing page - Mapeado al formato del HTML"""
    response = supabase.table("ramos").select("*").execute()
    
    # Formateamos los datos para que calcen con lo que espera el HTML
    formatted_data = []
    for r in response.data:
        formatted_data.append({
            "codigo_nrc": r.get("codigo"),
            "nombre_ramo": r.get("nombre"),
            "departamento": r.get("departamento", "General"),
            # Estos campos no están en la tabla 'ramos', están en 'configuracion_ayudantias'
            "cupos": 0, 
            "esta_abierto": False, 
            "id_profesor_encargado": "Por asignar",
            "postulantes": 0
        })
        
    return formatted_data