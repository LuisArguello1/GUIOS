"""
apps/guios/services/ai/manager.py
───────────────────────────────────────────────────────────────────────────────
Orquestador de Inteligencia Artificial para GUIOS.
Cascada de cuatro niveles con registro inmutable en AIAssistanceLog:
  - Nivel 1 (Primario): Azure OpenAI / AI Foundry (gpt-5-mini)
  - Nivel 2 (Contingencia API 1): Groq Cloud (qwen/qwen3.8-27b)
  - Nivel 3 (Contingencia API 2): Cohere (command-r-plus-08-2024)
  - Nivel 4 (Contingencia Local): Heurístico Determinista (catálogo de la tesis)
"""
import logging
import time
from collections.abc import Callable
from typing import Any

from django.conf import settings

from apps.guios.models.ai_log import AIAssistanceLog
from apps.guios.models.evaluation import Evaluation
from apps.guios.models.factor import Factor
from apps.guios.models.subfactor import Subfactor

from .azure_provider import AZURE_LITERATURE_CHUNK_SIZE, AzureAIProvider
from .base import BaseAIProvider
from .cohere_provider import CohereAIProvider
from .groq_provider import GroqAIProvider
from .heuristic_provider import HeuristicAIProvider
from apps.guios.services.literature.openalex import OpenAlexClient

logger = logging.getLogger(__name__)

# Groq y Cohere reservan menos de 1000 tokens de salida. Un bloque de 12
# subfactores cabe en ese presupuesto. Azure pide el catálogo en una llamada.
API_LITERATURE_CHUNK_SIZE = 12

CASCADE_ORDER = ("primario", "secundario", "terciario", "heurístico")


class AIService:
    """
    Servicio central de IA. Orquesta Azure, Groq, Cohere y el piso local,
    y deja un AIAssistanceLog por cada intento, incluido el que responde.
    """

    def __init__(
        self,
        primary_provider: BaseAIProvider | None = None,
        secondary_provider: BaseAIProvider | None = None,
        tertiary_provider: BaseAIProvider | None = None,
        safety_provider: BaseAIProvider | None = None,
        fallback_provider: BaseAIProvider | None = None,
        openalex_client: OpenAlexClient | None = None,
    ):
        provider_type = getattr(settings, "AI_PROVIDER", "azure").lower()

        if primary_provider is not None:
            self.primary_provider = primary_provider
        elif provider_type == "azure":
            self.primary_provider = AzureAIProvider()
        elif provider_type == "groq":
            self.primary_provider = GroqAIProvider()
        elif provider_type == "cohere":
            self.primary_provider = CohereAIProvider()
        else:
            self.primary_provider = HeuristicAIProvider()

        if primary_provider is not None:
            self.secondary_provider = secondary_provider or fallback_provider
            self.tertiary_provider = tertiary_provider
        elif provider_type == "azure":
            self.secondary_provider = secondary_provider or fallback_provider or GroqAIProvider()
            self.tertiary_provider = tertiary_provider or CohereAIProvider()
        elif provider_type == "groq":
            self.secondary_provider = secondary_provider or fallback_provider or CohereAIProvider()
            self.tertiary_provider = tertiary_provider
        elif provider_type == "cohere":
            self.secondary_provider = secondary_provider or fallback_provider or GroqAIProvider()
            self.tertiary_provider = tertiary_provider
        else:
            self.secondary_provider = secondary_provider or fallback_provider
            self.tertiary_provider = tertiary_provider

        self.safety_provider = safety_provider or HeuristicAIProvider()
        self.openalex_client = openalex_client or OpenAlexClient()

    def search_literature_and_citations(
        self,
        evaluation: Evaluation,
        academic_works: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Paso 0 / Fase 2: búsqueda y conteo de literatura por subfactor."""
        subfactors_data = self._load_subfactors()

        if academic_works is None:
            try:
                works = self.openalex_client.search_works(
                    software_name=evaluation.software_name,
                    category=evaluation.software_category,
                    limit=getattr(settings, "OPENALEX_MAX_RESULTS", 80),
                )
                academic_works = [w.to_dict() for w in works]
                logger.info(
                    "OpenAlex recuperó %d artículos académicos para %s",
                    len(academic_works),
                    evaluation.software_name,
                )
            except Exception as exc:
                logger.warning(
                    "Fallo al consultar OpenAlex para '%s': %s. Se aplicará degradación elegante.",
                    evaluation.software_name,
                    exc,
                )
                academic_works = []

        payload = {
            **self._literature_payload(evaluation, subfactors_data),
            "academic_works_count": len(academic_works or []),
        }

        if isinstance(self.primary_provider, AzureAIProvider):
            return self._search_literature_azure_window(
                evaluation, subfactors_data, payload, academic_works=academic_works
            )

        return self._search_literature_chunks(
            evaluation,
            subfactors_data,
            payload,
            API_LITERATURE_CHUNK_SIZE,
            start_level="primario",
            academic_works=academic_works,
        )

    def suggest_factor_importance(
        self,
        evaluation: Evaluation,
        factor: Factor,
        is_suggested: int,
    ) -> dict[str, Any]:
        """Paso 1-2: sugerencia asistida de Importancia del Decisor (ID)."""
        payload = {
            "factor_id": factor.id,
            "factor_name": factor.name,
            "factor_scope": factor.scope,
            "is_suggested": is_suggested,
            "org_sector": evaluation.org_sector,
            "org_description": evaluation.org_description,
            "software_name": evaluation.software_name,
        }
        return self._cascade(
            evaluation=evaluation,
            request_type=AIAssistanceLog.REQ_FACTOR_IMPORTANCE,
            payload=payload,
            factor=factor,
            call=lambda provider: provider.suggest_factor_importance(
                factor_name=factor.name,
                factor_scope=factor.scope,
                is_suggested=is_suggested,
                org_sector=evaluation.org_sector,
                org_description=evaluation.org_description,
                software_name=evaluation.software_name,
            ),
        )

    def suggest_subfactor_rating(
        self,
        evaluation: Evaluation,
        subfactor: Subfactor,
    ) -> dict[str, Any]:
        """Paso 3-4: sugerencia de calificación de cumplimiento para un subfactor."""
        payload = {
            "subfactor_id": subfactor.id,
            "subfactor_description": subfactor.description,
            "factor_name": subfactor.factor.name,
            "software_name": evaluation.software_name,
        }
        return self._cascade(
            evaluation=evaluation,
            request_type=AIAssistanceLog.REQ_SUBFACTOR_RATING,
            payload=payload,
            factor=subfactor.factor,
            call=lambda provider: provider.suggest_subfactor_rating(
                subfactor_description=subfactor.description,
                factor_name=subfactor.factor.name,
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_description=evaluation.software_description,
            ),
        )

    def suggest_factor_ratings(
        self,
        evaluation: Evaluation,
        factor: Factor,
        subfactors: list[Subfactor],
    ) -> dict[str, Any]:
        """Paso 2: una sola llamada para los subfactores del factor que el usuario está viendo."""
        subfactors_data = [
            {"id": subfactor.id, "description": subfactor.description}
            for subfactor in subfactors
        ]
        payload = {
            "factor_id": factor.id,
            "factor_name": factor.name,
            "subfactor_ids": [item["id"] for item in subfactors_data],
            "software_name": evaluation.software_name,
        }
        return self._cascade(
            evaluation=evaluation,
            request_type=AIAssistanceLog.REQ_SUBFACTOR_RATING,
            payload=payload,
            factor=factor,
            call=lambda provider: provider.suggest_factor_ratings(
                factor_name=factor.name,
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_description=evaluation.software_description,
                org_sector=evaluation.org_sector,
                org_description=evaluation.org_description,
                subfactors=subfactors_data,
            ),
        )

    def generate_executive_summary_and_verdict(
        self,
        evaluation: Evaluation,
        recommendation: str,
        explanation_text: str,
        weaknesses: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
        ir_summary: list[dict[str, Any]],
        factors: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Paso 5-6: resumen ejecutivo y plan de mitigación."""
        payload = {
            "evaluation_id": evaluation.id,
            "software_name": evaluation.software_name,
            "recommendation": recommendation,
            "weaknesses_count": len(weaknesses),
            "strengths_count": len(strengths),
        }
        return self._cascade(
            evaluation=evaluation,
            request_type=AIAssistanceLog.REQ_EXECUTIVE_SUMMARY,
            payload=payload,
            call=lambda provider: provider.generate_executive_summary_and_verdict(
                software_name=evaluation.software_name,
                org_name=evaluation.org_name,
                org_sector=evaluation.org_sector,
                recommendation=recommendation,
                explanation_text=explanation_text,
                weaknesses=weaknesses,
                strengths=strengths,
                ir_summary=ir_summary,
                factors=factors,
                software_category=evaluation.software_category,
                software_description=evaluation.software_description,
                org_description=evaluation.org_description,
            ),
        )

    def _search_literature_azure_window(
        self,
        evaluation: Evaluation,
        subfactors_data: list[dict[str, Any]],
        payload: dict[str, Any],
        academic_works: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Azure recibe el catálogo en bloques de 61. Si esa llamada falla,
        el mismo bloque se parte en grupos de 12 para Groq, Cohere y el piso local.
        """
        pieces = _split(subfactors_data, AZURE_LITERATURE_CHUNK_SIZE)
        merged = _empty_literature(subfactors_data)
        notes: list[str] = []

        for index, piece in enumerate(pieces):
            piece_payload = {
                **payload,
                "chunk_index": index,
                "chunk_count": len(pieces),
                "subfactors_count": len(piece),
                "chunk_size": AZURE_LITERATURE_CHUNK_SIZE,
            }
            try:
                result = self._invoke(
                    evaluation=evaluation,
                    request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                    payload=piece_payload,
                    provider=self.primary_provider,
                    level="primario",
                    is_fallback=False,
                    call=lambda provider, current=piece: self._call_literature(
                        provider, evaluation, current, academic_works=academic_works
                    ),
                )
            except Exception:
                logger.warning(
                    "Azure no completó el bloque bibliográfico %s/%s. Se parte para los niveles siguientes.",
                    index + 1,
                    len(pieces),
                )
                result = self._search_literature_chunks(
                    evaluation,
                    piece,
                    piece_payload,
                    API_LITERATURE_CHUNK_SIZE,
                    start_level="secundario",
                    academic_works=academic_works,
                )
            _merge_literature(merged, result)
            note = str(result.get("provider_info") or "").strip()
            if note:
                notes.append(note)

        if len(pieces) == 1 and notes:
            merged["provider_info"] = notes[0] if len(notes) == 1 else " | ".join(notes)
        else:
            merged["provider_info"] = " | ".join(notes)
        return merged

    def _search_literature_chunks(
        self,
        evaluation: Evaluation,
        subfactors_data: list[dict[str, Any]],
        payload: dict[str, Any],
        chunk_size: int,
        start_level: str,
        academic_works: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        chunks = _split(subfactors_data, chunk_size)
        if len(chunks) == 1:
            return self._cascade(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                payload={**payload, "subfactors_count": len(chunks[0]), "chunk_size": chunk_size},
                start_level=start_level,
                call=lambda provider: self._call_literature(
                    provider, evaluation, chunks[0], academic_works=academic_works
                ),
            )

        merged = _empty_literature(subfactors_data)
        notes: list[str] = []
        for index, chunk in enumerate(chunks):
            if index:
                time.sleep(1)
            chunk_payload = {
                **payload,
                "chunk_index": index,
                "chunk_count": len(chunks),
                "subfactors_count": len(chunk),
                "chunk_size": chunk_size,
            }
            result = self._cascade(
                evaluation=evaluation,
                request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                payload=chunk_payload,
                start_level=start_level,
                call=lambda provider, current=chunk: self._call_literature(
                    provider, evaluation, current, academic_works=academic_works
                ),
            )
            _merge_literature(merged, result)
            note = str(result.get("provider_info") or "").strip()
            if note:
                notes.append(note)

        merged["provider_info"] = " | ".join(notes)
        return merged

    def _cascade(
        self,
        *,
        evaluation: Evaluation,
        request_type: str,
        payload: dict[str, Any],
        call: Callable[[BaseAIProvider], dict[str, Any]],
        factor: Factor | None = None,
        start_level: str = "primario",
    ) -> dict[str, Any]:
        """Recorre los niveles vivos desde start_level y registra cada intento."""
        stages = [
            (level, provider)
            for level, provider in self._stages()
            if CASCADE_ORDER.index(level) >= CASCADE_ORDER.index(start_level)
        ]
        if not stages:
            raise RuntimeError("No hay proveedor de IA disponible para continuar la cascada.")

        last_error: Exception | None = None
        for index, (level, provider) in enumerate(stages):
            try:
                return self._invoke(
                    evaluation=evaluation,
                    request_type=request_type,
                    payload=payload,
                    provider=provider,
                    level=level,
                    is_fallback=index > 0 or start_level != "primario",
                    factor=factor,
                    call=call,
                )
            except Exception as exc:
                last_error = exc

        if last_error is not None:
            raise last_error
        raise RuntimeError("Ningún proveedor de IA respondió.")

    def _invoke(
        self,
        *,
        evaluation: Evaluation,
        request_type: str,
        payload: dict[str, Any],
        provider: BaseAIProvider,
        level: str,
        is_fallback: bool,
        call: Callable[[BaseAIProvider], dict[str, Any]],
        factor: Factor | None = None,
    ) -> dict[str, Any]:
        provider_name = type(provider).__name__
        logged_payload = {**payload, "cascade_level": level, "provider": provider_name}
        start_time = time.perf_counter()
        try:
            result = call(provider)
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            if not isinstance(result, dict):
                raise ValueError(f"{provider_name} no devolvió un objeto de respuesta.")
            stamped = {**result, "provider": provider_name, "cascade_level": level}
            note = ""
            if is_fallback:
                note = (
                    f"[FALLBACK {provider_name}] El nivel anterior falló. "
                    f"Respondió el nivel {level}."
                )
            self._log(
                evaluation=evaluation,
                request_type=request_type,
                payload=logged_payload,
                status=AIAssistanceLog.STATUS_SUCCESS,
                response=stamped,
                error_message=note,
                duration_ms=duration_ms,
                factor=factor,
            )
            return stamped
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning(
                "Fallo en proveedor %s (%s) durante %s: %s",
                level,
                provider_name,
                request_type,
                exc,
            )
            self._log(
                evaluation=evaluation,
                request_type=request_type,
                payload=logged_payload,
                status=AIAssistanceLog.STATUS_ERROR,
                error_message=f"Fallo en proveedor {level} ({provider_name}): {exc}",
                duration_ms=duration_ms,
                factor=factor,
            )
            raise

    def _stages(self) -> list[tuple[str, BaseAIProvider]]:
        candidates = (
            ("primario", self.primary_provider),
            ("secundario", self.secondary_provider),
            ("terciario", self.tertiary_provider),
            ("heurístico", self.safety_provider),
        )
        return [(level, provider) for level, provider in candidates if provider is not None]

    def _log(
        self,
        *,
        evaluation: Evaluation,
        request_type: str,
        payload: dict[str, Any],
        status: str,
        response: dict[str, Any] | None = None,
        error_message: str = "",
        duration_ms: int | None = None,
        factor: Factor | None = None,
    ) -> None:
        AIAssistanceLog.objects.create(
            evaluation=evaluation,
            factor=factor,
            request_type=request_type,
            request_payload=payload,
            response_payload=response,
            status=status,
            error_message=error_message,
            response_time_ms=duration_ms,
        )

    def _load_subfactors(self) -> list[dict[str, Any]]:
        subfactors = (
            Subfactor.objects.filter(is_active=True)
            .select_related("factor")
            .order_by("factor__order", "order", "id")
        )
        return [
            {
                "id": subfactor.id,
                "factor_id": subfactor.factor_id,
                "factor_name": subfactor.factor.name,
                "description": subfactor.description,
                "keywords_ia": subfactor.keywords_ia,
                "base_citations_count": subfactor.base_citations_count,
            }
            for subfactor in subfactors
        ]

    def _literature_payload(self, evaluation: Evaluation, subfactors_data: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "software_name": evaluation.software_name,
            "software_category": evaluation.software_category,
            "software_repo_url": evaluation.software_repo_url,
            "software_description": evaluation.software_description,
            "subfactors_count": len(subfactors_data),
        }

    def _call_literature(
        self,
        provider: BaseAIProvider,
        evaluation: Evaluation,
        subfactors_data: list[dict[str, Any]],
        academic_works: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return provider.search_literature_and_citations(
            software_name=evaluation.software_name,
            software_category=evaluation.software_category,
            software_repo_url=evaluation.software_repo_url,
            software_description=evaluation.software_description,
            subfactors_data=subfactors_data,
            org_sector=evaluation.org_sector,
            org_description=evaluation.org_description,
            academic_works=academic_works,
        )


def _split(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    if not items:
        return [[]]
    step = max(1, size)
    return [items[start:start + step] for start in range(0, len(items), step)]


def _empty_literature(subfactors_data: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "citations_by_subfactor": {int(subfactor["id"]): 0 for subfactor in subfactors_data},
        "sources_by_factor": {},
        "ratings_by_subfactor": {},
        "importance_by_factor": {},
        "provider_info": "",
    }


def _merge_literature(target: dict[str, Any], result: dict[str, Any]) -> None:
    for key, value in (result.get("citations_by_subfactor") or {}).items():
        target["citations_by_subfactor"][int(key)] = int(value)
    for factor_id, sources in (result.get("sources_by_factor") or {}).items():
        target["sources_by_factor"].setdefault(int(factor_id), []).extend(sources or [])
    for key, value in (result.get("ratings_by_subfactor") or {}).items():
        if isinstance(value, dict):
            target["ratings_by_subfactor"][int(key)] = value
    for key, value in (result.get("importance_by_factor") or {}).items():
        if isinstance(value, dict):
            target["importance_by_factor"][int(key)] = value
    origin = result.get("evidence_origin")
    if origin:
        origins = target.setdefault("evidence_origins", [])
        if origin not in origins:
            origins.append(origin)


# Instancia singleton predeterminada
ai_service = AIService()
