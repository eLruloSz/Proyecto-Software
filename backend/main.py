from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# IMPORTANTE: Aquí traemos la conexión a la base de datos que acabas de crear
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



#lo que meti pa que funcione el boton de postulacion 
from pydantic import BaseModel


class Postulacion(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nombre_estudiante: str

@app.post("/api/postular")
def crear_postulacion(postulacion: Postulacion):
    try:
        
        response = supabase.table("postulaciones").insert({
            "nrc_ramo": postulacion.nrc_ramo,
            "rut_estudiante": postulacion.rut_estudiante,
            "nombre_estudiante": postulacion.nombre_estudiante,
            "estado": "revision"
        }).execute()
        return {"mensaje": "Postulación guardada exitosamente", "data": response.data}
    except Exception as e:
        return {"error": str(e)}