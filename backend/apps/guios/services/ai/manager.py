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

from copy import deepcopy
from django.db.models import Q

from apps.guios.models.ai_log import AIAssistanceLog
from apps.guios.models.evaluation import Evaluation
from apps.guios.models.factor import Factor
from apps.guios.models.subfactor import Subfactor

from .azure_provider import AZURE_LITERATURE_CHUNK_SIZE, AzureAIProvider
from .base import BaseAIProvider
from .cohere_provider import CohereAIProvider
from .groq_provider import GroqAIProvider
from .heuristic_provider import HeuristicAIProvider
from apps.guios.services.literature.openalex import (
    OpenAlexClient,
    extract_root_software_name,
)

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
        self._consistent_literature_cache: dict[tuple[Any, ...], dict[str, Any]] = {}

    def _is_real_literature_provider(self) -> bool:
        return isinstance(
            self.primary_provider,
            (AzureAIProvider, GroqAIProvider, CohereAIProvider),
        )

    def _get_literature_year_window(self) -> tuple[int, int]:
        default_from = int(getattr(settings, "OPENALEX_YEAR_FROM", 2020))
        default_to = int(getattr(settings, "OPENALEX_YEAR_TO", 2025))
        raw_from = getattr(self.openalex_client, "year_from", default_from)
        raw_to = getattr(self.openalex_client, "year_to", default_to)
        year_from = raw_from if isinstance(raw_from, int) else default_from
        year_to = raw_to if isinstance(raw_to, int) else default_to
        return year_from, year_to

    @staticmethod
    def _has_verified_doi_sources(result: dict[str, Any] | None) -> bool:
        if not isinstance(result, dict):
            return False
        if result.get("evidence_origin") == "catalog_baseline":
            return False
        sources_by_factor = result.get("sources_by_factor") or {}
        for items in sources_by_factor.values():
            if not isinstance(items, list):
                continue
            for item in items:
                if isinstance(item, dict) and str(item.get("doi") or "").strip():
                    return True
        return False

    def _build_snapshot_result(
        self,
        *,
        citations_by_subfactor: dict[int, int],
        sources_by_factor: dict[int, list[dict[str, Any]]],
        source_eval_id: int,
        year_from: int,
        year_to: int,
    ) -> dict[str, Any]:
        return {
            "citations_by_subfactor": dict(citations_by_subfactor),
            "sources_by_factor": deepcopy(sources_by_factor),
            "ratings_by_subfactor": {},
            "importance_by_factor": {},
            "provider_info": (
                f"Snapshot OpenAlex consistente ({year_from}-{year_to}) "
                f"reutilizado de evaluación #{source_eval_id}."
            ),
            "evidence_origin": "openalex_consistent_snapshot",
            "provider": type(self.primary_provider).__name__,
            "cascade_level": "snapshot",
            "snapshot_reused": True,
            "snapshot_source_evaluation_id": source_eval_id,
        }

    def _find_consistent_openalex_snapshot(
        self,
        evaluation: Evaluation,
        subfactors_data: list[dict[str, Any]],
        year_from: int,
        year_to: int,
    ) -> dict[str, Any] | None:
        """Busca un snapshot bibliográfico previo del mismo software raíz (Enfoque A)."""
        root_name = extract_root_software_name(evaluation.software_name or "").strip().lower()
        if not root_name:
            return None

        active_subfactor_ids = {int(sf["id"]) for sf in subfactors_data}
        candidates = (
            Evaluation.objects.filter(ai_status=Evaluation.AI_STATUS_COMPLETED)
            .filter(
                Q(software_name__icontains=root_name)
                | Q(software_name__iexact=evaluation.software_name)
            )
            .exclude(pk=evaluation.pk)
            .prefetch_related("evaluation_factors", "evaluation_subfactors", "ai_logs")
            .order_by("-id")[:30]
        )

        for cand in candidates:
            cand_root = extract_root_software_name(cand.software_name or "").strip().lower()
            if cand_root != root_name:
                continue

            lit_logs = [
                log
                for log in cand.ai_logs.all()
                if log.request_type == AIAssistanceLog.REQ_LITERATURE_SEARCH
                and log.status == AIAssistanceLog.STATUS_SUCCESS
            ]
            if lit_logs:
                compatible_log = any(
                    isinstance(log.request_payload, dict)
                    and log.request_payload.get("openalex_year_from") == year_from
                    and log.request_payload.get("openalex_year_to") == year_to
                    for log in lit_logs
                )
                if not compatible_log:
                    continue

            cand_subfactors = list(cand.evaluation_subfactors.all())
            cand_subfactor_ids = {int(esf.subfactor_id) for esf in cand_subfactors}
            if cand_subfactor_ids != active_subfactor_ids:
                continue

            sources_by_factor: dict[int, list[dict[str, Any]]] = {}
            has_verified_doi = False
            year_mismatch = False
            for ef in cand.evaluation_factors.all():
                raw_sources = ef.ai_literature_sources or []
                if not isinstance(raw_sources, list) or not raw_sources:
                    continue
                clean_sources: list[dict[str, Any]] = []
                for src in raw_sources:
                    if not isinstance(src, dict):
                        continue
                    doi = str(src.get("doi") or "").strip()
                    if not doi:
                        continue
                    src_year = src.get("publication_year") or src.get("year")
                    if src_year is not None:
                        try:
                            yr = int(src_year)
                            if yr < year_from or yr > year_to:
                                year_mismatch = True
                                break
                        except (TypeError, ValueError):
                            pass
                    clean_sources.append(deepcopy(src))
                    has_verified_doi = True
                if year_mismatch:
                    break
                if clean_sources:
                    sources_by_factor[int(ef.factor_id)] = clean_sources

            if year_mismatch or not has_verified_doi:
                continue

            citations_by_subfactor = {
                int(esf.subfactor_id): max(0, int(esf.ai_citations_count or 0))
                for esf in cand_subfactors
            }
            return self._build_snapshot_result(
                citations_by_subfactor=citations_by_subfactor,
                sources_by_factor=sources_by_factor,
                source_eval_id=cand.pk,
                year_from=year_from,
                year_to=year_to,
            )

        return None

    def search_literature_and_citations(
        self,
        evaluation: Evaluation,
        academic_works: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Paso 0 / Fase 2: búsqueda y conteo de literatura por subfactor."""
        subfactors_data = self._load_subfactors()
        year_from, year_to = self._get_literature_year_window()
        root_name = extract_root_software_name(evaluation.software_name or "").strip().lower()
        cache_key = (
            root_name,
            year_from,
            year_to,
            tuple(int(sf["id"]) for sf in subfactors_data),
            type(self.primary_provider).__name__,
        )

        if academic_works is None and self._is_real_literature_provider() and root_name:
            reused_snapshot: dict[str, Any] | None = None
            cached = self._consistent_literature_cache.get(cache_key)
            if cached is not None:
                source_eval_id = cached["source_eval_id"]
                if Evaluation.objects.filter(pk=source_eval_id).exists():
                    reused_snapshot = self._build_snapshot_result(
                        citations_by_subfactor=cached["result"].get("citations_by_subfactor", {}),
                        sources_by_factor=cached["result"].get("sources_by_factor", {}),
                        source_eval_id=source_eval_id,
                        year_from=year_from,
                        year_to=year_to,
                    )
                else:
                    self._consistent_literature_cache.pop(cache_key, None)

            if reused_snapshot is None:
                reused_snapshot = self._find_consistent_openalex_snapshot(
                    evaluation, subfactors_data, year_from, year_to
                )
                if reused_snapshot is not None:
                    self._consistent_literature_cache[cache_key] = {
                        "source_eval_id": reused_snapshot["snapshot_source_evaluation_id"],
                        "result": deepcopy(reused_snapshot),
                    }

            if reused_snapshot is not None:
                snapshot_payload = {
                    **self._literature_payload(evaluation, subfactors_data),
                    "openalex_year_from": year_from,
                    "openalex_year_to": year_to,
                    "snapshot_reused": True,
                    "snapshot_source_evaluation_id": reused_snapshot["snapshot_source_evaluation_id"],
                    "consistency_mode": "enfoque_a",
                    "provider": type(self.primary_provider).__name__,
                    "cascade_level": "snapshot",
                }
                self._log(
                    evaluation=evaluation,
                    request_type=AIAssistanceLog.REQ_LITERATURE_SEARCH,
                    payload=snapshot_payload,
                    status=AIAssistanceLog.STATUS_SUCCESS,
                    response=reused_snapshot,
                    duration_ms=0,
                )
                return reused_snapshot

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
            "openalex_year_from": year_from,
            "openalex_year_to": year_to,
            "consistency_mode": "enfoque_a",
        }

        if isinstance(self.primary_provider, AzureAIProvider):
            result = self._search_literature_azure_window(
                evaluation, subfactors_data, payload, academic_works=academic_works
            )
        else:
            result = self._search_literature_chunks(
                evaluation,
                subfactors_data,
                payload,
                API_LITERATURE_CHUNK_SIZE,
                start_level="primario",
                academic_works=academic_works,
            )

        if (
            academic_works is None
            and self._is_real_literature_provider()
            and root_name
            and self._has_verified_doi_sources(result)
        ):
            self._consistent_literature_cache[cache_key] = {
                "source_eval_id": evaluation.pk,
                "result": deepcopy(result),
            }

        return result

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
        enriched_desc = evaluation.software_description or ""
        repo_health = getattr(evaluation, "repo_health_metrics", None)
        if isinstance(repo_health, dict) and repo_health.get("status") == "ok":
            rel = (repo_health.get("latest_release") or {}).get("tag_name") or "sin release formal"
            repo_note = (
                f"[Telemetría verificada del repositorio {repo_health.get('repo_full_name')}: "
                f"Vitalidad {repo_health.get('health_score')}/100 ({repo_health.get('health_grade')}), "
                f"Licencia {repo_health.get('license_spdx') or 'no declarada'}, "
                f"Último push hace {repo_health.get('days_since_last_push')} días, "
                f"Release {rel}, {repo_health.get('stars')} stars, "
                f"{repo_health.get('contributors_count') or 'N/D'} contribuidores]"
            )
            enriched_desc = f"{enriched_desc}\n{repo_note}".strip()

        return self._cascade(
            evaluation=evaluation,
            request_type=AIAssistanceLog.REQ_SUBFACTOR_RATING,
            payload=payload,
            factor=factor,
            call=lambda provider: provider.suggest_factor_ratings(
                factor_name=factor.name,
                software_name=evaluation.software_name,
                software_category=evaluation.software_category,
                software_description=enriched_desc,
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
