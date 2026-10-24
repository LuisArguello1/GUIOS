"""
apps/guios/services/evaluation.py
─────────────────────────────────────────────────────────────────────────────
Capa de servicios de negocio para Evaluaciones de Software en GUIOS.
Orquesta tanto el flujo administrativo (con cálculo por literatura y Celery)
como el flujo wizard público (con instantáneas inmutables y auditoría formal).
"""
import secrets
import uuid
from typing import Optional, Any
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone

from apps.auth.middleware.audit import get_audit_context
from apps.auth.models.audit import AuditLog

from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
    Factor,
    Subfactor,
)
from apps.guios.exceptions import (
    EvaluationNotFoundError,
    EvaluationAlreadyCompletedError,
    EvaluationValidationError,
)
from apps.guios.selectors.catalog import evaluable_factors
from apps.guios.selectors.evaluation import (
    get_evaluation_or_error,
    build_engine_inputs,
    evaluation_factors,
    hash_session_token,
)
from apps.guios.services.methodology import (
    compute_evaluation_literature_metrics,
    apply_step1_decisor_importance,
    apply_step3_subfactor_ratings_and_foda,
    compute_final_verdict,
)
from . import engine
from .ai import is_available as ai_is_available
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
def create_evaluation(
    *,
    software_name: str,
    org_name: str,
    software_category: str = "",
    software_version: str = "",
    software_repo_url: Optional[str] = None,
    software_description: str = "",
    org_sector: str = "",
    org_description: str = "",
    ai_enabled: bool = False,
    auto_compute_literature: bool = False,
    user: Optional[Any] = None,
    session_token: Optional[str] = None,
    **extra_kwargs,
) -> tuple[Evaluation, str]:
    """
    Crea la evaluación y copia del catálogo activo las instantáneas de IS, nombre
    del factor y texto de cada subfactor.
    Devuelve siempre una tupla (evaluation, plain_token).
    """
    token = secrets.token_urlsafe(32)
    clean_software_name = software_name.strip()
    if not clean_software_name:
        raise EvaluationValidationError("El nombre del software es obligatorio.")
    clean_org_name = org_name.strip()
    if not clean_org_name:
        raise EvaluationValidationError("El nombre de la organización es obligatorio.")

    raw_token_hash = session_token or hash_session_token(token)

    ai_active = bool(ai_enabled) and ai_is_available()

    evaluation = Evaluation.objects.create(
        software_name=clean_software_name,
        software_category=software_category.strip() if software_category else "",
        software_version=software_version.strip() if software_version else "",
        software_repo_url=software_repo_url.strip() if software_repo_url else None,
        software_description=software_description.strip() if software_description else "",
        org_name=clean_org_name,
        org_sector=org_sector.strip() if org_sector else "",
        org_description=org_description.strip() if org_description else "",
        ai_enabled=ai_active,
        created_by=user if user and user.is_authenticated else None,
        session_token=raw_token_hash,
        status=Evaluation.STATUS_IN_PROGRESS,
    )

    factors = list(evaluable_factors()) if callable(evaluable_factors) else list(Factor.objects.filter(is_active=True))
    if not factors:
        factors = list(Factor.objects.filter(is_active=True))

    EvaluationFactor.objects.bulk_create([
        EvaluationFactor(
            evaluation=evaluation,
            factor=factor,
            suggested_importance_snapshot=factor.suggested_importance,
            subfactors_count_snapshot=max(1, factor.subfactors.count() if hasattr(factor, 'subfactors') else 1),
            citations_count=0,
            citation_ratio=0.0,
            literature_importance_calculated=getattr(factor, 'literature_importance_base', 1),
            expert_importance_snapshot=getattr(factor, 'expert_importance', 3),
            factor_name_snapshot=factor.name,
            scope_used='' if factor.scope_configurable else factor.scope,
        )
        for factor in factors
    ])

    subfactors_to_create = []
    for factor in factors:
        sfs = getattr(factor, 'active_subfactors', None)
        if sfs is None:
            sfs = factor.subfactors.filter(is_active=True) if hasattr(factor, 'subfactors') else []
        for sf in sfs:
            subfactors_to_create.append(
                EvaluationSubfactor(
                    evaluation=evaluation,
                    subfactor=sf,
                    description_snapshot=sf.description,
                    ai_citations_count=getattr(sf, 'base_citations_count', 0),
                    rating=None,
                )
            )

    if subfactors_to_create:
        EvaluationSubfactor.objects.bulk_create(subfactors_to_create)

    if auto_compute_literature:
        try:
            compute_evaluation_literature_metrics(evaluation)
        except Exception:
            pass

    return evaluation, token


@transaction.atomic
def update_evaluation(
    *,
    evaluation_id: int | str,
    software_name: Optional[str] = None,
    software_category: Optional[str] = None,
    software_version: Optional[str] = None,
    software_repo_url: Optional[str] = None,
    software_description: Optional[str] = None,
    org_name: Optional[str] = None,
    org_sector: Optional[str] = None,
    org_description: Optional[str] = None,
) -> Evaluation:
    evaluation = get_evaluation_or_error(evaluation_id)

    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"La evaluación #{evaluation.id} ya se encuentra completada y su historial está protegido."
        )

    update_fields = []
    if software_name is not None:
        clean_name = software_name.strip()
        if not clean_name:
            raise EvaluationValidationError("El nombre del software no puede estar vacío.")
        evaluation.software_name = clean_name
        update_fields.append('software_name')

    if org_name is not None:
        clean_org = org_name.strip()
        if not clean_org:
            raise EvaluationValidationError("El nombre de la organización no puede estar vacío.")
        evaluation.org_name = clean_org
        update_fields.append('org_name')

    if software_category is not None:
        evaluation.software_category = software_category.strip()
        update_fields.append('software_category')

    if software_version is not None:
        evaluation.software_version = software_version.strip()
        update_fields.append('software_version')

    if software_repo_url is not None:
        evaluation.software_repo_url = software_repo_url.strip() if software_repo_url else None
        update_fields.append('software_repo_url')

    if software_description is not None:
        evaluation.software_description = software_description.strip()
        update_fields.append('software_description')

    if org_sector is not None:
        evaluation.org_sector = org_sector.strip()
        update_fields.append('org_sector')

    if org_description is not None:
        evaluation.org_description = org_description.strip()
        update_fields.append('org_description')

    if update_fields:
        evaluation.save(update_fields=update_fields)

    return evaluation


@transaction.atomic
def calculate_evaluation_literature(
    evaluation_id: int | str,
    *,
    ai_citations_by_subfactor: Optional[dict[int, int]] = None,
    ai_sources_by_factor: Optional[dict[int, list[dict]]] = None,
) -> Evaluation:
    evaluation = get_evaluation_or_error(evaluation_id)
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"No se puede recalcular literatura en la evaluación #{evaluation.id} porque ya está concluida."
        )

    compute_evaluation_literature_metrics(
        evaluation=evaluation,
        ai_citations_by_subfactor=ai_citations_by_subfactor,
        ai_sources_by_factor=ai_sources_by_factor,
    )
    return evaluation


@transaction.atomic
def save_decisor_importance(
    evaluation_id: int | str,
    *,
    factors_data: Optional[list[dict]] = None,
    decisor_data: Optional[list[dict]] = None,
) -> Evaluation:
    data = factors_data if factors_data is not None else (decisor_data or [])
    evaluation = get_evaluation_or_error(evaluation_id)
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"No se pueden modificar factores en la evaluación #{evaluation.id} porque está cerrada."
        )

    apply_step1_decisor_importance(
        evaluation=evaluation,
        decisor_data=data,
    )
    return evaluation


@transaction.atomic
def save_subfactor_ratings(
    evaluation_id: int | str,
    *,
    ratings_by_subfactor: Optional[dict[int, int]] = None,
    ratings_data: Optional[Any] = None,
) -> Evaluation:
    evaluation = get_evaluation_or_error(evaluation_id)
    if evaluation.status == Evaluation.STATUS_COMPLETED:
        raise EvaluationAlreadyCompletedError(
            f"No se pueden calificar subfactores en la evaluación #{evaluation.id} porque está concluida."
        )

    ratings_dict = ratings_by_subfactor
    if ratings_dict is None and isinstance(ratings_data, dict):
        ratings_dict = ratings_data
    elif ratings_dict is None and isinstance(ratings_data, list):
        ratings_dict = {
            item['subfactor_id']: item['rating']
            for item in ratings_data
            if 'subfactor_id' in item and 'rating' in item
        }
    if ratings_dict is None:
        ratings_dict = {}

    apply_step3_subfactor_ratings_and_foda(
        evaluation=evaluation,
        ratings_by_subfactor=ratings_dict,
    )
    return evaluation


@transaction.atomic
def generate_evaluation_verdict(
    evaluation_id: int | str,
    *,
    ai_executive_summary: str = "",
    ai_mitigation_plan: str = "",
) -> EvaluationVerdict:
    evaluation = get_evaluation_or_error(evaluation_id)
    if evaluation.status == Evaluation.STATUS_COMPLETED and hasattr(evaluation, 'verdict'):
        return evaluation.verdict

    verdict = compute_final_verdict(
        evaluation=evaluation,
        ai_executive_summary=ai_executive_summary,
        ai_mitigation_plan=ai_mitigation_plan,
    )
    return verdict


@transaction.atomic
def delete_evaluation(evaluation_id: int | str) -> bool:
    evaluation = get_evaluation_or_error(evaluation_id)
    evaluation.delete()
    return True


REGISTRATION_FIELDS = (
    'software_name', 'software_version', 'software_repo_url',
    'org_name', 'org_sector', 'org_description',
)


@transaction.atomic
def duplicate_evaluation(original: Evaluation) -> tuple[Evaluation, str]:
    """
    Copia una evaluación (normalmente cerrada) en una nueva "en progreso", con su
    propio token: registro, instantáneas, ID, IR, relevancia, ámbitos y
    calificaciones. Las instantáneas son las de la original, no las del catálogo
    vivo. La original no cambia. No copia sugerencias de IA ni el dictamen.
    """
    token = secrets.token_urlsafe(32)
    copy = Evaluation.objects.create(
        session_token=hash_session_token(token),
        ai_enabled=original.ai_enabled and ai_is_available(),
        **{field: getattr(original, field) for field in REGISTRATION_FIELDS},
    )
    EvaluationFactor.objects.bulk_create([
        EvaluationFactor(
            evaluation=copy,
            factor_id=item.factor_id,
            suggested_importance_snapshot=item.suggested_importance_snapshot,
            factor_name_snapshot=item.factor_name_snapshot,
            decisor_importance=item.decisor_importance,
            relative_importance=item.relative_importance,
            is_relevant=item.is_relevant,
            scope_used=item.scope_used,
        )
        for item in EvaluationFactor.objects.filter(evaluation=original).order_by('pk')
    ])
    EvaluationSubfactor.objects.bulk_create([
        EvaluationSubfactor(
            evaluation=copy,
            subfactor_id=item.subfactor_id,
            description_snapshot=item.description_snapshot,
            rating=item.rating,
        )
        for item in EvaluationSubfactor.objects.filter(evaluation=original).order_by('pk')
    ])
    return copy, token


def set_decisor_importance(evaluation: Evaluation, item: EvaluationFactor, value) -> None:
    """
    Guarda la ID (1-4 o None = sin calificar) y recalcula IR y relevancia.
    La sugerencia de IA cuenta como aceptada solo si el valor es igual a ella.
    """
    _ensure_open(evaluation)
    item.decisor_importance = value
    item.id_was_ai_accepted = value is not None and value == getattr(item, 'ai_suggested_id', None)
    if value is None:
        item.relative_importance = None
        item.is_relevant = None
    else:
        item.relative_importance = engine.relative_importance(item.suggested_importance_snapshot, value)
        item.is_relevant = engine.is_relevant(item.relative_importance)
    item.save(update_fields=['decisor_importance', 'relative_importance', 'is_relevant', 'id_was_ai_accepted'])


def set_scope(evaluation: Evaluation, item: EvaluationFactor, value) -> None:
    """Guarda el ámbito elegido; solo para el factor configurable (Soporte, RN-06)."""
    _ensure_open(evaluation)
    if not item.factor.scope_configurable:
        raise InvalidChange("Solo el factor con ámbito configurable (Soporte) permite elegir el ámbito.")
    item.scope_used = value or ''
    item.save(update_fields=['scope_used'])


def set_rating(evaluation: Evaluation, item: EvaluationSubfactor, value) -> None:
    """Guarda la calificación (1-4 o None = sin calificar); aceptada si es igual a la sugerencia de IA."""
    _ensure_open(evaluation)
    item.rating = value
    item.rating_was_ai_accepted = value is not None and value == getattr(item, 'ai_suggested_rating', None)
    item.save(update_fields=['rating', 'rating_was_ai_accepted', 'saved_at'])


def update_factor(evaluation: Evaluation, factor_id: int, **changes):
    with transaction.atomic():
        evaluation = Evaluation.objects.select_for_update().get(pk=evaluation.pk)
        _ensure_open(evaluation)
        item = EvaluationFactor.objects.select_for_update().select_related('factor').filter(
            evaluation=evaluation, factor_id=factor_id,
        ).first()
        if item is None:
            raise EvaluationNotFoundError("Factor no encontrado en esta evaluación.")

        fields = []
        if 'decisor_importance' in changes:
            item.decisor_importance = changes['decisor_importance']
            fields.append('decisor_importance')

        if 'scope_used' in changes:
            scope = changes['scope_used']
            if not item.factor.scope_configurable:
                if scope not in (None, '', item.factor.scope):
                    raise InvalidChange("El ámbito de este factor está fijado por la metodología (RN-06).")
            else:
                item.scope_used = scope or ''
                fields.append('scope_used')

        if fields:
            item.save(update_fields=fields)
        return item


def update_subfactor(evaluation: Evaluation, subfactor_id: int, rating: Optional[int]):
    with transaction.atomic():
        evaluation = Evaluation.objects.select_for_update().get(pk=evaluation.pk)
        _ensure_open(evaluation)
        sub = EvaluationSubfactor.objects.select_for_update().filter(
            evaluation=evaluation, subfactor_id=subfactor_id,
        ).first()
        if sub is None:
            raise EvaluationNotFoundError("Subfactor no encontrado en esta evaluación.")

        sub.rating = rating
        sub.save(update_fields=['rating', 'saved_at'])
        return sub


def compute_outcome(evaluation: Evaluation):
    factors = evaluation_factors(evaluation)
    return factors, engine.evaluate(build_engine_inputs(factors))


def generate_verdict(evaluation: Evaluation):
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
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


def _audit_verdict(evaluation, verdict, outcome):
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
