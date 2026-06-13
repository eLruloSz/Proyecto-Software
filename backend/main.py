from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import supabase 

app = FastAPI()

# Configurar CORS (Para que tu HTML local pueda hablar con el backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cambia esto por "http://127.0.0.1:5500" en el futuro
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ENDPOINTS ---

@app.get("/api/ramos")
def obtener_ramos():
    """
    Trae todos los ramos de la base de datos de Supabase.
    """
    response = supabase.table("ramos").select("*").execute()
    return response.data

@app.get("/")
def root():
    return {"message": "API del Sistema de Ayudantías UCN funcionando correctamente"}

class Postulacion(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nombre_estudiante: str

@app.post("/api/postular")
def crear_postulacion(postulacion: Postulacion):
    try:
        # 1. Insertamos la postulación
        response = supabase.table("postulaciones").insert({
            "nrc_ramo": postulacion.nrc_ramo,
            "rut_estudiante": postulacion.rut_estudiante,
            "nombre_estudiante": postulacion.nombre_estudiante,
            "estado": "revision"
        }).execute()
        
        # 2. Buscamos el ramo
        ramo = supabase.table("ramos").select("postulantes").eq("codigo_nrc", postulacion.nrc_ramo).execute()
        
        # 3. Sumamos 1
        if ramo.data:
            postulantes_actuales = ramo.data[0].get("postulantes", 0)
            nuevo_valor = postulantes_actuales + 1
            
            
            supabase.table("ramos").update({"postulantes": nuevo_valor}).eq("codigo_nrc", postulacion.nrc_ramo).execute()

        return {"mensaje": "Postulación guardada y contador actualizado"}
    
    except Exception as e:
        # Ahora si falla, lo imprimirá en rojo en tu terminal de VS Code
        print(f" ERROR EN EL BACKEND: {str(e)}") 
        raise HTTPException(status_code=400, detail=str(e))
    

    # --- NUEVOS ENDPOINTS PARA EL PANEL DOCENTE/ADMIN ---

# --- NUEVOS ENDPOINTS PARA EL PANEL DOCENTE Y ADMINISTRADOR ---

@app.get("/api/postulaciones")
def obtener_postulaciones():
    """Trae todas las postulaciones del sistema desde Supabase."""
    try:
        response = supabase.table("postulaciones").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ActualizarEstado(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nuevo_estado: str  # Puede recibir 'aceptado' o 'rechazado'

@app.put("/api/postulaciones/estado")
def actualizar_estado(datos: ActualizarEstado):
    """Actualiza el estado de una postulación y libera el cupo si es rechazado."""
    try:
        # 1. Actualizamos el estado a 'aceptado' o 'rechazado'
        response = supabase.table("postulaciones")\
            .update({"estado": datos.nuevo_estado})\
            .eq("nrc_ramo", datos.nrc_ramo)\
            .eq("rut_estudiante", datos.rut_estudiante)\
            .execute()
        
        # 2. Si el estudiante fue rechazado, restamos 1 al contador del ramo
        if datos.nuevo_estado == 'rechazado':
            ramo = supabase.table("ramos").select("postulantes").eq("codigo_nrc", datos.nrc_ramo).execute()
            if ramo.data:
                postulantes_actuales = ramo.data[0].get("postulantes", 0)
                if postulantes_actuales > 0:
                    supabase.table("ramos").update({"postulantes": postulantes_actuales - 1}).eq("codigo_nrc", datos.nrc_ramo).execute()

        return {"mensaje": "Estado actualizado correctamente"}
    except Exception as e:
        print(f" ERROR AL CAMBIAR ESTADO: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))