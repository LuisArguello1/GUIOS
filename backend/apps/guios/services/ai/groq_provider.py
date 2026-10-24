"""
apps/guios/services/ai/groq_provider.py
───────────────────────────────────────────────────────────────────────────────
Proveedor principal de Inteligencia Artificial para GUIOS basado en Groq Cloud.
Ofrece inferencia LPU de ultra-baja latencia y salidas estrictamente estructuradas
en formato JSON.
"""
import json
import logging
from typing import Any
from django.conf import settings
from .base import BaseAIProvider

logger = logging.getLogger(__name__)


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
    ) -> dict[str, Any]:
        client = self._get_client()

        # Resumir subfactores para enviar en el prompt
        subfactors_prompt_list = [
            {
                "id": sf["id"],
                "factor_id": sf["factor_id"],
                "factor_name": sf.get("factor_name", ""),
                "description": sf["description"],
                "keywords": sf.get("keywords_ia", ""),
                "base_c_i": sf.get("base_citations_count", 1),
            }
            for sf in subfactors_data
        ]

        system_prompt = (
            "Eres un investigador y revisor metodológico de la guía GUIOS "
            "(Metodología de Adopción de Software Libre / FLOSS). "
            "Tu tarea es estimar el volumen de evidencia científica y técnica disponible sobre la adopción "
            "del software candidato y responder ÚNICAMENTE un objeto JSON válido."
        )

        user_prompt = f"""
SOFTWARE CANDIDATO:
- Nombre: {software_name}
- Categoría: {software_category or 'General'}
- Repositorio/Web: {software_repo_url or 'No especificado'}
- Perfil/Descripción: {software_description or 'Software de código abierto'}

LISTA DE SUBFACTORES A EVALUAR:
{json.dumps(subfactors_prompt_list, ensure_ascii=False, indent=2)}

INSTRUCCIONES DE RESPUESTA:
Para cada subfactor en la lista, estima el número de citas/evidencias científicas y empíricas (citations_count, entero >= 1)
que sustentan la adopción de este software específico en dicho criterio.
Provee al menos 1 fuente representativa por cada factor involucrado.

DEBES RESPONDER ÚNICAMENTE EN FORMATO JSON VÁLIDO CON LA SIGUIENTE ESTRUCTURA EXACTA:
{{
  "subfactors": [
    {{
      "id": 1,
      "citations_count": 3
    }}
  ],
  "sources": [
    {{
      "factor_id": 1,
      "title": "Título del estudio o documentación técnica",
      "url": "https://ejemplo.org/articulo",
      "snippet": "Breve justificación de la evidencia encontrada...",
      "doi": "10.1016/j.jss.2024.0001"
    }}
  ]
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
            max_tokens=900,
        )

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)

        citations_by_subfactor: dict[int, int] = {}
        for item in data.get("subfactors", []):
            try:
                sf_id = int(item["id"])
                citations_count = max(1, int(item.get("citations_count", 1)))
                citations_by_subfactor[sf_id] = citations_count
            except (ValueError, KeyError):
                continue

        sources_by_factor: dict[int, list[dict[str, Any]]] = {}
        for src in data.get("sources", []):
            try:
                f_id = int(src.get("factor_id", 0))
                if f_id:
                    if f_id not in sources_by_factor:
                        sources_by_factor[f_id] = []
                    sources_by_factor[f_id].append({
                        "title": str(src.get("title", "")),
                        "url": str(src.get("url", "")),
                        "snippet": str(src.get("snippet", "")),
                        "doi": str(src.get("doi", "")),
                    })
            except (ValueError, KeyError):
                continue

        # Asegurar que todos los subfactores tengan al menos un valor
        for sf in subfactors_data:
            if sf["id"] not in citations_by_subfactor:
                citations_by_subfactor[sf["id"]] = sf.get("base_citations_count", 1) or 1

        return {
            "citations_by_subfactor": citations_by_subfactor,
            "sources_by_factor": sources_by_factor,
            "provider_info": f"Groq ({self.model_name})",
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
        client = self._get_client()

        system_prompt = (
            "Eres un asesor experto en adopción de tecnologías de código abierto. "
            "Responde ÚNICAMENTE un objeto JSON válido."
        )

        user_prompt = f"""
Para el factor '{factor_name}' (ámbito: {factor_scope}), en el contexto de la organización evaluadora:
- Sector: {org_sector or 'Sector no especificado'}
- Contexto organizacional: {org_description or 'No especificado'}
- Software candidato: {software_name}
- Importancia Sugerida por la literatura (IS): {is_suggested} de 4

Recomienda la Importancia del Decisor (ID: número entero entre 1 y 4, donde 1=Irrelevante, 2=Opcional, 3=Importante, 4=Fundamental)
y una justificación concisa (máximo 2 párrafos).

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

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)
        suggested_id = max(1, min(4, int(data.get("suggested_id", is_suggested))))

        return {
            "suggested_id": suggested_id,
            "justification": str(data.get("justification", "")).strip(),
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

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)
        suggested_rating = max(1, min(4, int(data.get("suggested_rating", 3))))

        return {
            "suggested_rating": suggested_rating,
            "justification": str(data.get("justification", "")).strip(),
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
    ) -> dict[str, Any]:
        client = self._get_client()

        system_prompt = (
            "Eres un consultor senior de TI y gobierno tecnológico. "
            "Responde ÚNICAMENTE un objeto JSON válido."
        )

        user_prompt = f"""
Redacta un informe ejecutivo para la Alta Dirección y un plan de mitigación detallado
para la adopción del software libre '{software_name}' en la organización '{org_name}' ({org_sector}).

DATOS DEL RESULTADO METODOLÓGICO:
- Recomendación Final: {recommendation}
- Dictamen Metodológico GUIOS: {explanation_text}
- Fortalezas detectadas: {json.dumps(strengths, ensure_ascii=False)}
- Debilidades / Amenazas detectadas: {json.dumps(weaknesses, ensure_ascii=False)}

RESPONDE ÚNICAMENTE EN JSON:
{{
  "executive_summary": "Texto en formato Markdown con el resumen ejecutivo estructurado...",
  "mitigation_plan": "Texto en formato Markdown con plan de acciones correctivas, cronograma recomendado y mitigación..."
}}
"""
        completion = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=900,
        )

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)

        return {
            "executive_summary": str(data.get("executive_summary", "")).strip(),
            "mitigation_plan": str(data.get("mitigation_plan", "")).strip(),
        }
