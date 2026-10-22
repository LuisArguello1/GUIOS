"""
Servicios de la evaluación pública (Paso 5): crear la evaluación con sus
instantáneas, guardar cada cambio, calcular el resumen con el motor y emitir el
dictamen. Las evaluaciones completadas quedan bloqueadas (§8.2, decisión 1).
"""
import secrets
import uuid

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

from apps.auth.middleware.audit import get_audit_context
from apps.auth.models.audit import AuditLog

from ..models import (
    Evaluation,
    EvaluationFactor,
    EvaluationResult,
    EvaluationSubfactor,
    EvaluationVerdict,
)
from ..selectors.catalog import evaluable_factors
from ..selectors.evaluation import build_engine_inputs, evaluation_factors, hash_session_token
from . import engine
from .verdict_text import build_explanation


class EvaluationLocked(Exception):
    """La evaluación ya tiene dictamen y no admite cambios."""


class EvaluationIncomplete(Exception):
    def __init__(self, missing):
        super().__init__("La evaluación tiene datos pendientes.")
        self.missing = missing


class InvalidChange(Exception):
    """El cambio no está permitido para este factor (p. ej., elegir un ámbito fijo)."""


def _ensure_open(evaluation: Evaluation):
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationLocked("La evaluación ya tiene dictamen y está cerrada.")


@transaction.atomic
def create_evaluation(**data) -> tuple[Evaluation, str]:
    """
    Crea la evaluación y copia del catálogo activo las instantáneas de IS, nombre
    del factor y texto de cada subfactor. Todo arranca "sin calificar".
    Devuelve la evaluación y el token de sesión en claro (solo se entrega aquí).
    """
    token = secrets.token_urlsafe(32)
    evaluation = Evaluation.objects.create(session_token=hash_session_token(token), **data)

    factors = list(evaluable_factors())
    EvaluationFactor.objects.bulk_create([
        EvaluationFactor(
            evaluation=evaluation,
            factor=factor,
            suggested_importance_snapshot=factor.suggested_importance,
            factor_name_snapshot=factor.name,
            scope_used='' if factor.scope_configurable else factor.scope,
        )
        for factor in factors
    ])
    EvaluationSubfactor.objects.bulk_create([
        EvaluationSubfactor(
            evaluation=evaluation,
            subfactor=subfactor,
            description_snapshot=subfactor.description,
        )
        for factor in factors
        for subfactor in factor.active_subfactors
    ])
    return evaluation, token


def set_decisor_importance(evaluation: Evaluation, item: EvaluationFactor, value) -> None:
    """Guarda la ID (1-4 o None = sin calificar) y recalcula IR y relevancia."""
    _ensure_open(evaluation)
    item.decisor_importance = value
    if value is None:
        item.relative_importance = None
        item.is_relevant = None
    else:
        item.relative_importance = engine.relative_importance(item.suggested_importance_snapshot, value)
        item.is_relevant = engine.is_relevant(item.relative_importance)
    item.save(update_fields=['decisor_importance', 'relative_importance', 'is_relevant'])


def set_scope(evaluation: Evaluation, item: EvaluationFactor, value) -> None:
    """Guarda el ámbito elegido; solo para el factor configurable (Soporte, RN-06)."""
    _ensure_open(evaluation)
    if not item.factor.scope_configurable:
        raise InvalidChange("Solo el factor con ámbito configurable (Soporte) permite elegir el ámbito.")
    item.scope_used = value or ''
    item.save(update_fields=['scope_used'])


def set_rating(evaluation: Evaluation, item: EvaluationSubfactor, value) -> None:
    """Guarda la calificación (1-4 o None = sin calificar)."""
    _ensure_open(evaluation)
    item.rating = value
    item.save(update_fields=['rating', 'saved_at'])


def compute_outcome(evaluation: Evaluation):
    """Resultado del motor con el estado actual (instantáneas y valores guardados)."""
    factors = evaluation_factors(evaluation)
    return factors, engine.evaluate(build_engine_inputs(factors))


def generate_verdict(evaluation: Evaluation):
    """
    Emite el dictamen en una sola transacción: resultados por factor, dictamen,
    estado completed con completed_at y registro de auditoría. Si algo falla, no
    se guarda nada.
    """
    with transaction.atomic():
        evaluation = Evaluation.objects.select_for_update().get(pk=evaluation.pk)
        _ensure_open(evaluation)

        factors, outcome = compute_outcome(evaluation)
        if not outcome.is_complete:
            raise EvaluationIncomplete(outcome.missing)

        results = [r for r in outcome.factors if r.is_relevant]
        EvaluationResult.objects.filter(evaluation=evaluation).delete()
        EvaluationResult.objects.bulk_create([
            EvaluationResult(
                evaluation=evaluation,
                factor_id=int(result.code),
                weighted_average=result.weighted_average_display,
                meets_threshold=result.meets_threshold,
                foda_classification=result.foda,
            )
            for result in results
        ])

        verdict = EvaluationVerdict.objects.create(
            evaluation=evaluation,
            recommendation=outcome.verdict.recommendation,
            explanation_text=build_explanation(outcome.verdict),
        )

        evaluation.status = Evaluation.STATUS_COMPLETED
        evaluation.completed_at = timezone.now()
        evaluation.save(update_fields=['status', 'completed_at'])

        _audit_verdict(evaluation, verdict, outcome)

    return evaluation, verdict


def _request_uuid(value):
    """X-Request-ID lo envía el cliente: si no es un UUID válido, se omite."""
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


def _audit_verdict(evaluation, verdict, outcome):
    """Registro explícito de "dictamen generado" (RF-ADM-37, §8.2)."""
    ctx = get_audit_context()
    causing = [r.name for r in outcome.verdict.causing_factors]
    AuditLog.objects.create(
        action='CREATE',
        source='api',
        reason=f"Dictamen generado ({verdict.recommendation})",
        content_type=ContentType.objects.get_for_model(EvaluationVerdict),
        object_id=str(verdict.pk),
        user=ctx['user'],
        ip_address=ctx['ip_address'],
        user_agent=ctx['user_agent'] or '',
        session_key=ctx['session_key'] or '',
        request_id=_request_uuid(ctx['request_id']),
        after={
            'evaluation_uuid': str(evaluation.uuid),
            'software_name': evaluation.software_name,
            'org_name': evaluation.org_name,
            'recommendation': verdict.recommendation,
            'causing_factors': causing,
        },
        extra={'event': 'verdict_generated'},
    )
