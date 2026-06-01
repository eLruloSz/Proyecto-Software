import os
from dotenv import load_dotenv
from supabase import create_client, Client

# 1. Cargar las variables del archivo .env
load_dotenv()

# 2. Leer las variables de entorno de forma segura
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Validación de seguridad: el sistema no arrancará si faltan las claves
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY en el archivo .env")

# 3. Inicializar el cliente de Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)