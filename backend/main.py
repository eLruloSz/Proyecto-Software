import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tus datos de Supabase
SUPABASE_URL = "https://wzpshqrhbevhkcrxyhzw.supabase.co" 
SUPABASE_KEY = "sb_publishable_ye9WOs4iwEs-kC9gsrWJOg_Rc4UkWe9"

@app.get("/api/ramos")
def obtener_ramos():
    # URL limpia: Trae TODOS los registros de la tabla Ramos, abiertos y cerrados
    endpoint = f"{SUPABASE_URL}/rest/v1/Ramos"
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    respuesta = requests.get(endpoint, headers=headers)
    return respuesta.json()