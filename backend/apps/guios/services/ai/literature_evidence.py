"""
Prompt y mapeo de literatura para la Fase 2.

Integra artículos científicos recuperados de OpenAlex con DOI para fundamentación
académica verídica. Si no se dispone de literatura de OpenAlex (fallback),
emplea los criterios de consistencia generales.
El modelo no estima un conteo. Mapea fuentes identificables y el sistema
cuenta cuántas de esas fuentes sustentan cada subfactor.
"""

import json
import re
from typing import Any
from urllib.parse import urlparse

from apps.guios.services.literature.openalex import clean_doi

# Cabe el mapeo bibliográfico y una calificación breve por subfactor del bloque.
LITERATURE_MAX_TOKENS = 4096
DOI_PATTERN = re.compile(r"^10\.\d{4,9}/\S+$", re.IGNORECASE)
PLACEHOLDER_HOSTS = {
    "example.com",
    "example.org",
    "ejemplo.com",
    "ejemplo.org",
    "localhost",
}
PLACEHOLDER_TITLES = {
    "titulo del estudio o documentacion tecnica",
    "título del estudio o documentación técnica",
}
BACKFILL_MIN_HITS = 2
BACKFILL_STOPWORDS = {
    "software", "sistema", "sistemas", "soporte", "gestion", "gestión",
    "datos", "usuario", "usuarios", "permite", "mediante", "traves", "través",
    "este", "esta", "estos", "estas", "para", "como", "con", "los", "las",
    "del", "una", "uno", "open", "source", "server", "system", "sobre",
    "entre", "desde", "hacia", "donde", "cuando", "puede", "pueden",
}


def build_literature_prompts(
    *,
    software_name: str,
    software_category: str,
    software_repo_url: str | None,
    software_description: str,
    org_sector: str,
    org_description: str,
    subfactors_data: list[dict[str, Any]],
    academic_works: list[dict[str, Any]] | None = None,
) -> tuple[str, str]:
    """Arma el sistema y el mensaje de usuario para el mapeo bibliográfico.

    Enfoque A: el mapeo de citas depende estrictamente del software candidato
    y de los artículos recuperados para garantizar consistencia entre organizaciones.
    """
    del org_sector, org_description
    subfactors_prompt_list = [
        {
            "id": subfactor["id"],
            "factor_id": subfactor["factor_id"],
            "factor_name": subfactor.get("factor_name", ""),
            "description": subfactor["description"],
            "keywords": subfactor.get("keywords_ia", ""),
        }
        for subfactor in subfactors_data
    ]
    factors_prompt_list = []
    seen_factors: set[int] = set()
    for subfactor in subfactors_data:
        factor_id = int(subfactor["factor_id"])
        if factor_id in seen_factors:
            continue
        seen_factors.add(factor_id)
        factors_prompt_list.append({
            "factor_id": factor_id,
            "factor_name": subfactor.get("factor_name", ""),
        })

    valid_academic_works = [
        {
            "doi": clean_doi(w.get("doi")),
            "title": w.get("title", ""),
            "venue": w.get("venue_name", ""),
            "year": w.get("publication_year", 0),
            "abstract": (w.get("abstract") or "")[:360],
        }
        for w in (academic_works or [])
        if clean_doi(w.get("doi"))
    ]

    system_prompt = (
        "Eres un revisor de la guía GUIOS para adopción de software libre (FLOSS). "
        "Tu única tarea es mapear publicaciones reales a los subfactores. "
        "No estimas, no redondeas y no inventas un número de citas. "
        "No calificas el cumplimiento ni propones la importancia del decisor. "
        "Si no puedes identificar una publicación concreta, no la incluyas. "
        "Todos los textos libres van en español, aunque el software tenga nombre en inglés. No uses inglés. "
        "Responde únicamente un objeto JSON válido."
    )

    if valid_academic_works:
        works_instructions = f"""
ARTÍCULOS CIENTÍFICOS DISPONIBLES (Recuperados de OpenAlex con DOI):
{json.dumps(valid_academic_works, ensure_ascii=False, indent=2)}

QUÉ DEBES HACER RESPECTO A LAS FUENTES (SOURCES):
1. Tienes arriba la lista de artículos científicos verificados con DOI para este software.
2. Recorre TODA la lista de artículos, no una muestra. Un mismo artículo puede respaldar varios subfactores si el abstract toca varios criterios (arquitectura, formación, adopción, seguridad, implantación).
3. Asigna cada artículo relevante a TODOS los subfactores que sustente. No te detengas al llegar a unas pocas fuentes.
4. Por cada coincidencia, crea un objeto en "sources" con:
   - "subfactor_id": ID del subfactor respaldado.
   - "factor_id": ID del factor al que pertenece.
   - "doi": el DOI EXACTO del artículo (ej. "10.4018/ijsppc.2020070104").
   - "title": el título EXACTO de dicho artículo.
   - "url": "https://doi.org/" + doi
   - "snippet": explicación breve en español (1 o 2 frases) de qué afirma el abstract que valida este criterio para {software_name}. No uses inglés.
5. ESTRICTAMENTE PROHIBIDO: Inventar DOIs, inventar artículos o citar páginas que no pertenezcan a la lista de artículos verificados provista.
6. Si ningún artículo disponible aborda un subfactor determinado, NO generes fuentes para ese subfactor (omítelo en "sources"). No inventes fuentes.
"""
    else:
        works_instructions = """
QUÉ DEBES HACER:
1. Recorre todos los subfactores de esta lista, no solo los primeros.
2. Para cada uno, busca una evidencia identificable: artículo, caso de migración, reporte técnico, guía oficial o documentación del proyecto.
3. Asocia la evidencia solo si su contenido respalda ese enunciado para este software.
4. Una evidencia puede mapearse a varios subfactores, pero cada asociación va en un objeto distinto.
5. Si no hay evidencia identificable, omite ese subfactor. No inventes el resto.

UNA FUENTE ES VÁLIDA SOLO SI CUMPLE TODO ESTO:
- title es el título real de la obra, no un ejemplo.
- url empieza por http:// o https:// y apunta a un sitio real, o doi tiene forma 10.xxxx/xxxxx.
- si no conoces el DOI, déjalo vacío. Nunca escribas None, null ni N/A.
- snippet explica, en español y en una o dos frases, qué fragmento de esa obra respalda ese subfactor para este software. No uses inglés.
- subfactor_id y factor_id existen en la lista de arriba.
"""

    user_prompt = f"""
SOFTWARE CANDIDATO:
- Nombre: {software_name}
- Categoría: {software_category or "General"}
- Repositorio o sitio: {software_repo_url or "No especificado"}
- Descripción: {software_description or "Software de código abierto"}

CRITERIO DE CONSISTENCIA BIBLIOGRÁFICA:
Evalúa únicamente las capacidades técnicas, madurez y evidencia publicada sobre {software_name}. No adaptes ni filtres las citas científicas según una organización particular.

FACTORES:
{json.dumps(factors_prompt_list, ensure_ascii=False, indent=2)}

SUBFACTORES DEL CATÁLOGO:
{json.dumps(subfactors_prompt_list, ensure_ascii=False, indent=2)}

{works_instructions}

PROHIBIDO:
- Inventar citations_count, totales o estimaciones.
- Usar example.com, ejemplo.org o DOI de muestra.
- Citar una obra que no puedas nombrar.
- Incluir calificaciones de subfactores o importancia del decisor. Eso se pide aparte.

RESPONDE ÚNICAMENTE ESTE JSON:
{{
  "sources": [
    {{
      "subfactor_id": 1,
      "factor_id": 1,
      "title": "Título real de la publicación",
      "url": "https://doi.org/10.1234/ejemplo.real",
      "doi": "10.1234/ejemplo.real",
      "snippet": "La obra aborda este criterio para el software candidato porque..."
    }}
  ]
}}
Si no hay evidencias identificables, "sources" va vacío.
"""
    return system_prompt, user_prompt


def map_literature_response(
    data: dict[str, Any] | None,
    subfactors_data: list[dict[str, Any]],
    academic_works: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Cuenta citas por subfactor a partir de fuentes válidas.
    Si se proporcionaron academic_works de OpenAlex, valida que las fuentes
    correspondan a los DOIs verificados de OpenAlex, descartando alucinaciones.
    El campo citations_count que envíe el modelo se ignora.
    """
    known_factors = {
        int(subfactor["id"]): int(subfactor["factor_id"])
        for subfactor in subfactors_data
    }
    descriptions = {
        int(subfactor["id"]): str(subfactor.get("description") or "").strip()
        for subfactor in subfactors_data
    }
    citations_by_subfactor = {subfactor_id: 0 for subfactor_id in known_factors}
    sources_by_factor: dict[int, list[dict[str, str]]] = {}
    seen: set[tuple[int, str]] = set()

    known_works_by_doi: dict[str, dict[str, Any]] = {}
    for w in (academic_works or []):
        doi_clean = clean_doi(w.get("doi")).lower()
        if doi_clean:
            known_works_by_doi[doi_clean] = w

    openalex_verified_count = 0

    for source in (data or {}).get("sources", []):
        if not isinstance(source, dict):
            continue
        try:
            subfactor_id = int(source.get("subfactor_id"))
        except (TypeError, ValueError):
            continue
        if subfactor_id not in known_factors:
            continue

        title = str(source.get("title", "")).strip()
        url = str(source.get("url", "")).strip()
        doi = _blank_if_missing(str(source.get("doi", "")))
        snippet = str(source.get("snippet", "")).strip()

        cleaned_doi = clean_doi(doi)

        if known_works_by_doi:
            matched_work = known_works_by_doi.get(cleaned_doi.lower())
            if not matched_work:
                # El modelo intentó generar un DOI o URL que no está en la lista de OpenAlex.
                # Se descarta para garantizar 100% veracidad académica.
                continue
            doi = matched_work.get("doi") or cleaned_doi
            title = matched_work.get("title") or title
            url = matched_work.get("doi_url") or f"https://doi.org/{doi}"
            openalex_verified_count += 1
        else:
            if not _is_real_source(title, url, doi, snippet):
                continue

        identity = doi.lower() if _is_real_doi(doi) else url.lower()
        marker = (subfactor_id, identity)
        if marker in seen:
            continue
        seen.add(marker)

        factor_id = known_factors[subfactor_id]
        citations_by_subfactor[subfactor_id] += 1
        sources_by_factor.setdefault(factor_id, []).append({
            "subfactor_id": subfactor_id,
            "subfactor_description": descriptions.get(subfactor_id, ""),
            "match_origin": "model",
            "title": title,
            "url": url,
            "snippet": snippet,
            "doi": doi,
        })

    if known_works_by_doi:
        added = _backfill_openalex_works(
            academic_works or [],
            subfactors_data,
            known_factors,
            citations_by_subfactor,
            sources_by_factor,
            seen,
        )
        openalex_verified_count += added

    evidence_origin = "openalex" if openalex_verified_count > 0 else ("catalog_baseline" if known_works_by_doi else "model")

    return {
        "citations_by_subfactor": citations_by_subfactor,
        "sources_by_factor": sources_by_factor,
        "ratings_by_subfactor": _map_ratings(data, known_factors),
        "importance_by_factor": _map_importances(data, set(known_factors.values())),
        "evidence_origin": evidence_origin,
    }


def _content_tokens(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9]{4,}", (text or "").lower())
    return {token for token in tokens if token not in BACKFILL_STOPWORDS}


def _backfill_openalex_works(
    academic_works: list[dict[str, Any]],
    subfactors_data: list[dict[str, Any]],
    known_factors: dict[int, int],
    citations_by_subfactor: dict[int, int],
    sources_by_factor: dict[int, list[dict[str, str]]],
    seen: set[tuple[int, str]],
) -> int:
    """
    Cuenta los artículos de OpenAlex que el modelo no alcanzó a listar,
    solo cuando el título o el abstract coinciden con el criterio.
    """
    added = 0
    for work in academic_works:
        doi = clean_doi(work.get("doi"))
        if not doi:
            continue
        identity = doi.lower()
        text = f"{work.get('title', '')} {work.get('abstract', '')}"
        work_tokens = _content_tokens(text)
        if not work_tokens:
            continue
        title = str(work.get("title") or "").strip()
        url = str(work.get("doi_url") or f"https://doi.org/{doi}")

        for subfactor in subfactors_data:
            try:
                subfactor_id = int(subfactor["id"])
            except (TypeError, ValueError):
                continue
            if subfactor_id not in known_factors or (subfactor_id, identity) in seen:
                continue
            keywords = _content_tokens(str(subfactor.get("keywords_ia") or ""))
            description = _content_tokens(str(subfactor.get("description") or ""))
            keyword_hits = keywords & work_tokens
            description_hits = description & work_tokens
            hits = keyword_hits | description_hits
            # Una sola palabra suelta ("linux", "api") no basta para atribuir un artículo.
            if len(hits) < BACKFILL_MIN_HITS:
                continue

            matched = ", ".join(sorted(hits)[:6])
            snippet = (
                "Coincidencia automática por palabras clave del criterio "
                f"({matched}). No fue validada por el modelo; revise el resumen en el DOI."
            )

            seen.add((subfactor_id, identity))
            factor_id = known_factors[subfactor_id]
            citations_by_subfactor[subfactor_id] += 1
            sources_by_factor.setdefault(factor_id, []).append({
                "subfactor_id": subfactor_id,
                "subfactor_description": str(subfactor.get("description") or "").strip(),
                "match_origin": "keyword_backfill",
                "title": title,
                "url": url,
                "snippet": snippet,
                "doi": doi,
            })
            added += 1
    return added


def _map_ratings(
    data: dict[str, Any] | None,
    known_factors: dict[int, int],
) -> dict[int, dict[str, Any]]:
    """Conserva solo notas 1-4 con una justificación utilizable."""
    ratings: dict[int, dict[str, Any]] = {}
    raw_items = (data or {}).get("ratings") or (data or {}).get("subfactor_ratings") or []
    if not isinstance(raw_items, list):
        return ratings

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        try:
            subfactor_id = int(item.get("subfactor_id") or item.get("id"))
            rating = int(item.get("rating") or item.get("suggested_rating"))
        except (TypeError, ValueError):
            continue
        if subfactor_id not in known_factors or rating < 1 or rating > 4:
            continue
        justification = str(item.get("justification") or item.get("justificacion") or "").strip()
        if len(justification) < 12:
            continue
        ratings[subfactor_id] = {
            "rating": rating,
            "justification": justification[:1200],
        }
    return ratings


def _map_importances(
    data: dict[str, Any] | None,
    known_factor_ids: set[int],
) -> dict[int, dict[str, Any]]:
    """Conserva la importancia del decisor sugerida para cada factor del bloque."""
    importances: dict[int, dict[str, Any]] = {}
    raw_items = (data or {}).get("importances") or (data or {}).get("factor_importances") or []
    if not isinstance(raw_items, list):
        return importances

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        try:
            factor_id = int(item.get("factor_id") or item.get("id"))
            suggested_id = int(item.get("suggested_id") or item.get("suggested_ID") or item.get("rating"))
        except (TypeError, ValueError):
            continue
        if factor_id not in known_factor_ids or suggested_id < 1 or suggested_id > 4:
            continue
        justification = str(item.get("justification") or item.get("justificacion") or "").strip()
        if len(justification) < 12:
            continue
        importances[factor_id] = {
            "suggested_id": suggested_id,
            "justification": justification[:1200],
        }
    return importances


def _blank_if_missing(value: str) -> str:
    cleaned = value.strip()
    if cleaned.casefold() in {"", "none", "null", "n/a", "na", "undefined"}:
        return ""
    return cleaned


def _is_real_source(title: str, url: str, doi: str, snippet: str) -> bool:
    if len(title) < 8 or len(snippet) < 12:
        return False
    if title.casefold() in PLACEHOLDER_TITLES:
        return False
    return _is_real_url(url) or _is_real_doi(doi)


def _is_real_url(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    host = parsed.netloc.lower().split(":")[0]
    if host.startswith("www."):
        host = host[4:]
    return host not in PLACEHOLDER_HOSTS


def _is_real_doi(doi: str) -> bool:
    cleaned = doi.strip()
    if cleaned.lower().startswith("https://doi.org/"):
        cleaned = cleaned.split("doi.org/", 1)[1]
    if cleaned == "10.1016/j.jss.2024.0001":
        return False
    return bool(DOI_PATTERN.match(cleaned))
