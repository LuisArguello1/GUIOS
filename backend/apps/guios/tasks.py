"""
apps/guios/tasks.py
───────────────────────────────────────────────────────────────────────────────
Tareas asíncronas de Celery para el procesamiento en segundo plano de Inteligencia Artificial (GUIOS).
Sigue las reglas de celery-patterns.md:
- Las tareas son sin estado y reciben únicamente IDs primitivos (evaluation_id: int).
- Manejo de reintentos e idempotencia.
- Actualización reactiva del estado `ai_status` en la entidad Evaluation.
"""
import logging
from datetime import timedelta
from unittest.mock import NonCallableMock
from celery import current_app, shared_task
from celery.signals import task_postrun, task_prerun, worker_shutdown
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.guios.models.evaluation import Evaluation
from apps.guios.services.ai import ai_service
from apps.guios.services.evaluation import calculate_evaluation_literature
from apps.guios.services.repository_health import sync_evaluation_repo_health

logger = logging.getLogger(__name__)

_CELERY_BUSY_CACHE_KEY = "guios_celery_worker_busy"
_CELERY_BUSY_TTL_SECONDS = 300


@task_prerun.connect
def _mark_worker_busy(task_id=None, task=None, **kwargs):
    if getattr(task, "name", "").endswith("execute_evaluation_literature_ai_task"):
        cache.set(_CELERY_BUSY_CACHE_KEY, True, timeout=_CELERY_BUSY_TTL_SECONDS)


@task_postrun.connect
def _clear_worker_busy(task_id=None, task=None, **kwargs):
    if getattr(task, "name", "").endswith("execute_evaluation_literature_ai_task"):
        cache.delete(_CELERY_BUSY_CACHE_KEY)


@worker_shutdown.connect
def _clear_worker_busy_on_shutdown(**kwargs):
    cache.delete(_CELERY_BUSY_CACHE_KEY)


def _has_ai_credentials_configured() -> bool:
    """Verifica si existe al menos un proveedor LLM externo configurado."""
    has_azure = bool(
        str(getattr(settings, "AZURE_OPENAI_API_KEY", "") or "").strip()
        and str(getattr(settings, "AZURE_OPENAI_ENDPOINT", "") or "").strip()
    )
    has_groq = bool(str(getattr(settings, "GROQ_API_KEY", "") or "").strip())
    has_cohere = bool(str(getattr(settings, "COHERE_API_KEY", "") or "").strip())
    return has_azure or has_groq or has_cohere


def _has_active_celery_worker() -> bool:
    """
    Comprueba de forma segura si existe al menos un worker Celery activo.
    Si el worker está ocupado ejecutando otra búsqueda (p. ej. --pool=solo en Windows),
    evita marcar erróneamente como caído un encolamiento concurrente.
    """
    try:
        ping_result = current_app.control.inspect(timeout=1.0).ping()
        if ping_result:
            return True
    except Exception as exc:
        logger.warning("No se pudo verificar el estado de los workers de Celery: %s", exc)

    if cache.get(_CELERY_BUSY_CACHE_KEY):
        return True

    recent_cutoff = timezone.now() - timedelta(seconds=_CELERY_BUSY_TTL_SECONDS)
    return Evaluation.objects.filter(
        ai_enabled=True,
        ai_status=Evaluation.AI_STATUS_SEARCHING,
        started_at__gte=recent_cutoff,
    ).exists()


def enqueue_literature_search(evaluation_id: int) -> str | None:
    """
    Deja la evaluación en búsqueda y encola el mapeo bibliográfico.
    Si el broker no acepta la tarea, no hay worker activo o faltan claves IA,
    conserva las citas base y marca el fallo sin bloquear al usuario (D-31).
    """
    try:
        evaluation = Evaluation.objects.get(pk=evaluation_id)
    except Evaluation.DoesNotExist:
        logger.error("No se encoló literatura: la evaluación #%s no existe.", evaluation_id)
        return None

    is_mocked = isinstance(
        getattr(execute_evaluation_literature_ai_task, "delay", None),
        NonCallableMock,
    )
    if not is_mocked and not getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
        if not _has_ai_credentials_configured() or not _has_active_celery_worker():
            if not evaluation.evaluation_factors.exists():
                calculate_evaluation_literature(evaluation_id=evaluation_id)
            evaluation.ai_status = Evaluation.AI_STATUS_FAILED
            evaluation.save(update_fields=["ai_status"])
            logger.warning(
                "IA o worker Celery no disponibles para evaluación #%s; degradado a citas base.",
                evaluation_id,
            )
            return None

    evaluation.ai_status = Evaluation.AI_STATUS_SEARCHING
    evaluation.save(update_fields=["ai_status"])

    try:
        async_result = execute_evaluation_literature_ai_task.delay(evaluation_id)
        return str(async_result.id)
    except Exception:
        logger.exception(
            "No se pudo encolar la búsqueda de literatura de la evaluación #%s.",
            evaluation_id,
        )
        evaluation.ai_status = Evaluation.AI_STATUS_FAILED
        evaluation.save(update_fields=["ai_status"])
        return None


@shared_task(bind=True, max_retries=2, default_retry_delay=5)
def execute_evaluation_literature_ai_task(self, evaluation_id: int) -> dict:
    """
    Tarea Celery asíncrona que ejecuta la recolección de literatura científica y cálculo
    dinámico de cuartiles (Fase 2 / Paso 0) sin bloquear el navegador del usuario.
    """
    try:
        evaluation = Evaluation.objects.get(pk=evaluation_id)
    except Evaluation.DoesNotExist:
        logger.error("Tarea Celery abortada: Evaluación #%s no existe.", evaluation_id)
        return {"success": False, "error": f"Evaluation #{evaluation_id} not found"}

    if not evaluation.ai_enabled:
        logger.info("Tarea de literatura omitida: Evaluación #%s continúa sin IA.", evaluation.id)
        return {"success": False, "evaluation_id": evaluation.id, "skipped": True}

    # Actualizar estado a "Buscando literatura"
    evaluation.ai_status = Evaluation.AI_STATUS_SEARCHING
    evaluation.save(update_fields=['ai_status'])
    logger.info("Iniciando búsqueda de literatura IA para Evaluación #%s (%s)", evaluation.id, evaluation.software_name)

    try:
        # Extraer telemetría viva del repositorio FLOSS si aplica (best-effort)
        if evaluation.software_repo_url and not evaluation.repo_health_metrics:
            try:
                sync_evaluation_repo_health(evaluation, force=False)
            except Exception as repo_exc:
                logger.warning("No se pudo sincronizar pulso de repositorio en tarea IA #%s: %s", evaluation.id, repo_exc)

        # Invocar servicio de IA (con fallback automático y auditoría en AIAssistanceLog)
        ai_result = ai_service.search_literature_and_citations(evaluation=evaluation)

        citations_by_subfactor = ai_result.get("citations_by_subfactor", {})
        sources_by_factor = ai_result.get("sources_by_factor", {})

        # Si el usuario optó por continuar sin IA mientras la tarea corría, no sobrescribir
        with transaction.atomic():
            evaluation.refresh_from_db()
            if not evaluation.ai_enabled:
                logger.info(
                    "Búsqueda IA completada pero descartada porque Evaluación #%s pasó a modo sin IA.",
                    evaluation.id,
                )
                return {"success": False, "evaluation_id": evaluation.id, "skipped": True}

            calculate_evaluation_literature(
                evaluation_id=evaluation.id,
                ai_citations_by_subfactor=citations_by_subfactor,
                ai_sources_by_factor=sources_by_factor,
            )
            evaluation.refresh_from_db()
            evaluation.ai_status = Evaluation.AI_STATUS_COMPLETED
            evaluation.save(update_fields=['ai_status'])

        logger.info(
            "Literatura IA completada con éxito para Evaluación #%s. Cortes: q1=%s, q2=%s, q3=%s, q4=%s",
            evaluation.id,
            evaluation.q1_threshold,
            evaluation.q2_threshold,
            evaluation.q3_threshold,
            evaluation.q4_threshold,
        )
        return {
            "success": True,
            "evaluation_id": evaluation.id,
            "ai_status": Evaluation.AI_STATUS_COMPLETED,
            "q1": str(evaluation.q1_threshold),
            "q2": str(evaluation.q2_threshold),
            "q3": str(evaluation.q3_threshold),
            "q4": str(evaluation.q4_threshold),
        }

    except Exception as exc:
        logger.exception("Error en tarea Celery de literatura IA para Evaluación #%s: %s", evaluation.id, exc)
        evaluation.ai_status = Evaluation.AI_STATUS_FAILED
        evaluation.save(update_fields=['ai_status'])
        return {
            "success": False,
            "evaluation_id": evaluation.id,
            "error": str(exc),
        }
