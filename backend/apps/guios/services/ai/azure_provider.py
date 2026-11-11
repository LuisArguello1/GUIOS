"""
apps/guios/services/ai/azure_provider.py
───────────────────────────────────────────────────────────────────────────────
Proveedor primario de GUIOS sobre Azure AI Foundry / Azure OpenAI.
gpt-5-mini admite un contexto de 400 000 tokens. La salida reservada en cada
llamada deja espacio al razonamiento interno y al JSON completo del catálogo,
sin pedir el tope de 128 000 tokens en operaciones cortas.
"""
from typing import Any

from django.conf import settings

from .base import BaseAIProvider
from .json_payload import (
    clamp_scale,
    require_choice,
    require_completion_content,
    require_justification,
    require_verdict_text,
)
from .factor_ratings import build_factor_ratings_prompts, map_factor_ratings_response
from .literature_evidence import build_literature_prompts, map_literature_response
from .verdict_narrative import build_verdict_prompts

# Un catálogo de 61 subfactores cabe en una sola llamada.
AZURE_LITERATURE_CHUNK_SIZE = 61
# El razonamiento de gpt-5-mini se descuenta de max_completion_tokens.
# 16 000 cubre ese razonamiento y el JSON bibliográfico del catálogo completo.
AZURE_LITERATURE_MAX_COMPLETION_TOKENS = 24_000
AZURE_VERDICT_MAX_COMPLETION_TOKENS = 8_000
AZURE_SHORT_MAX_COMPLETION_TOKENS = 4_000
# Tope de espera. Una respuesta con razonamiento no cabe en el timeout corto de Groq.
AZURE_TIMEOUT_SECONDS = 120


class AzureAIProvider(BaseAIProvider):
    """
    Cliente compatible con OpenAI apuntando a AI Foundry (/models)
    o a Azure OpenAI v1 (/openai/v1).
    """

    def __init__(
        self,
        api_key: str | None = None,
        endpoint: str | None = None,
        model_name: str | None = None,
    ):
        self.api_key = api_key or getattr(settings, "AZURE_OPENAI_API_KEY", "")
        raw_endpoint = endpoint or getattr(settings, "AZURE_OPENAI_ENDPOINT", "")
        self.endpoint = self._normalize_endpoint(raw_endpoint)
        self.model_name = model_name or getattr(settings, "AZURE_OPENAI_MODEL", "gpt-5-mini")
        configured_timeout = int(getattr(settings, "AI_TIMEOUT_SECONDS", 30))
        self.timeout_seconds = max(configured_timeout, AZURE_TIMEOUT_SECONDS)
        self._client = None

    def _normalize_endpoint(self, raw_endpoint: str) -> str:
        """
        Conserva la ruta que corresponde al recurso.

        AI Foundry publica chat completions en /models.
        Azure OpenAI v1 las publica en /openai/v1. Reescribir esa ruta
        como /models envía la llamada a un recurso que no la atiende.
        """
        if not raw_endpoint:
            return ""
        url = raw_endpoint.strip().rstrip("/")
        if url.endswith("/responses"):
            url = url[: -len("/responses")]

        if "openai.azure.com" in url or "/openai/v1" in url:
            marker = "/openai/v1"
            if marker in url:
                return url[: url.index(marker) + len(marker)]
            return f"{url}/openai/v1"

        if url.endswith("/models"):
            return url
        return f"{url}/models"

    def _get_client(self):
        if self._client is None:
            if not self.api_key:
                raise ValueError("AZURE_OPENAI_API_KEY no está configurada en las variables de entorno.")
            if not self.endpoint:
                raise ValueError("AZURE_OPENAI_ENDPOINT no está configurada en las variables de entorno.")

            from openai import OpenAI

            self._client = OpenAI(
                base_url=self.endpoint,
                api_key=self.api_key,
                timeout=float(self.timeout_seconds),
            )
        return self._client

    def _complete_json(self, system_prompt: str, user_prompt: str, max_completion_tokens: int) -> dict[str, Any]:
        client = self._get_client()
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=max_completion_tokens,
        )
        provider_name = f"Azure OpenAI ({self.model_name})"
        if not completion.choices:
            raise ValueError(f"{provider_name} no devolvió alternativas.")
        return require_completion_content(completion.choices[0], provider_name)

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
        data = self._complete_json(
            system_prompt,
            user_prompt,
            AZURE_LITERATURE_MAX_COMPLETION_TOKENS,
        )
        mapped = map_literature_response(data, subfactors_data, academic_works=academic_works)
        mapped["provider_info"] = f"Azure OpenAI ({self.model_name})"
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
        provider_name = f"Azure OpenAI ({self.model_name})"
        system_prompt = (
            "Eres un asesor experto en adopción de tecnologías de código abierto bajo el marco metodológico GUIOS. "
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
        data = self._complete_json(system_prompt, user_prompt, AZURE_SHORT_MAX_COMPLETION_TOKENS)
        suggested_id = clamp_scale(
            require_choice(data, ("suggested_id", "suggested_ID"), provider_name, "suggested_id")
        )
        return {
            "suggested_id": suggested_id,
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
        provider_name = f"Azure OpenAI ({self.model_name})"
        system_prompt = (
            "Eres un auditor técnico de software libre bajo el marco GUIOS. "
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
        data = self._complete_json(system_prompt, user_prompt, AZURE_SHORT_MAX_COMPLETION_TOKENS)
        suggested_rating = clamp_scale(
            require_choice(data, ("suggested_rating", "rating"), provider_name, "suggested_rating")
        )
        return {
            "suggested_rating": suggested_rating,
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
        provider_name = f"Azure OpenAI ({self.model_name})"
        system_prompt, user_prompt = build_factor_ratings_prompts(
            software_name=software_name,
            software_category=software_category,
            software_description=software_description,
            org_sector=org_sector,
            org_description=org_description,
            factor_name=factor_name,
            subfactors=subfactors,
        )
        data = self._complete_json(system_prompt, user_prompt, AZURE_SHORT_MAX_COMPLETION_TOKENS)
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
        data = self._complete_json(system_prompt, user_prompt, AZURE_VERDICT_MAX_COMPLETION_TOKENS)
        narrative = require_verdict_text(data, f"Azure OpenAI ({self.model_name})")
        narrative["evidence_origin"] = "model"
        return narrative
