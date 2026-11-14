"""
apps/guios/services/ai/cohere_provider.py
───────────────────────────────────────────────────────────────────────────────
Contingencia API 2 de GUIOS sobre Cohere (API v2).
Entra cuando el primario y Groq no responden. Un JSON ilegible se propaga
como error para que la cascada llegue al piso local, en lugar de cerrarse en vacío.
"""
from typing import Any
import httpx
from django.conf import settings
from .base import BaseAIProvider
from .json_payload import (
    clamp_scale,
    require_choice,
    require_json_object,
    require_justification,
    require_verdict_text,
)
from .factor_ratings import (
    FACTOR_RATINGS_MAX_TOKENS,
    build_factor_ratings_prompts,
    map_factor_ratings_response,
)
from .literature_evidence import (
    LITERATURE_MAX_TOKENS,
    build_literature_prompts,
    map_literature_response,
)
from .verdict_narrative import VERDICT_MAX_TOKENS, build_verdict_prompts

class CohereAIProvider(BaseAIProvider):
    """
    Proveedor oficial de Cohere utilizando la API v2 con salida JSON estricta.
    Por defecto utiliza 'command-r-plus-08-2024' o el configurado en settings.
    """

    def __init__(self, api_key: str | None = None, model_name: str | None = None):
        self.api_key = api_key or getattr(settings, 'COHERE_API_KEY', '')
        self.model_name = model_name or getattr(settings, 'COHERE_MODEL', 'command-r-plus-08-2024')
        self.timeout_seconds = float(getattr(settings, 'AI_TIMEOUT_SECONDS', 30))
        self.api_url = "https://api.cohere.com/v2/chat"

    def _call_cohere(self, system_prompt: str, user_prompt: str, max_tokens: int | None = None) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("COHERE_API_KEY no está configurada en las variables de entorno.")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens

        with httpx.Client(timeout=self.timeout_seconds) as client:
            resp = client.post(self.api_url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Cohere API error ({resp.status_code}): {resp.text}"
                )
            data = resp.json()

        finish_reason = str(data.get("finish_reason") or "")
        if finish_reason in {"MAX_TOKENS", "ERROR"}:
            raise ValueError(f"Cohere ({self.model_name}) cortó la respuesta ({finish_reason}).")

        content_items = data.get("message", {}).get("content", [])
        text = content_items[0].get("text", "") if content_items else ""
        return require_json_object(text, f"Cohere ({self.model_name})")

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
        system_prompt, user_prompt = build_literature_prompts(
            software_name=software_name,
            software_category=software_category,
            software_repo_url=software_repo_url,
            software_description=software_description,
            org_sector=org_sector,
            org_description=org_description,
            subfactors_data=subfactors_data,
            academic_works=academic_works,
        )
        data = self._call_cohere(system_prompt, user_prompt, max_tokens=LITERATURE_MAX_TOKENS)
        mapped = map_literature_response(data, subfactors_data, academic_works=academic_works)
        mapped["provider_info"] = f"Cohere ({self.model_name})"
        if not mapped.get("evidence_origin"):
            mapped["evidence_origin"] = "model"
        return mapped

    def suggest_factor_importance(
        self,
        factor_name: str,
        factor_scope: str,
        is_suggested: int,
        org_sector: str,
        org_description: str,
        software_name: str,
    ) -> dict[str, Any]:
        system_prompt = (
            "Eres un asesor experto en adopción de tecnologías de código abierto. "
            "La justificación va en español. No uses inglés. "
            "Responde ÚNICAMENTE un objeto JSON válido."
        )

        user_prompt = f"""
Para el factor '{factor_name}' (ámbito: {factor_scope}), en el contexto de la organización evaluadora:
- Sector: {org_sector or 'Sector no especificado'}
- Contexto organizacional: {org_description or 'No especificado'}
- Software candidato: {software_name}
- Importancia Sugerida por la literatura (IS): {is_suggested} de 4

Recomienda la Importancia del Decisor (ID: número entero entre 1 y 4, donde 1=Irrelevante, 2=Opcional, 3=Importante, 4=Fundamental)
y una justificación en español de una o dos frases, máximo 45 palabras. No uses inglés.

RESPONDE ÚNICAMENTE EN JSON:
{{
  "suggested_id": 3,
  "justification": "Texto explicativo..."
}}
"""
        provider_name = f"Cohere ({self.model_name})"
        data = self._call_cohere(system_prompt, user_prompt)
        return {
            "suggested_id": clamp_scale(
                require_choice(data, ("suggested_id", "suggested_ID"), provider_name, "suggested_id")
            ),
            "justification": require_justification(data, provider_name),
            "evidence_origin": "model",
        }

    def suggest_subfactor_rating(
        self,
        subfactor_description: str,
        factor_name: str,
        software_name: str,
        software_category: str,
        software_description: str,
    ) -> dict[str, Any]:
        system_prompt = (
            "Eres un auditor técnico de software libre. "
            "La justificación va en español. No uses inglés. "
            "Responde ÚNICAMENTE un objeto JSON válido."
        )

        user_prompt = f"""
Evalúa el cumplimiento del siguiente subfactor para el software '{software_name}':
- Factor: {factor_name}
- Criterio / Subfactor: "{subfactor_description}"
- Categoría del Software: {software_category or 'General'}
- Descripción del Software: {software_description or ''}

Calificación metodológica en escala [1, 4]:
1: No cumple el requisito
2: Desconozco si cumple el requisito
3: Cumple parcialmente el requisito
4: Cumple el requisito

RESPONDE ÚNICAMENTE EN JSON:
{{
  "suggested_rating": 4,
  "justification": "Explicación técnica concisa con base en las capacidades del software..."
}}
"""
        provider_name = f"Cohere ({self.model_name})"
        data = self._call_cohere(system_prompt, user_prompt)
        return {
            "suggested_rating": clamp_scale(
                require_choice(data, ("suggested_rating", "rating"), provider_name, "suggested_rating")
            ),
            "justification": require_justification(data, provider_name),
            "evidence_origin": "model",
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
        system_prompt, user_prompt = build_factor_ratings_prompts(
            software_name=software_name,
            software_category=software_category,
            software_description=software_description,
            org_sector=org_sector,
            org_description=org_description,
            factor_name=factor_name,
            subfactors=subfactors,
        )
        provider_name = f"Cohere ({self.model_name})"
        data = self._call_cohere(system_prompt, user_prompt, max_tokens=FACTOR_RATINGS_MAX_TOKENS)
        known_ids = {int(item["id"]) for item in subfactors}
        return {
            "ratings": map_factor_ratings_response(data, known_ids),
            "evidence_origin": "model",
            "provider_info": provider_name,
        }

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
        system_prompt, user_prompt = build_verdict_prompts(
            software_name=software_name,
            software_category=software_category,
            software_description=software_description,
            org_name=org_name,
            org_sector=org_sector,
            org_description=org_description,
            recommendation=recommendation,
            explanation_text=explanation_text,
            factors=factors or [*strengths, *weaknesses, *ir_summary],
        )
        data = self._call_cohere(system_prompt, user_prompt, max_tokens=VERDICT_MAX_TOKENS)
        narrative = require_verdict_text(data, f"Cohere ({self.model_name})")
        narrative["evidence_origin"] = "model"
        return narrative
