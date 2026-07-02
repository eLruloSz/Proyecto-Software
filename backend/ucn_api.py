import os
from typing import Any, Dict, Iterable, List
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import httpx
from dotenv import load_dotenv

load_dotenv()

UCN_TOKEN = os.getenv("UCN_TOKEN")
UCN_HEADER_NAME = os.getenv("UCN_HEADER_AUTH")

URL_ESTUDIANTES = os.getenv("UCN_URL_ESTUDIANTES")
URL_ASIGNATURAS = os.getenv("UCN_URL_ASIGNATURAS")
URL_PROFESORES = os.getenv("UCN_URL_PROFESORES")

QUERY_KEYS_SENSIBLES = {
    "token",
    "auth",
    "apikey",
    "api_key",
    "key",
    "rut",
    "password",
    "pass",
    "session",
    "phpsessid",
}


def _validar_config_ucn():
    if not UCN_TOKEN:
        raise RuntimeError("Falta UCN_TOKEN en el archivo .env")

    if not UCN_HEADER_NAME:
        raise RuntimeError("Falta UCN_HEADER_AUTH en el archivo .env")


def _headers_ucn() -> Dict[str, str]:
    _validar_config_ucn()

    return {
        "Accept": "*/*",
        "Content-Type": "application/json",
        "User-Agent": "Thunder Client (https://www.thunderclient.com)",
        UCN_HEADER_NAME: UCN_TOKEN,
    }


def _enmascarar_headers(headers: Dict[str, str]) -> Dict[str, str]:
    headers_enmascarados = {}

    for key, value in headers.items():
        key_lower = key.lower()

        if (
            key_lower in {"authorization", "cookie"}
            or (UCN_HEADER_NAME and key_lower == UCN_HEADER_NAME.lower())
        ):
            headers_enmascarados[key] = f"<masked len={len(value)}>"
        else:
            headers_enmascarados[key] = value

    return headers_enmascarados


def _enmascarar_url(url: str) -> str:
    partes = urlsplit(url)
    query_params = []

    for key, value in parse_qsl(partes.query, keep_blank_values=True):
        if key.lower() in QUERY_KEYS_SENSIBLES:
            query_params.append((key, "<masked>"))
        else:
            query_params.append((key, value))

    return urlunsplit(
        (
            partes.scheme,
            partes.netloc,
            partes.path,
            urlencode(query_params),
            partes.fragment,
        )
    )


def _url_sin_query_params(base: str, claves: Iterable[str]) -> str:
    partes = urlsplit(base.strip())
    claves_normalizadas = {clave.lower() for clave in claves}
    query_params = [
        (key, value)
        for key, value in parse_qsl(partes.query, keep_blank_values=True)
        if key and key.lower() not in claves_normalizadas
    ]

    return urlunsplit(
        (
            partes.scheme,
            partes.netloc,
            partes.path,
            urlencode(query_params),
            partes.fragment,
        )
    )


def _agregar_url_unica(urls: List[str], url: str) -> None:
    if url not in urls:
        urls.append(url)


def _url_con_period_param(base: str, periodo: str, asegurar_slash: bool) -> str:
    partes = urlsplit(base)
    path = partes.path

    if asegurar_slash and not path.endswith("/"):
        path = f"{path}/"

    query_params = [
        (key, value)
        for key, value in parse_qsl(partes.query, keep_blank_values=True)
        if key and key.lower() != "period"
    ]
    query_params.append(("period", periodo))

    return urlunsplit(
        (
            partes.scheme,
            partes.netloc,
            path,
            urlencode(query_params),
            partes.fragment,
        )
    )


def _url_con_period_legacy(base: str, periodo: str, asegurar_slash: bool) -> str:
    partes = urlsplit(base)
    path = partes.path

    if asegurar_slash and not path.endswith("/"):
        path = f"{path}/"

    return urlunsplit((partes.scheme, partes.netloc, path, periodo, partes.fragment))


def _construir_urls_estudiantes(periodo: str) -> List[str]:

    base = (URL_ESTUDIANTES).strip()
    urls: List[str] = []

    if "{periodo}" in base:
        _agregar_url_unica(urls, base.format(periodo=periodo))
        return urls

    _agregar_url_unica(urls, _url_con_period_param(base, periodo, asegurar_slash=True))
    _agregar_url_unica(urls, _url_con_period_param(base, periodo, asegurar_slash=False))
    _agregar_url_unica(urls, _url_con_period_legacy(base, periodo, asegurar_slash=False))
    _agregar_url_unica(urls, _url_con_period_legacy(base, periodo, asegurar_slash=True))

    return urls


def _construir_url_estudiantes(periodo: str) -> str:
    return _construir_urls_estudiantes(periodo)[0]


def _normalizar_lista_estudiantes(data: Any) -> List[Dict[str, Any]]:

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        if isinstance(data.get("estudiantes"), list):
            return data["estudiantes"]

        if isinstance(data.get("data"), list):
            return data["data"]

        if data.get("rut"):
            return [data]

    raise RuntimeError("La respuesta de estudiantes no tiene el formato esperado.")


async def obtener_todos_los_estudiantes(periodo: str = "202520") -> List[Dict[str, Any]]:
    urls = _construir_urls_estudiantes(periodo)

    timeout = httpx.Timeout(60.0, connect=15.0)
    errores = []
    respuesta_vacia = False

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for url in urls:
            response = await client.post(
                url,
                headers=_headers_ucn(),
                json={},
            )

            try:
                response.raise_for_status()
                data = response.json()
                estudiantes = _normalizar_lista_estudiantes(data)
            except Exception as e:
                errores.append(
                    f"{_enmascarar_url(url)} -> status {response.status_code}: {response.text[:300]} ({type(e).__name__})"
                )
                continue

            if estudiantes:
                return estudiantes

            respuesta_vacia = True

    if respuesta_vacia:
        raise RuntimeError(
            "La API UCN respondio 200 OK, pero devolvio 0 estudiantes para todos los formatos de URL probados."
        )

    raise RuntimeError(
        "No se pudo obtener estudiantes desde UCN. "
        f"Errores: {' | '.join(errores)}"
    )


async def diagnosticar_estudiantes(periodo: str = "202520") -> Dict[str, Any]:
    urls = _construir_urls_estudiantes(periodo)
    headers = _headers_ucn()
    timeout = httpx.Timeout(60.0, connect=15.0)
    resultados = []

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        for url in urls:
            response = await client.post(url, headers=headers, json={})

            try:
                data = response.json()
                tipo = type(data).__name__
                estudiantes = _normalizar_lista_estudiantes(data)
                longitud = len(estudiantes)
                primer_elemento = estudiantes[0] if estudiantes else None
                texto_crudo = None
            except ValueError:
                tipo = "no_json"
                longitud = None
                primer_elemento = None
                texto_crudo = response.text[:500]
            except RuntimeError:
                tipo = "json_formato_no_soportado"
                longitud = None
                primer_elemento = None
                texto_crudo = response.text[:500]

            resultados.append(
                {
                    "url_final": _enmascarar_url(str(response.url)),
                    "status": response.status_code,
                    "tipo_de_dato": tipo,
                    "longitud": longitud,
                    "primer_elemento": primer_elemento,
                    "texto_crudo": texto_crudo,
                    "redirects": [
                        {
                            "status": redirect.status_code,
                            "url": _enmascarar_url(str(redirect.url)),
                            "location": _enmascarar_url(redirect.headers.get("location", "")),
                        }
                        for redirect in response.history
                    ],
                }
            )

    return {
        "headers_enviados": _enmascarar_headers(headers),
        "resultados": resultados,
        "mejor_resultado": next(
            (resultado for resultado in resultados if (resultado.get("longitud") or 0) > 0),
            resultados[0] if resultados else None,
        ),
    }


async def obtener_catalogo_asignaturas():
    """
    GET a asignaturas.
    Se mantiene como lo tenías, porque dijiste que ramos ya se rellena bien.
    """
    if not URL_ASIGNATURAS:
        raise RuntimeError("Falta UCN_URL_ASIGNATURAS en el archivo .env")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(URL_ASIGNATURAS)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"No fue posible obtener asignaturas desde UCN. Status {e.response.status_code}."
        ) from e
    except httpx.HTTPError as e:
        raise RuntimeError("No fue posible conectar con el servicio UCN de asignaturas.") from e


async def obtener_ramos_profesor(rut_profesor: str):
    if not URL_PROFESORES:
        raise RuntimeError("Falta UCN_URL_PROFESORES en el archivo .env")

    rut_limpio = rut_profesor.strip()

    if not rut_limpio:
        raise RuntimeError("RUT de profesor requerido.")

    url_base = _url_sin_query_params(URL_PROFESORES, {"rut"})

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(
                url_base,
                headers=_headers_ucn(),
                params={"rut": rut_limpio},
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"No fue posible obtener ramos del profesor desde UCN. Status {e.response.status_code}."
        ) from e
    except httpx.HTTPError as e:
        raise RuntimeError("No fue posible conectar con el servicio UCN de profesores.") from e