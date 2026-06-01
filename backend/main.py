import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

# 1. Cargar las variables del archivo .env
load_dotenv()

app = FastAPI()

# Configurar CORS (Para que tu HTML local pueda hablar con el backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cambia esto por "http://127.0.0.1:5500" en el futuro
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Leer las variables de entorno de forma segura
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Validación de seguridad: FastAPI no arrancará si faltan las claves
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY en el archivo .env")

# 3. Inicializar el cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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