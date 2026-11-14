"""
apps/guios/services/literature/openalex.py
───────────────────────────────────────────────────────────────────────────────
Cliente para la API de OpenAlex (https://api.openalex.org).
Recupera publicaciones científicas con DOI, título, revista y abstract
reconstruido para la fundamentación de evaluaciones GUIOS.
Usa el Polite Pool gratuito (hasta 100,000 peticiones/día a 10 req/s).
"""
import logging
import re
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import quote

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

OPENALEX_DEFAULT_API_URL = "https://api.openalex.org/works"
DOI_CLEAN_REGEX = re.compile(r"^https?://(?:dx\.)?doi\.org/", re.IGNORECASE)


@dataclass(frozen=True)
class AcademicWork:
    openalex_id: str
    doi: str
    doi_url: str
    title: str
    publication_year: int
    venue_name: str
    cited_by_count: int
    abstract: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def reconstruct_abstract(inverted_index: dict[str, list[int]] | None) -> str:
    """
    Convierte el formato abstract_inverted_index de OpenAlex a texto continuo.
    OpenAlex indexa palabras como {"word": [pos1, pos2, ...]}.
    """
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""

    positions = [pos for pos_list in inverted_index.values() if isinstance(pos_list, list) for pos in pos_list]
    if not positions:
        return ""

    max_pos = max(positions)
    words = [""] * (max_pos + 1)
    for word, pos_list in inverted_index.items():
        if isinstance(pos_list, list):
            for pos in pos_list:
                if 0 <= pos <= max_pos:
                    words[pos] = word

    return " ".join(filter(None, words)).strip()


DESCRIPTOR_WORDS = {
    "community", "enterprise", "server", "edition", "ce", "ee", "oss",
    "core", "platform", "plataforma", "database", "db", "erp", "crm",
    "lms", "cms", "bi", "system", "sistema", "software", "suite",
}


def extract_root_software_name(software_name: str) -> str:
    """Extrae el término raíz de la marca de software descartando descriptores comunes."""
    tokens = [t for t in re.split(r"[\s\-_/]+", (software_name or "").strip()) if t]
    root_tokens = [t for t in tokens if t.lower() not in DESCRIPTOR_WORDS]
    if root_tokens:
        return " ".join(root_tokens)
    return (software_name or "").strip()


def mentions_software(text: str, software_name: str) -> bool:
    """
    True si el texto menciona el software como palabra completa.
    Evita falsos positivos de nombres cortos ("Go" dentro de "good", "R" dentro de "for").
    """
    term = (software_name or "").strip()
    if not term or not text:
        return False
    pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
    return re.search(pattern, text, re.IGNORECASE) is not None


def clean_doi(raw_doi: str | None) -> str:
    """Extrae el DOI sin el prefijo https://doi.org/."""
    if not raw_doi:
        return ""
    cleaned = str(raw_doi).strip()
    return DOI_CLEAN_REGEX.sub("", cleaned).strip()


class OpenAlexClient:
    """
    Cliente HTTP para OpenAlex con soporte de reintentos, fallback de búsqueda
    y decodificación de metadatos académicos.
    """

    def __init__(
        self,
        api_url: str | None = None,
        mailto: str | None = None,
        timeout_seconds: int | None = None,
        api_key: str | None = None,
        year_from: int | None = None,
        year_to: int | None = None,
    ):
        self.api_url = api_url or getattr(settings, "OPENALEX_API_URL", OPENALEX_DEFAULT_API_URL)
        default_email = getattr(settings, "DEFAULT_FROM_EMAIL", "soporte@guios.org")
        self.mailto = mailto or getattr(settings, "OPENALEX_MAILTO", default_email)
        self.timeout_seconds = timeout_seconds or getattr(settings, "OPENALEX_TIMEOUT_SECONDS", 15)
        self.api_key = api_key or getattr(settings, "OPENALEX_API_KEY", "")
        self.year_from = year_from if year_from is not None else int(getattr(settings, "OPENALEX_YEAR_FROM", 2020))
        self.year_to = year_to if year_to is not None else int(getattr(settings, "OPENALEX_YEAR_TO", 2025))

    def search_works(
        self,
        software_name: str,
        category: str = "",
        limit: int | None = None,
    ) -> list[AcademicWork]:
        """
        Busca publicaciones científicas relevantes en OpenAlex para un software.
        Aplica búsqueda primaria contextual y fallback si no hay suficientes resultados,
        extrayendo la raíz del software y validando relevancia de títulos y abstracts.
        """
        clean_name = (software_name or "").strip()
        if not clean_name or len(clean_name) < 2:
            return []

        effective_limit = limit or getattr(settings, "OPENALEX_MAX_RESULTS", 80)
        root_name = extract_root_software_name(clean_name)

        combined: list[AcademicWork] = []
        seen_dois: set[str] = set()

        def _add_works(items: list[AcademicWork]):
            for item in items:
                doi_norm = item.doi.lower()
                if doi_norm in seen_dois:
                    continue
                content_to_check = f"{item.title} {item.abstract}"
                if not mentions_software(content_to_check, root_name) and not mentions_software(
                    content_to_check, clean_name
                ):
                    continue
                seen_dois.add(doi_norm)
                combined.append(item)
                if len(combined) >= effective_limit:
                    break

        # 1. Búsqueda primaria orientada a adopción / FLOSS / evaluación con nombre completo
        primary_query = f'"{clean_name}"'
        if category and category.lower() not in {"general", "otro", "otra"}:
            primary_query += f" AND ({category} OR adoption OR evaluation OR software)"
        _add_works(self._execute_query(search_query=primary_query, limit=effective_limit))

        # 2. Si faltan obras y el nombre raíz es distinto, buscar con el nombre raíz y contexto
        if len(combined) < effective_limit and root_name.lower() != clean_name.lower():
            root_context_query = f'"{root_name}"'
            if category and category.lower() not in {"general", "otro", "otra"}:
                root_context_query += f" AND ({category} OR adoption OR evaluation OR software)"
            _add_works(self._execute_query(search_query=root_context_query, limit=effective_limit))

        # 3. Búsqueda directa por nombre raíz si aún hay margen
        if len(combined) < effective_limit:
            _add_works(self._execute_query(search_query=f'"{root_name}"', limit=effective_limit))

        # 4. Búsqueda unquoted de contingencia por raíz (solo si las etapas entrecomilladas no reunieron base suficiente con abstract)
        quoted_with_abstract = sum(1 for item in combined if item.abstract.strip())
        if len(combined) < effective_limit and quoted_with_abstract < min(effective_limit, 10):
            _add_works(self._execute_query(search_query=root_name, limit=effective_limit))

        return combined[:effective_limit]

    def _execute_query(self, search_query: str, limit: int) -> list[AcademicWork]:
        """Ejecuta una petición GET a la API de OpenAlex con Polite Pool."""
        headers = {
            "User-Agent": f"GUIOS-Academic-Client/1.0 (mailto:{self.mailto})",
            "Accept": "application/json",
        }
        collected: list[dict[str, Any]] = []
        page = 1
        page_size = max(1, min(limit, 100))

        try:
            with httpx.Client(timeout=float(self.timeout_seconds)) as client:
                while len(collected) < limit and page <= 4:
                    params = {
                        "search": search_query,
                        "filter": (
                            f"has_doi:true,is_paratext:false,is_retracted:false,"
                            f"publication_year:{self.year_from}-{self.year_to}"
                        ),
                        "sort": "relevance_score:desc",
                        "per-page": page_size,
                        "page": page,
                        "mailto": self.mailto,
                    }
                    if self.api_key:
                        params["api_key"] = self.api_key
                    response = client.get(self.api_url, params=params, headers=headers)
                    if response.status_code != 200:
                        logger.warning(
                            "OpenAlex API respondió status %s para query '%s': %s",
                            response.status_code,
                            search_query,
                            response.text[:200],
                        )
                        break

                    results = (response.json() or {}).get("results") or []
                    if not results:
                        break
                    collected.extend(results)
                    if len(results) < page_size:
                        break
                    page += 1

                return self._parse_results(collected)[:limit]

        except Exception as exc:
            logger.warning(
                "Error de conexión al consultar OpenAlex para query '%s': %s",
                search_query,
                exc,
            )
            return []

    def _parse_results(self, raw_items: list[dict[str, Any]]) -> list[AcademicWork]:
        """Convierte los registros JSON de OpenAlex en objetos AcademicWork validados."""
        works: list[AcademicWork] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue

            raw_doi = item.get("doi")
            doi = clean_doi(raw_doi)
            if not doi:
                continue

            title = str(item.get("title") or "").strip()
            if len(title) < 5:
                continue

            try:
                year = int(item.get("publication_year") or 0)
            except (TypeError, ValueError):
                continue
            if year < self.year_from or year > self.year_to:
                continue

            # Obtener venue o nombre de la revista/conferencia
            primary_loc = item.get("primary_location") or {}
            source_obj = primary_loc.get("source") or {}
            venue_name = str(source_obj.get("display_name") or "").strip()

            # Reconstruir abstract
            abstract = reconstruct_abstract(item.get("abstract_inverted_index"))

            cited_by = item.get("cited_by_count") or 0
            openalex_id = str(item.get("id") or "")

            work = AcademicWork(
                openalex_id=openalex_id,
                doi=doi,
                doi_url=f"https://doi.org/{doi}",
                title=title,
                publication_year=year,
                venue_name=venue_name,
                cited_by_count=int(cited_by),
                abstract=abstract,
            )
            works.append(work)

        return works

