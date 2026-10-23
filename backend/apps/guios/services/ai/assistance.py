"""
Operaciones de asistencia de IA (RF-IA-02 a RF-IA-07): sugerir la ID de cada
factor, sugerir la calificación de los subfactores de un factor relevante y
redactar el informe tras el dictamen.

Cada llamada se registra en AIAssistanceLog (sin credenciales). Las sugerencias
solo llenan los campos ai_*: nunca la ID, la calificación ni el dictamen.
Cualquier falla del proveedor se convierte en AIError y la evaluación sigue en
modo manual.
"""
import json
import time

from django.db import transaction

from ...models import AIAssistanceLog, Evaluation, EvaluationFactor, EvaluationSubfactor
from ...selectors.evaluation import evaluation_factors
from ..evaluation import EvaluationLocked, compute_outcome
from . import get_provider, prompts, schemas
from .provider import TASK_REPORT, TASK_SUGGESTION, AIError, AIProviderError


class AIUnavailable(Exception):
    """No hay clave de API: la IA está desactivada."""


class AINotEnabled(Exception):
    """La evaluación se registró sin "Activar asistencia IA"."""


class FactorNotRelevant(Exception):
    """Solo se sugieren calificaciones para factores relevantes (con ID e IR > 1)."""


class VerdictRequired(Exception):
    """El informe solo se genera después del dictamen."""


def _provider_for(evaluation: Evaluation):
    provider = get_provider()
    if provider is None:
        raise AIUnavailable("La asistencia de IA no está disponible.")
    if not evaluation.ai_enabled:
        raise AINotEnabled("La evaluación no tiene activada la asistencia de IA.")
    return provider


def _ensure_open(evaluation: Evaluation):
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationLocked("La evaluación ya tiene dictamen y está cerrada.")


def _jsonable(value):
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return {'unserializable': repr(value)[:2000]}


def _call(provider, evaluation, *, request_type, factor_id=None, task, system, payload, schema, validate):
    """Llama al proveedor, valida la respuesta y registra la llamada pase lo que pase."""
    log = AIAssistanceLog(
        evaluation=evaluation,
        request_type=request_type,
        factor_id=factor_id,
        request_payload={'model': provider.model_for(task), 'payload': payload},
    )
    started = time.monotonic()
    try:
        raw = provider.complete(task=task, system=system, payload=payload, schema=schema)
        log.response_payload = _jsonable(raw)
        return validate(raw)
    except AIError as exc:
        log.status, log.error_message = exc.status, str(exc)
        raise
    except Exception as exc:   # cualquier otra falla del proveedor: modo manual
        log.status, log.error_message = AIError.status, f"Error inesperado: {type(exc).__name__}"
        raise AIProviderError("El servicio de IA falló.") from exc
    finally:
        log.response_time_ms = int((time.monotonic() - started) * 1000)
        log.save()


def _locked_evaluation(evaluation):
    locked = Evaluation.objects.select_for_update().get(pk=evaluation.pk)
    _ensure_open(locked)
    return locked


def suggest_importance(evaluation: Evaluation) -> dict:
    """Paso 1-2: sugiere la ID de cada factor. Devuelve {factor_id: (valor, justificación)}."""
    provider = _provider_for(evaluation)
    _ensure_open(evaluation)
    factors = evaluation_factors(evaluation)
    suggestions = _call(
        provider, evaluation,
        request_type=AIAssistanceLog.REQ_FACTOR_IMPORTANCE,
        task=TASK_SUGGESTION,
        system=prompts.IMPORTANCE_SYSTEM,
        payload=prompts.importance_payload(evaluation, factors),
        schema=schemas.IMPORTANCE_SCHEMA,
        validate=lambda raw: schemas.validate_suggestions(
            raw, schemas.IMPORTANCE_SCHEMA, 'factor_id', [f.factor_id for f in factors],
        ),
    )
    with transaction.atomic():
        _locked_evaluation(evaluation)
        for item in factors:
            item.ai_suggested_id, item.ai_id_justification = suggestions[item.factor_id]
            item.id_was_ai_accepted = False
        EvaluationFactor.objects.bulk_update(
            factors, ['ai_suggested_id', 'ai_id_justification', 'id_was_ai_accepted'],
        )
    return suggestions


def suggest_ratings(evaluation: Evaluation, factor_id: int) -> dict:
    """Paso 3-4: sugiere la calificación de cada subfactor de un factor relevante."""
    provider = _provider_for(evaluation)
    _ensure_open(evaluation)
    item = next((f for f in evaluation_factors(evaluation) if f.factor_id == factor_id), None)
    if item is None:
        raise LookupError("El factor no pertenece a esta evaluación.")
    if not item.is_relevant:
        raise FactorNotRelevant(
            "Solo se sugieren calificaciones para factores relevantes (con ID e importancia relativa mayor que Opcional)."
        )
    subfactors = item.items
    suggestions = _call(
        provider, evaluation,
        request_type=AIAssistanceLog.REQ_SUBFACTOR_RATING,
        factor_id=factor_id,
        task=TASK_SUGGESTION,
        system=prompts.RATING_SYSTEM,
        payload=prompts.rating_payload(evaluation, item),
        schema=schemas.RATING_SCHEMA,
        validate=lambda raw: schemas.validate_suggestions(
            raw, schemas.RATING_SCHEMA, 'subfactor_id', [s.subfactor_id for s in subfactors],
        ),
    )
    with transaction.atomic():
        _locked_evaluation(evaluation)
        for sub in subfactors:
            sub.ai_suggested_rating, sub.ai_rating_justification = suggestions[sub.subfactor_id]
            sub.rating_was_ai_accepted = False
        EvaluationSubfactor.objects.bulk_update(
            subfactors, ['ai_suggested_rating', 'ai_rating_justification', 'rating_was_ai_accepted'],
        )
    return suggestions


def generate_report(evaluation: Evaluation):
    """Tras el dictamen: resumen ejecutivo y, en B o C, plan de mitigación. El dictamen no cambia."""
    provider = _provider_for(evaluation)
    verdict = getattr(evaluation, 'verdict', None)
    if evaluation.status != Evaluation.STATUS_COMPLETED or verdict is None:
        raise VerdictRequired("El informe de IA se genera después del dictamen.")
    _, outcome = compute_outcome(evaluation)
    summary, mitigation = _call(
        provider, evaluation,
        request_type=AIAssistanceLog.REQ_EXECUTIVE_SUMMARY,
        task=TASK_REPORT,
        system=prompts.REPORT_SYSTEM,
        payload=prompts.report_payload(evaluation, verdict, outcome),
        schema=schemas.REPORT_SCHEMA,
        validate=lambda raw: schemas.validate_report(raw, verdict.recommendation),
    )
    verdict.ai_executive_summary = summary
    verdict.ai_mitigation_plan = mitigation
    verdict.save(update_fields=['ai_executive_summary', 'ai_mitigation_plan'])
    return verdict
