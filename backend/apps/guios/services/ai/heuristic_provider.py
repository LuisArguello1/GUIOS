"""
apps/guios/services/ai/heuristic_provider.py
───────────────────────────────────────────────────────────────────────────────
Piso local de GUIOS. Si las tres APIs fallan, la evaluación sigue con el
conteo base del catálogo de la tesis. No inventa artículos ni multiplica citas.
"""
from typing import Any
from .base import BaseAIProvider
from .verdict_narrative import build_predetermined_narrative

CATALOG_ORIGIN = "catalog_baseline"
LOCAL_NOTICE = "Contingencia local GUIOS, sin modelo externo."


class HeuristicAIProvider(BaseAIProvider):
    """
    Proveedor determinista. Reproduce el baseline del catálogo y lo etiqueta
    para que no se confunda con una respuesta de un modelo.
    """

    def search_literature_and_citations(
        self,
        software_name: str,
        software_category: str,
        software_repo_url: str | None,
        software_description: str,
        subfactors_data: list[dict[str, Any]],
        org_sector: str = "",
        org_description: str = "",
        academic_works: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Usa base_citations_count tal como está en el catálogo.
        Las fuentes quedan vacías: un DOI fijo no es evidencia bibliográfica.
        """
        del software_name, software_category, software_repo_url, software_description, org_sector, org_description, academic_works
        citations_by_subfactor: dict[int, int] = {}

        for subfactor in subfactors_data:
            raw_count = subfactor.get("base_citations_count", 0) or 0
            try:
                citations_by_subfactor[subfactor["id"]] = max(0, int(raw_count))
            except (TypeError, ValueError):
                citations_by_subfactor[subfactor["id"]] = 0

        return {
            "citations_by_subfactor": citations_by_subfactor,
            "sources_by_factor": {},
            "ratings_by_subfactor": {},
            "importance_by_factor": {},
            "provider_info": "Catálogo base GUIOS (contingencia local, sin fuentes inventadas)",
            "evidence_origin": CATALOG_ORIGIN,
        }

    def suggest_factor_importance(
        self,
        factor_name: str,
        factor_scope: str,
        is_suggested: int,
        org_sector: str,
        org_description: str,
        software_name: str,
    ) -> dict[str, Any]:
        """
        Sugiere ID preservando como baseline el IS con justificación institucional.
        """
        del org_sector, org_description
        suggested_id = max(1, min(4, int(is_suggested)))
        scope_lbl = "interno" if factor_scope == "internal" else "externo"
        justification = (
            f"{LOCAL_NOTICE} Se conserva la importancia sugerida por el catálogo (IS {suggested_id}/4) "
            f"para el factor '{factor_name}' ({scope_lbl}) del software '{software_name}'. "
            f"El decisor debe confirmar este valor."
        )
        return {
            "suggested_id": suggested_id,
            "justification": justification,
            "evidence_origin": CATALOG_ORIGIN,
        }

    def suggest_subfactor_rating(
        self,
        subfactor_description: str,
        factor_name: str,
        software_name: str,
        software_category: str,
        software_description: str,
    ) -> dict[str, Any]:
        """
        Sugiere calificación conservadora (3: Cumple parcialmente o 4: Cumple) según descripción.
        """
        del software_description
        suggested_rating = 3
        justification = (
            f"{LOCAL_NOTICE} No hay una calificación de modelo para '{software_name}' "
            f"({software_category or 'General'}) en el factor '{factor_name}'. "
            f"Se propone 3 (cumple parcialmente) para '{subfactor_description[:100]}' "
            f"y debe verificarse en una instalación piloto."
        )
        return {
            "suggested_rating": suggested_rating,
            "justification": justification,
            "evidence_origin": CATALOG_ORIGIN,
        }

    def suggest_factor_ratings(
        self,
        factor_name: str,
        software_name: str,
        software_category: str,
        software_description: str,
        org_sector: str,
        org_description: str,
        subfactors: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Propone 3 en cada subfactor del factor activo cuando no hay modelo."""
        del org_sector, org_description, software_description
        ratings: dict[int, dict[str, Any]] = {}
        for item in subfactors:
            try:
                subfactor_id = int(item["id"])
            except (KeyError, TypeError, ValueError):
                continue
            description = str(item.get("description") or "este criterio")
            ratings[subfactor_id] = {
                "rating": 3,
                "justification": (
                    f"{LOCAL_NOTICE} No hay una calificación de modelo para '{software_name}' "
                    f"({software_category or 'General'}) en '{factor_name}'. "
                    f"Se propone 3 (cumple parcialmente) para '{description[:80]}'."
                ),
            }
        return {"ratings": ratings, "evidence_origin": CATALOG_ORIGIN}

    def generate_executive_summary_and_verdict(
        self,
        software_name: str,
        org_name: str,
        org_sector: str,
        recommendation: str,
        explanation_text: str,
        weaknesses: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
        ir_summary: list[dict[str, Any]],
        factors: list[dict[str, Any]] | None = None,
        software_category: str = "",
        software_description: str = "",
        org_description: str = "",
    ) -> dict[str, Any]:
        del software_category, software_description, org_description, ir_summary
        narrative = build_predetermined_narrative(
            software_name=software_name,
            org_name=org_name,
            org_sector=org_sector,
            recommendation=recommendation,
            explanation_text=explanation_text,
            factors=factors or [*strengths, *weaknesses],
        )
        narrative["executive_summary"] = (
            f"{LOCAL_NOTICE} Este texto lo armó el motor de la guía.\n\n"
            + narrative["executive_summary"]
        )
        narrative["evidence_origin"] = CATALOG_ORIGIN
        return narrative
