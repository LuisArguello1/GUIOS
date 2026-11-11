"""
apps/guios/services/ai/groq_provider.py
───────────────────────────────────────────────────────────────────────────────
Contingencia API 1 de GUIOS sobre Groq Cloud.
Entra cuando el proveedor primario no responde. Mantiene el tope de salida
que admite el plan on_demand y exige un JSON cerrado antes de dar la llamada por buena.
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
from .verdict_narrative import (
    VERDICT_MAX_TOKENS,
    VERDICT_RESPONSE_FORMAT,
    build_verdict_prompts,
)


class GroqAIProvider(BaseAIProvider):
    """
    Proveedor oficial de Groq con SDK groq.
    Por defecto utiliza 'qwen/qwen3.8-27b' o el modelo configurado en settings.
    """

    def __init__(self, api_key: str | None = None, model_name: str | None = None):
        self.api_key = api_key or getattr(settings, 'GROQ_API_KEY', '')
        self.model_name = model_name or getattr(settings, 'GROQ_MODEL', 'qwen/qwen3.8-27b')
        self.timeout_seconds = int(getattr(settings, 'AI_TIMEOUT_SECONDS', 30))
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not self.api_key:
                raise ValueError("GROQ_API_KEY no está configurada en las variables de entorno.")
            import groq
            self._client = groq.Groq(
                api_key=self.api_key,
                timeout=float(self.timeout_seconds)
            )
        return self._client

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
        client = self._get_client()
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
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=LITERATURE_MAX_TOKENS,
        )

        provider_name = f"Groq ({self.model_name})"
        if not completion.choices:
            raise ValueError(f"{provider_name} no devolvió alternativas.")
        data = require_completion_content(completion.choices[0], provider_name)
        mapped = map_literature_response(data, subfactors_data, academic_works=academic_works)
        mapped["provider_info"] = provider_name
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
        client = self._get_client()

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
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=300,
        )

        provider_name = f"Groq ({self.model_name})"
        if not completion.choices:
            raise ValueError(f"{provider_name} no devolvió alternativas.")
        data = require_completion_content(completion.choices[0], provider_name)
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
        client = self._get_client()

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
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=300,
        )

        provider_name = f"Groq ({self.model_name})"
        if not completion.choices:
            raise ValueError(f"{provider_name} no devolvió alternativas.")
        data = require_completion_content(completion.choices[0], provider_name)
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
        client = self._get_client()
        system_prompt, user_prompt = build_factor_ratings_prompts(
            software_name=software_name,
            software_category=software_category,
            software_description=software_description,
            org_sector=org_sector,
            org_description=org_description,
            factor_name=factor_name,
            subfactors=subfactors,
        )
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=FACTOR_RATINGS_MAX_TOKENS,
        )
        provider_name = f"Groq ({self.model_name})"
        if not completion.choices:
            raise ValueError(f"{provider_name} no devolvió alternativas.")
        data = require_completion_content(completion.choices[0], provider_name)
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
        client = self._get_client()
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
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format=VERDICT_RESPONSE_FORMAT,
            temperature=0.2,
            max_completion_tokens=VERDICT_MAX_TOKENS,
            reasoning_effort="none",
        )
        provider_name = f"Groq ({self.model_name})"
        if not completion.choices:
            raise ValueError(f"{provider_name} no devolvió alternativas.")
        data = require_completion_content(completion.choices[0], provider_name)
        narrative = require_verdict_text(data, provider_name)
        narrative["evidence_origin"] = "model"
        return narrative
