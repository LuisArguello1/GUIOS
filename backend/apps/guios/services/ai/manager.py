"""
apps/guios/services/ai/manager.py
───────────────────────────────────────────────────────────────────────────────
Orquestador y gestor de Inteligencia Artificial para GUIOS.
Aplica el Strategy Pattern con contingencia multinivel y registro inmutable en AIAssistanceLog:
  - Nivel 1 (Primario): Groq Cloud (qwen/qwen3.8-27b)
  - Nivel 2 (Contingencia API): Cohere (command-r-plus-08-2024)
  - Nivel 3 (Contingencia Local): Heurístico Determinista (Fórmulas Tesis GUIOS)
"""
import logging
import time
from typing import Any
from django.conf import settings

from apps.guios.models.ai_log import AIAssistanceLog
from apps.guios.models.evaluation import Evaluation
from apps.guios.models.factor import Factor
from apps.guios.models.subfactor import Subfactor
from .base import BaseAIProvider
from .groq_provider import GroqAIProvider
from .cohere_provider import CohereAIProvider
from .heuristic_provider import HeuristicAIProvider

logger = logging.getLogger(__name__)


class AIService:
    """
    Servicio central de IA. Orquesta el proveedor primario (Groq), el secundario
    (Cohere) y el proveedor de seguridad (Heurístico), registrando cada transacción
    en AIAssistanceLog.
    """

    def __init__(
        self,
        primary_provider: BaseAIProvider | None = None,
        secondary_provider: BaseAIProvider | None = None,
        safety_provider: BaseAIProvider | None = None,
        fallback_provider: BaseAIProvider | None = None,
    ):
        provider_type = getattr(settings, 'AI_PROVIDER', 'groq').lower()

        if primary_provider is not None:
            self.primary_provider = primary_provider
        elif provider_type == 'groq':
            self.primary_provider = GroqAIProvider()
        elif provider_type == 'cohere':
            self.primary_provider = CohereAIProvider()
        else:
            self.primary_provider = HeuristicAIProvider()

        self.secondary_provider = secondary_provider or fallback_provider or CohereAIProvider()
        self.safety_provider = safety_provider or HeuristicAIProvider()

    def search_literature_and_citations(self, evaluation: Evaluation) -> dict[str, Any]:
        """
        Paso 0 / Fase 2: Búsqueda y conteo de literatura por subfactor.
        """
        subfactors_qs = (
            Subfactor.objects.filter(is_active=True)
            .select_related('factor')
            .order_by('factor__order', 'order', 'id')
        )
        subfactors_data = [
            {
                "id": sf.id,
                "factor_id": sf.factor_id,
                "factor_name": sf.factor.name,
                "description": sf.description,
                "keywords_ia": sf.keywords_ia,
                "base_citations_count": sf.base_citations_count,
            }
            for sf in subfactors_qs
        ]

        payload = {
            "software_name": evaluation.software_name,
            "software_category": evaluation.software_category,
            "software_repo_url": evaluation.software_repo_url,
            "software_description": evaluation.software_description,
            "subfactors_count": len(subfactors_data),
        }

        # 1. Intentar proveedor primario (Groq)
        start_time = time.perf_counter()
        try:
            result = self.primary_provider.search_literature_and_citations(
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_repo_url=evaluation.software_repo_url,
                software_description=evaluation.software_description,
                subfactors_data=subfactors_data,
            )
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                request_payload=payload,
                response_payload=result,
                status=AIAssistanceLog.STATUS_SUCCESS,
                response_time_ms=duration_ms,
            )
            return result

        except Exception as exc_primary:
            primary_duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning(
                "Fallo en proveedor primario (%s): %s. Intentando proveedor secundario (Cohere).",
                type(self.primary_provider).__name__,
                exc_primary,
            )

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                request_payload=payload,
                status=AIAssistanceLog.STATUS_ERROR,
                error_message=f"Fallo en proveedor primario ({type(self.primary_provider).__name__}): {str(exc_primary)}",
                response_time_ms=primary_duration_ms,
            )

        # 2. Intentar proveedor secundario (Cohere)
        sec_start = time.perf_counter()
        try:
            sec_result = self.secondary_provider.search_literature_and_citations(
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_repo_url=evaluation.software_repo_url,
                software_description=evaluation.software_description,
                subfactors_data=subfactors_data,
            )
            sec_duration_ms = int((time.perf_counter() - sec_start) * 1000)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                request_payload=payload,
                response_payload=sec_result,
                status=AIAssistanceLog.STATUS_SUCCESS,
                error_message="[FALLBACK COHERE] Proveedor primario falló. Mitigado exitosamente con Cohere.",
                response_time_ms=sec_duration_ms,
            )
            return sec_result

        except Exception as exc_sec:
            sec_duration_ms = int((time.perf_counter() - sec_start) * 1000)
            logger.warning(
                "Fallo en proveedor secundario (%s): %s. Activando contingencia heurística local.",
                type(self.secondary_provider).__name__,
                exc_sec,
            )

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                request_payload=payload,
                status=AIAssistanceLog.STATUS_ERROR,
                error_message=f"Fallo en proveedor secundario ({type(self.secondary_provider).__name__}): {str(exc_sec)}",
                response_time_ms=sec_duration_ms,
            )

        # 3. Proveedor de seguridad (Heurístico Local)
        safety_start = time.perf_counter()
        fallback_result = self.safety_provider.search_literature_and_citations(
            software_name=evaluation.software_name,
            software_category=evaluation.software_category,
            software_repo_url=evaluation.software_repo_url,
            software_description=evaluation.software_description,
            subfactors_data=subfactors_data,
        )
        safety_duration_ms = int((time.perf_counter() - safety_start) * 1000)

        AIAssistanceLog.objects.create(
            evaluation=evaluation,
            request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
            request_payload=payload,
            response_payload=fallback_result,
            status=AIAssistanceLog.STATUS_SUCCESS,
            error_message="[FALLBACK HEURÍSTICO] APIs externas no disponibles. Se aplicó modelo heurístico determinista.",
            response_time_ms=safety_duration_ms,
        )
        return fallback_result

    def suggest_factor_importance(
        self,
        evaluation: Evaluation,
        factor: Factor,
        is_suggested: int,
    ) -> dict[str, Any]:
        """
        Paso 1-2: Sugerencia asistida de Importancia del Decisor (ID).
        """
        payload = {
            "factor_id": factor.id,
            "factor_name": factor.name,
            "factor_scope": factor.scope,
            "is_suggested": is_suggested,
            "org_sector": evaluation.org_sector,
            "org_description": evaluation.org_description,
            "software_name": evaluation.software_name,
        }

        # Primario (Groq)
        start_time = time.perf_counter()
        try:
            result = self.primary_provider.suggest_factor_importance(
                factor_name=factor.name,
                factor_scope=factor.scope,
                is_suggested=is_suggested,
                org_sector=evaluation.org_sector,
                org_description=evaluation.org_description,
                software_name=evaluation.software_name,
            )
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                factor=factor,
                request_type=AIAssistanceLog.REQ_FACTOR_IMPORTANCE,
                request_payload=payload,
                response_payload=result,
                status=AIAssistanceLog.STATUS_SUCCESS,
                response_time_ms=duration_ms,
            )
            return result

        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning("Fallo IA en sugerir importancia factor #%s: %s", factor.id, exc)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                factor=factor,
                request_type=AIAssistanceLog.REQ_FACTOR_IMPORTANCE,
                request_payload=payload,
                status=AIAssistanceLog.STATUS_ERROR,
                error_message=str(exc),
                response_time_ms=duration_ms,
            )

        # Secundario (Cohere)
        try:
            return self.secondary_provider.suggest_factor_importance(
                factor_name=factor.name,
                factor_scope=factor.scope,
                is_suggested=is_suggested,
                org_sector=evaluation.org_sector,
                org_description=evaluation.org_description,
                software_name=evaluation.software_name,
            )
        except Exception:
            pass

        # Terciario (Heurístico)
        return self.safety_provider.suggest_factor_importance(
            factor_name=factor.name,
            factor_scope=factor.scope,
            is_suggested=is_suggested,
            org_sector=evaluation.org_sector,
            org_description=evaluation.org_description,
            software_name=evaluation.software_name,
        )

    def suggest_subfactor_rating(
        self,
        evaluation: Evaluation,
        subfactor: Subfactor,
    ) -> dict[str, Any]:
        """
        Paso 3-4: Sugerencia de calificación de cumplimiento para un subfactor.
        """
        payload = {
            "subfactor_id": subfactor.id,
            "subfactor_description": subfactor.description,
            "factor_name": subfactor.factor.name,
            "software_name": evaluation.software_name,
        }

        # Primario (Groq)
        start_time = time.perf_counter()
        try:
            result = self.primary_provider.suggest_subfactor_rating(
                subfactor_description=subfactor.description,
                factor_name=subfactor.factor.name,
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_description=evaluation.software_description,
            )
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                factor=subfactor.factor,
                request_type=AIAssistanceLog.REQ_SUBFACTOR_RATING,
                request_payload=payload,
                response_payload=result,
                status=AIAssistanceLog.STATUS_SUCCESS,
                response_time_ms=duration_ms,
            )
            return result

        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning("Fallo IA en sugerir rating subfactor #%s: %s", subfactor.id, exc)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                factor=subfactor.factor,
                request_type=AIAssistanceLog.REQ_SUBFACTOR_RATING,
                request_payload=payload,
                status=AIAssistanceLog.STATUS_ERROR,
                error_message=str(exc),
                response_time_ms=duration_ms,
            )

        # Secundario (Cohere)
        try:
            return self.secondary_provider.suggest_subfactor_rating(
                subfactor_description=subfactor.description,
                factor_name=subfactor.factor.name,
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_description=evaluation.software_description,
            )
        except Exception:
            pass

        # Terciario (Heurístico)
        return self.safety_provider.suggest_subfactor_rating(
            subfactor_description=subfactor.description,
            factor_name=subfactor.factor.name,
            software_name=evaluation.software_name,
            software_category=evaluation.software_category,
            software_description=evaluation.software_description,
        )

    def generate_executive_summary_and_verdict(
        self,
        evaluation: Evaluation,
        recommendation: str,
        explanation_text: str,
        weaknesses: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
        ir_summary: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Paso 5-6: Generación del resumen ejecutivo y plan de mitigación.
        """
        payload = {
            "evaluation_id": evaluation.id,
            "software_name": evaluation.software_name,
            "recommendation": recommendation,
            "weaknesses_count": len(weaknesses),
            "strengths_count": len(strengths),
        }

        # Primario (Groq)
        start_time = time.perf_counter()
        try:
            result = self.primary_provider.generate_executive_summary_and_verdict(
                software_name=evaluation.software_name,
                org_name=evaluation.org_name,
                org_sector=evaluation.org_sector,
                recommendation=recommendation,
                explanation_text=explanation_text,
                weaknesses=weaknesses,
                strengths=strengths,
                ir_summary=ir_summary,
            )
            duration_ms = int((time.perf_counter() - start_time) * 1000)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_EXECUTIVE_SUMMARY,
                request_payload=payload,
                response_payload=result,
                status=AIAssistanceLog.STATUS_SUCCESS,
                response_time_ms=duration_ms,
            )
            return result

        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning("Fallo IA en dictamen ejecutivo eval #%s: %s", evaluation.id, exc)

            AIAssistanceLog.objects.create(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_EXECUTIVE_SUMMARY,
                request_payload=payload,
                status=AIAssistanceLog.STATUS_ERROR,
                error_message=str(exc),
                response_time_ms=duration_ms,
            )

        # Secundario (Cohere)
        try:
            return self.secondary_provider.generate_executive_summary_and_verdict(
                software_name=evaluation.software_name,
                org_name=evaluation.org_name,
                org_sector=evaluation.org_sector,
                recommendation=recommendation,
                explanation_text=explanation_text,
                weaknesses=weaknesses,
                strengths=strengths,
                ir_summary=ir_summary,
            )
        except Exception:
            pass

        # Terciario (Heurístico)
        return self.safety_provider.generate_executive_summary_and_verdict(
            software_name=evaluation.software_name,
            org_name=evaluation.org_name,
            org_sector=evaluation.org_sector,
            recommendation=recommendation,
            explanation_text=explanation_text,
            weaknesses=weaknesses,
            strengths=strengths,
            ir_summary=ir_summary,
        )


# Instancia singleton predeterminada
ai_service = AIService()
