import httpx
import os
from dotenv import load_dotenv

load_dotenv()

UCN_TOKEN = os.getenv("UCN_TOKEN")
UCN_HEADER_NAME = os.getenv("UCN_HEADER_AUTH")

URL_ESTUDIANTES = os.getenv("UCN_URL_ESTUDIANTES")
URL_ASIGNATURAS = os.getenv("UCN_URL_ASIGNATURAS")
URL_PROFESORES = os.getenv("UCN_URL_PROFESORES")


async def obtener_todos_los_estudiantes():
    """POST a estudiantes. USA HEADER PERSONALIZADO."""
    # Armamos el header exacto como la UCN lo pide
    headers = {
        UCN_HEADER_NAME: UCN_TOKEN, 
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(URL_ESTUDIANTES, headers=headers, json={})
        response.raise_for_status()
        return response.json()


async def obtener_catalogo_asignaturas():
    """GET a asignaturas. NO USA HEADER, el token está en la URL."""
    async with httpx.AsyncClient() as client:
        # A httpx no le pasamos headers, la URL ya tiene todo
        response = await client.get(URL_ASIGNATURAS)
        response.raise_for_status()
        return response.json()


async def obtener_ramos_profesor(rut_profesor: str):
    """GET a profesores. NO USA HEADER, el token está en la URL."""
    # Le concatenamos el rut a la URL que ya tiene token y periodo
    url_final = f"{URL_PROFESORES}&rut={rut_profesor}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url_final)
        response.raise_for_status()
        return response.json()