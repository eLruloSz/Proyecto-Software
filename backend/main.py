import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from database import supabase
import ucn_api

# --- INICIALIZACIÓN ---
load_dotenv()
app = FastAPI(title="Sistema Ayudantías UCN")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- ENDPOINTS DE DEBUG (de main, útiles para revisar la conexión UCN) ---

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


@app.get("/")
def root():
    return {"message": "API del Sistema de Ayudantías UCN funcionando correctamente"}


# --- RAMOS (tal cual la usa tu frontend: estudiante.js / docente.js) ---

@app.get("/api/ramos")
def obtener_ramos():
    """
    No existe una tabla que junte todo, así que se arma acá:
      - ramos: catálogo fijo (codigo, nombre)
      - configuracion_ayudantias: la config real de ayudantía por NRC
        (nrc, rut_profesor, cupos, esta_abierto)
    Se devuelve con los MISMOS nombres de campo que el frontend ya espera.
    """
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
        ramo_base = ramos_por_codigo.get(cfg["codigo_ramo"], {})
        nrc = cfg.get("nrc")
        resultado.append({
            "codigo_nrc": nrc,
            "nombre_ramo": ramo_base.get("nombre", "Ramo sin nombre"),
            "departamento": "",  # dato no disponible en la BD actual
            "cupos": cfg.get("cupos"),
            "esta_abierto": cfg.get("esta_abierto"),
            "id_profesor_encargado": cfg.get("rut_profesor"),
            "postulantes": conteo_postulantes.get(nrc, 0),
        })
    return resultado


# --- POSTULACIONES (estudiante) ---

class Postulacion(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nombre_estudiante: str   # se recibe pero no se guarda: no existe la columna
    nota_obtenida: float     # idem, se recalcula desde notas_api al leer


@app.post("/api/postular")
def crear_postulacion(postulacion: Postulacion):
    try:
        # Evita doble postulación activa al mismo NRC
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
        print(f" ERROR EN EL BACKEND: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


def _enriquecer_postulaciones(postulaciones_raw):
    """Le pega a cada postulación el nombre del estudiante (tabla estudiantes)
    y la nota con la que aprobó ese ramo (tabla notas_api), sin necesitar
    columnas nuevas en 'postulaciones'."""
    if not postulaciones_raw:
        return []

    ruts = list({p["rut_estudiante"] for p in postulaciones_raw})
    nrcs = list({p["nrc"] for p in postulaciones_raw})

    estudiantes_resp = supabase.table("estudiantes").select("rut, nombre").in_("rut", ruts).execute()
    nombres_por_rut = {e["rut"]: e["nombre"] for e in estudiantes_resp.data}

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
        })
    return resultado


@app.get("/api/postulaciones")
def obtener_postulaciones():
    """Trae todas las postulaciones enriquecidas con nombre y nota (la usa docente.js y estudiante.js)."""
    try:
        response = supabase.table("postulaciones").select("*").execute()
        return _enriquecer_postulaciones(response.data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ActualizarEstado(BaseModel):
    nrc_ramo: str
    rut_estudiante: str
    nuevo_estado: str  # 'aceptado' o 'rechazado'


@app.put("/api/postulaciones/estado")
def actualizar_estado(datos: ActualizarEstado):
    """El docente acepta o rechaza una postulación."""
    try:
        supabase.table("postulaciones") \
            .update({"estado": datos.nuevo_estado}) \
            .eq("nrc", datos.nrc_ramo) \
            .eq("rut_estudiante", datos.rut_estudiante) \
            .execute()

        return {"mensaje": "Estado actualizado correctamente"}
    except Exception as e:
        print(f" ERROR AL CAMBIAR ESTADO: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/postulaciones")
def retirar_postulacion(nrc_ramo: str, rut_estudiante: str):
    """Retira (borra) una postulación en 'revision'. El estudiante solo puede
    retirar postulaciones propias que aún no fueron resueltas por el profesor."""
    try:
        existente = supabase.table("postulaciones").select("estado") \
            .eq("nrc", nrc_ramo).eq("rut_estudiante", rut_estudiante).execute()

        if not existente.data:
            raise HTTPException(status_code=404, detail="Postulación no encontrada")

        if existente.data[0]["estado"] != "revision":
            raise HTTPException(status_code=400, detail="Solo se pueden retirar postulaciones en revisión")

        supabase.table("postulaciones") \
            .delete() \
            .eq("nrc", nrc_ramo).eq("rut_estudiante", rut_estudiante) \
            .execute()

        return {"mensaje": "Postulación retirada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        print(f" ERROR AL RETIRAR POSTULACIÓN: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


# --- LOGIN / REGISTRO ---

class EstudianteRegistro(BaseModel):
    rut: str
    nombre: str
    correo: str
    password: str  # TODO: hashear con passlib antes de guardar


class EstudianteLogin(BaseModel):
    correo: str
    password: str
    rol: Optional[str] = "estudiante"  # 'estudiante' | 'docente' | 'admin'


@app.post("/api/login")
def login(datos: EstudianteLogin):
    # OJO: la tabla 'profesores' (ver schema) no tiene columna 'correo', solo
    # rut/nombre/password_hash. Por eso, por ahora, solo dejamos funcionando
    # el login de estudiante. Login de docente/admin necesita agregar esa
    # columna en Supabase (ALTER TABLE profesores ADD COLUMN correo text;)
    # o cambiar el formulario para pedir RUT en vez de correo.
    if datos.rol in ("docente", "admin"):
        raise HTTPException(
            status_code=501,
            detail="Login de docente/admin aún no implementado: falta columna 'correo' en tabla 'profesores'."
        )

    response = supabase.table("estudiantes").select("*").eq("correo", datos.correo).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Usuario no registrado")

    usuario = response.data[0]

    # Estudiantes cargados desde la API externa tienen password_hash NULL:
    # nunca se han logueado. Este es su primer login real -> se guarda la
    # contraseña que acaban de escribir en vez de compararla contra NULL.
    if usuario.get("password_hash") is None:
        supabase.table("estudiantes").update(
            {"password_hash": datos.password}  # TODO: hashear
        ).eq("rut", usuario["rut"]).execute()
        usuario["password_hash"] = datos.password
        return {"mensaje": "Cuenta activada y login exitoso", "usuario": usuario}

    if usuario["password_hash"] != datos.password:  # TODO: comparar hash, no texto plano
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")

    return {"mensaje": "Login exitoso", "usuario": usuario}


@app.post("/api/registro")
def registro(datos: EstudianteRegistro):
    try:
        response = supabase.table("estudiantes").insert({
            "rut": datos.rut,
            "nombre": datos.nombre,
            "correo": datos.correo,
            "password_hash": datos.password
        }).execute()
        return {"mensaje": "Registro exitoso", "usuario": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=400, detail="El correo o RUT ya existe")


# --- SINCRONIZACIÓN CON LA API DE LA UCN (de main, la usará el admin) ---

class SincronizarData(BaseModel):
    periodo: str = "202520"


@app.post("/api/admin/sincronizar")
async def sincronizar_ucn(data: SincronizarData = SincronizarData()):
    resultados = {"estudiantes": 0, "notas": 0, "asignaturas": 0, "errores": []}

    try:
        # 1. Traer asignaturas
        asignaturas = await ucn_api.obtener_catalogo_asignaturas()

        for a in asignaturas:
            supabase.table("ramos").upsert(
                {"codigo": a["codigo"], "nombre": a["nombre"]},
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

                # Importante: NO se manda password_hash acá, así se mantiene
                # NULL para estudiantes nuevos (primer login) y no se pisa
                # el password_hash de un estudiante que ya se logueó antes.
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

                for nota in est.get("asignaturasAprobadas", []):
                    nrc = nota.get("nrc")
                    periodo_nota = nota.get("periodo") or data.periodo
                    if not nrc or not periodo_nota:
                        resultados["errores"].append(f"Nota sin NRC o periodo para RUT {rut}.")
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
                resultados["errores"].append(f"Error procesando RUT {est.get('rut', 'Desconocido')}: {str(e)}")

        return {"message": "Sincronización completada", "periodo": data.periodo, "data": resultados}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al sincronizar datos UCN: {str(e)}")