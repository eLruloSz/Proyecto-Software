import os
import re
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from passlib.context import CryptContext

from database import supabase
import ucn_api

# --- INICIALIZACIÓN ---
load_dotenv()
app = FastAPI(title="Sistema Ayudantías UCN")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- ENDPOINTS DE DEBUG ---
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
    except Exception:
        return {"error": "No fue posible consultar el servicio UCN en este momento."}


@app.get("/")
def root():
    return {"message": "API del Sistema de Ayudantías UCN funcionando correctamente"}


# --- RAMOS ---
@app.get("/api/ramos")
def _construir_ramos(codigos_permitidos=None):
    ramos_resp = supabase.table("ramos").select("*").execute()
    config_resp = supabase.table("configuracion_ayudantias").select("*").execute()
    postulaciones_resp = supabase.table("postulaciones").select("nrc, estado").execute()

    ramos_por_codigo = {r["codigo"]: r for r in ramos_resp.data}

    conteo_postulantes = {}
    for p in postulaciones_resp.data:
        if p.get("estado") != "rechazado":
            conteo_postulantes[p["nrc"]] = conteo_postulantes.get(p["nrc"], 0) + 1

    resultado = []
    for cfg in config_resp.data:
        codigo_ramo = cfg["codigo_ramo"]
        if codigos_permitidos is not None and codigo_ramo not in codigos_permitidos:
            continue
        ramo_base = ramos_por_codigo.get(codigo_ramo, {})
        nrc = cfg.get("nrc")
        resultado.append({
            "codigo_nrc": nrc,
            "nombre_ramo": ramo_base.get("nombre", "Ramo sin nombre"),
            "departamento": "",
            "cupos": cfg.get("cupos"),
            "esta_abierto": cfg.get("esta_abierto"),
            "id_profesor_encargado": cfg.get("rut_profesor"),
            "postulantes": conteo_postulantes.get(nrc, 0),
        })
    return resultado


@app.get("/api/ramos")
def obtener_ramos():
    return _construir_ramos()


@app.get("/api/estudiante/{rut}/ramos-disponibles")
def obtener_ramos_disponibles_estudiante(rut: str):
    notas_resp = supabase.table("notas_api").select("codigo").eq("rut_estudiante", rut).gte("nota", 4.0).execute()
    codigos_aprobados = {n["codigo"] for n in notas_resp.data}
    if not codigos_aprobados:
        return []
    return _construir_ramos(codigos_permitidos=codigos_aprobados)


# --- POSTULACIONES ---
class Postulacion(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nombre_estudiante: str
    nota_obtenida: float


@app.post("/api/postular")
def crear_postulacion(postulacion: Postulacion):
    try:
        config = supabase.table("configuracion_ayudantias").select("codigo_ramo, esta_abierto") \
            .eq("nrc", postulacion.nrc_ramo).execute()
        if not config.data or not config.data[0].get("esta_abierto"):
            raise HTTPException(status_code=404, detail="La ayudantía no existe o no está abierta.")
        codigo_ramo = config.data[0]["codigo_ramo"]

        nota = supabase.table("notas_api").select("nota") \
            .eq("rut_estudiante", postulacion.rut_estudiante) \
            .eq("codigo", codigo_ramo).gte("nota", 4.0).execute()
        if not nota.data:
            raise HTTPException(status_code=403, detail="No cumples el requisito de nota (>= 4.0) para postular.")

        ya_postulo = supabase.table("postulaciones").select("id") \
            .eq("rut_estudiante", postulacion.rut_estudiante) \
            .eq("nrc", postulacion.nrc_ramo) \
            .eq("estado", "revision").execute()
        if ya_postulo.data:
            raise HTTPException(status_code=400, detail="Ya tienes una postulación en revisión para este NRC.")

        supabase.table("postulaciones").insert({
            "nrc": postulacion.nrc_ramo,
            "rut_estudiante": postulacion.rut_estudiante,
            "estado": "revision",
            "fecha_postulacion": datetime.now(timezone.utc).isoformat(),
        }).execute()

        return {"mensaje": "Postulación guardada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="No fue posible guardar la postulación.")


def _enriquecer_postulaciones(postulaciones_raw):
    if not postulaciones_raw:
        return []

    ruts = list({p["rut_estudiante"] for p in postulaciones_raw})
    nrcs = list({p["nrc"] for p in postulaciones_raw})

    estudiantes_resp = supabase.table("estudiantes").select("rut, nombre, ppa").in_("rut", ruts).execute()
    nombres_por_rut = {e["rut"]: e["nombre"] for e in estudiantes_resp.data}
    ppa_por_rut = {e["rut"]: e.get("ppa") for e in estudiantes_resp.data}

    notas_resp = supabase.table("notas_api").select("rut_estudiante, nrc, nota") \
        .in_("rut_estudiante", ruts).in_("nrc", nrcs).execute()
    notas_por_rut_nrc = {(n["rut_estudiante"], n["nrc"]): n["nota"] for n in notas_resp.data}

    resultado = []
    for p in postulaciones_raw:
        resultado.append({
            **p,
            "nrc_ramo": p.get("nrc"),
            "nombre_estudiante": nombres_por_rut.get(p["rut_estudiante"], p["rut_estudiante"]),
            "nota_obtenida": notas_por_rut_nrc.get((p["rut_estudiante"], p["nrc"])),
            "ppa": ppa_por_rut.get(p["rut_estudiante"]),
        })
    return resultado


@app.get("/api/postulaciones")
def obtener_postulaciones():
    try:
        response = supabase.table("postulaciones").select("*").execute()
        return _enriquecer_postulaciones(response.data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ActualizarEstado(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nuevo_estado: str


@app.put("/api/postulaciones/estado")
def actualizar_estado(datos: ActualizarEstado):
    try:
        supabase.table("postulaciones") \
            .update({"estado": datos.nuevo_estado}) \
            .eq("nrc", datos.nrc_ramo) \
            .eq("rut_estudiante", datos.rut_estudiante) \
            .execute()
        return {"mensaje": "Estado actualizado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/postulaciones")
def retirar_postulacion(nrc_ramo: str, rut_estudiante: str):
    try:
        existente = supabase.table("postulaciones").select("estado") \
            .eq("nrc", nrc_ramo).eq("rut_estudiante", rut_estudiante).execute()

        if not existente.data:
            raise HTTPException(status_code=404, detail="Postulación no encontrada")
        if existente.data[0]["estado"] != "revision":
            raise HTTPException(status_code=400, detail="Solo se pueden retirar postulaciones en revisión")

        supabase.table("postulaciones").delete().eq("nrc", nrc_ramo).eq("rut_estudiante", rut_estudiante).execute()
        return {"mensaje": "Postulación retirada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- UTILIDADES DE RUT ---
# --- UTILIDADES DE RUT ---
def limpiar_rut(rut: str) -> str:
    """
    Limpia el RUT quitando puntos y espacios, y asegura que tenga guion.
    Ejemplo: '19.847.406-k' o '19847406k' -> '19847406-K'
    """
    if not rut:
        return ""
    
    # 1. Extraemos solo los números y la letra K
    rut_solo_numeros = re.sub(r'[^0-9kK]', '', str(rut)).upper()
    
    # 2. Si tiene longitud suficiente para ser un RUT, le ponemos el guion al final
    if len(rut_solo_numeros) > 1:
        return f"{rut_solo_numeros[:-1]}-{rut_solo_numeros[-1]}"
        
    return rut_solo_numeros


# --- LOGIN UNIFICADO ---
class LoginData(BaseModel):
    rut: str
    password: str


@app.post("/api/auth/login")
async def login(data: LoginData):
    usuario_crudo = data.rut.strip()
    
    if not usuario_crudo:
        raise HTTPException(status_code=400, detail="RUT o Username requerido.")

    # 1. Buscar Administrador (Usamos el texto tal cual, por ej: "admin")
    resp_admin = supabase.table("administradores").select("*").eq("username", usuario_crudo).execute()
    if resp_admin.data:
        admin = resp_admin.data[0]
        if pwd_context.verify(data.password, admin["password_hash"]):
            return {"message": "Login exitoso", "user": {"nombre": "Administrador", "rut": usuario_crudo}, "rol": "admin"}
        raise HTTPException(status_code=401, detail="Contraseña incorrecta.")

    # 2. Si no es admin, limpiamos y formateamos el RUT para buscar Estudiantes o Profesores
    rut_formateado = limpiar_rut(usuario_crudo)

    # 3. Buscar Estudiante
    resp_est = supabase.table("estudiantes").select("*").eq("rut", rut_formateado).execute()
    if resp_est.data:
        alumno = resp_est.data[0]
        if not alumno.get("password_hash"):
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_STUDENT")
        if not pwd_context.verify(data.password, alumno["password_hash"]):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
        alumno.pop("password_hash", None)
        return {"message": "Login exitoso", "user": alumno, "rol": "estudiante"}

    # 4. Buscar Profesor
    resp_prof = supabase.table("profesores").select("*").eq("rut", rut_formateado).execute()
    if resp_prof.data:
        prof = resp_prof.data[0]
        if not prof.get("password_hash"):
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_PROFESSOR")
        if not pwd_context.verify(data.password, prof["password_hash"]):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
        prof.pop("password_hash", None)
        return {"message": "Login exitoso", "user": prof, "rol": "profesor"}

    # 5. Fallback API Profesores UCN
    try:
        datos_profesor_ucn = await ucn_api.obtener_ramos_profesor(rut_formateado)
        if datos_profesor_ucn:
            nombre_prof = datos_profesor_ucn.get("nombre", f"Profesor {rut_formateado}")
            supabase.table("profesores").insert({
                "rut": rut_formateado,
                "nombre": nombre_prof,
                "password_hash": None
            }).execute()
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_PROFESSOR")
    except Exception:
        pass # Regla de oro: Ocultamos el error de la UCN si no es profesor

    raise HTTPException(status_code=404, detail="Usuario no encontrado en los registros.")


@app.post("/api/auth/login")
async def login(data: LoginData):
    rut_limpio = limpiar_rut(data.rut)
    if not rut_limpio:
        raise HTTPException(status_code=400, detail="RUT o Username requerido.")

    # 1. Buscar Administrador
    resp_admin = supabase.table("administradores").select("*").eq("username", rut_limpio).execute()
    if resp_admin.data:
        admin = resp_admin.data[0]
        if pwd_context.verify(data.password, admin["password_hash"]):
            return {"message": "Login exitoso", "user": {"nombre": "Administrador", "rut": rut_limpio}, "rol": "admin"}
        raise HTTPException(status_code=401, detail="Contraseña incorrecta.")

    # 2. Buscar Estudiante
    resp_est = supabase.table("estudiantes").select("*").eq("rut", rut_limpio).execute()
    if resp_est.data:
        alumno = resp_est.data[0]
        if not alumno.get("password_hash"):
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_STUDENT")
        if not pwd_context.verify(data.password, alumno["password_hash"]):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
        alumno.pop("password_hash", None)
        return {"message": "Login exitoso", "user": alumno, "rol": "estudiante"}

    # 3. Buscar Profesor
    resp_prof = supabase.table("profesores").select("*").eq("rut", rut_limpio).execute()
    if resp_prof.data:
        prof = resp_prof.data[0]
        if not prof.get("password_hash"):
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_PROFESSOR")
        if not pwd_context.verify(data.password, prof["password_hash"]):
            raise HTTPException(status_code=401, detail="Contraseña incorrecta.")
        prof.pop("password_hash", None)
        return {"message": "Login exitoso", "user": prof, "rol": "profesor"}

    # 4. Fallback API Profesores UCN
    try:
        datos_profesor_ucn = await ucn_api.obtener_ramos_profesor(rut_limpio)
        if datos_profesor_ucn:
            nombre_prof = datos_profesor_ucn.get("nombre", f"Profesor {rut_limpio}")
            supabase.table("profesores").insert({
                "rut": rut_limpio,
                "nombre": nombre_prof,
                "password_hash": None
            }).execute()
            raise HTTPException(status_code=403, detail="NEEDS_ACTIVATION_PROFESSOR")
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Usuario no encontrado en los registros.")


class ActivarData(BaseModel):
    rut: str
    nueva_password: str
    rol: str


@app.post("/api/auth/activar")
def activar_cuenta(data: ActivarData):
    tabla = "estudiantes" if data.rol == "estudiante" else "profesores"
    rut = limpiar_rut(data.rut)
    
    response = supabase.table(tabla).select("rut").eq("rut", rut).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="RUT no válido.")
    if len(data.nueva_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    hash_guardado = pwd_context.hash(data.nueva_password)
    supabase.table(tabla).update({"password_hash": hash_guardado}).eq("rut", rut).execute()
    return {"message": "Cuenta activada correctamente."}


# --- SINCRONIZACIÓN ---
class SincronizarData(BaseModel):
    periodo: str = "202520"


@app.post("/api/admin/sincronizar")
async def sincronizar_ucn(data: SincronizarData = SincronizarData()):
    resultados = {"estudiantes": 0, "notas": 0, "asignaturas": 0, "errores": []}
    try:
        asignaturas = await ucn_api.obtener_catalogo_asignaturas()
        for a in asignaturas:
            supabase.table("ramos").upsert({"codigo": a["codigo"], "nombre": a["nombre"]}, on_conflict="codigo").execute()
            resultados["asignaturas"] += 1

        estudiantes_ucn = await ucn_api.obtener_todos_los_estudiantes(data.periodo)
        for est in estudiantes_ucn:
            try:
                rut_bruto = est.get("rut")
                if not rut_bruto: continue
                rut = limpiar_rut(rut_bruto)

                carrera_data = est.get("carrera")
                carrera_nombre = carrera_data.get("nombre", "Sin carrera") if isinstance(carrera_data, dict) else (carrera_data or "Sin carrera")

                supabase.table("estudiantes").upsert({
                    "rut": rut,
                    "nombre": est.get("nombre"),
                    "correo": est.get("correo"),
                    "ppa": est.get("ppa"),
                    "carrera": carrera_nombre,
                }, on_conflict="rut").execute()
                resultados["estudiantes"] += 1

                for nota in est.get("asignaturasAprobadas", []):
                    nrc = nota.get("nrc")
                    periodo_nota = nota.get("periodo") or data.periodo
                    if not nrc or not periodo_nota: continue

                    supabase.table("notas_api").upsert({
                        "rut_estudiante": rut,
                        "nrc": nrc,
                        "codigo": nota.get("codigo"),
                        "nombre": nota.get("nombre"),
                        "nota": nota.get("nota"),
                        "periodo": periodo_nota,
                    }, on_conflict="rut_estudiante,nrc,periodo").execute()
                    resultados["notas"] += 1
            except Exception as e:
                resultados["errores"].append(f"Error en RUT {rut}: {type(e).__name__}")
        return {"message": "Sincronización completada", "data": resultados}
    except Exception:
        raise HTTPException(status_code=500, detail="Error de sincronización con UCN.")


# --- ENDPOINTS EXCLUSIVOS PANEL ADMINISTRADOR ---
@app.get("/api/profesores")
def listar_profesores():
    """Retorna todos los profesores para llenar el Select en el panel de Admin"""
    try:
        response = supabase.table("profesores").select("rut, nombre").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/ramos/catalogo")
def listar_catalogo_ramos():
    """Retorna todos los ramos sincronizados para llenar el Select del Admin"""
    try:
        response = supabase.table("ramos").select("codigo, nombre").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ConfiguracionAyudantia(BaseModel):
    nrc: str
    codigo_ramo: str
    rut_profesor: str
    cupos: int

@app.post("/api/admin/ayudantias")
def abrir_ayudantia(config: ConfiguracionAyudantia):
    """Crea una nueva apertura de ayudantía"""
    try:
        supabase.table("configuracion_ayudantias").upsert({
            "nrc": config.nrc,
            "codigo_ramo": config.codigo_ramo,
            "rut_profesor": limpiar_rut(config.rut_profesor),
            "cupos": config.cupos,
            "esta_abierto": True
        }, on_conflict="nrc").execute()
        return {"mensaje": "Ayudantía configurada y abierta correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))