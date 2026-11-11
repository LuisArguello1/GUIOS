"""
Sugerencia manual de calificaciones para los subfactores del factor en pantalla.

No forma parte de la búsqueda de literatura. El usuario la pide en el paso 2
y el modelo solo ve los criterios de ese factor.
"""

import json
from typing import Any

FACTOR_RATINGS_MAX_TOKENS = 4096


def build_factor_ratings_prompts(
    *,
    software_name: str,
    software_category: str,
    software_description: str,
    org_sector: str,
    org_description: str,
    factor_name: str,
    subfactors: list[dict[str, Any]],
) -> tuple[str, str]:
    """Arma el sistema y el mensaje para calificar solo el factor activo."""
    criteria_json = json.dumps(
        [
            {"subfactor_id": int(item["id"]), "description": item.get("description", "")}
            for item in subfactors
        ],
        ensure_ascii=False,
        indent=2,
    )
    system_prompt = (
        "Eres un auditor técnico de software libre bajo el marco GUIOS. "
        "Calificas únicamente los subfactores del factor que te entregan. "
        "La justificación va en español. No uses inglés. "
        "Responde únicamente un objeto JSON válido."
    )
    user_prompt = f"""
SOFTWARE CANDIDATO:
- Nombre: {software_name}
- Categoría: {software_category or "General"}
- Descripción: {software_description or "Software de código abierto"}

ORGANIZACIÓN:
- Sector: {org_sector or "No especificado"}
- Necesidad: {org_description or "No especificada"}

FACTOR ACTIVO: {factor_name}

SUBFACTORES DE ESTE FACTOR:
{criteria_json}

Escala:
1: No cumple el requisito
2: Desconozco si cumple el requisito
3: Cumple parcialmente el requisito
4: Cumple el requisito
Usa 2 solo cuando de verdad no haya base para juzgar el criterio en este software.
La justificación va en español, en una o dos frases, con un hecho del software. Máximo 40 palabras. No uses inglés.
No dejes ningún subfactor de la lista sin nota.

RESPONDE ÚNICAMENTE ESTE JSON:
{{
  "ratings": [
    {{
      "subfactor_id": 1,
      "rating": 3,
      "justification": "El software cubre una parte del criterio y deja otra pendiente."
    }}
  ]
}}
"""
    return system_prompt, user_prompt


def map_factor_ratings_response(
    data: dict[str, Any] | None,
    known_ids: set[int],
) -> dict[int, dict[str, Any]]:
    """Conserva solo notas 1-4 de los subfactores pedidos, con justificación."""
    ratings: dict[int, dict[str, Any]] = {}
    raw_items = (data or {}).get("ratings") or []
    if not isinstance(raw_items, list):
        raise ValueError("La respuesta no trae la lista de calificaciones.")

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        try:
            subfactor_id = int(item.get("subfactor_id") or item.get("id"))
            rating = int(item.get("rating") or item.get("suggested_rating"))
        except (TypeError, ValueError):
            continue
        justification = str(item.get("justification") or "").strip()
        if subfactor_id not in known_ids or rating < 1 or rating > 4 or len(justification) < 8:
            continue
        ratings[subfactor_id] = {"rating": rating, "justification": justification}

    if not ratings:
        raise ValueError("La respuesta no trajo calificaciones utilizables para este factor.")
    return ratings
