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
from celery import shared_task
from django.db import transaction

from apps.guios.models.evaluation import Evaluation
from apps.guios.services.ai import ai_service
from apps.guios.services.evaluation import calculate_evaluation_literature
from apps.guios.services.repository_health import sync_evaluation_repo_health

logger = logging.getLogger(__name__)


def enqueue_literature_search(evaluation_id: int) -> str | None:
    """
    Deja la evaluación en búsqueda y encola el mapeo bibliográfico.
    Si el broker no acepta la tarea, conserva las citas base y marca el fallo.
    """
    try:
        evaluation = Evaluation.objects.get(pk=evaluation_id)
    except Evaluation.DoesNotExist:
        logger.error("No se encoló literatura: la evaluación #%s no existe.", evaluation_id)
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

        # Solo citas y cuartiles. Las sugerencias de factores y subfactores se piden aparte.
        with transaction.atomic():
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
