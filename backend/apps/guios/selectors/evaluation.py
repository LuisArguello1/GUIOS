"""
apps/guios/selectors/evaluation.py
─────────────────────────────────────────────────────────────────────────────
Capa de selectores para Evaluaciones Metodológicas GUIOS.
ÚNICA capa responsable de ejecutar consultas ORM sobre Evaluation y modelos satélite.
Implementa optimizaciones anti N+1 con select_related y prefetch_related explícitos.
"""
import hashlib
import hmac
from typing import Optional
from uuid import UUID
from django.db.models import QuerySet, Q

from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
)
from apps.guios.exceptions import EvaluationNotFoundError


# ── Selectors para el módulo administrativo y API REST ──────────────────────

def get_evaluations_queryset(
    *,
    user=None,
    status: Optional[str] = None,
    software_category: Optional[str] = None,
    search: Optional[str] = None,
) -> QuerySet[Evaluation]:
    """
    Retorna el QuerySet base de evaluaciones optimizado con select_related.
    Permite filtrar por creador, estado metodológico, categoría y búsqueda por texto.
    """
    qs = Evaluation.objects.select_related('created_by', 'verdict').all()

    if user and not user.is_staff and not user.is_superuser:
        qs = qs.filter(created_by=user)

    if status:
        qs = qs.filter(status=status)

    if software_category:
        qs = qs.filter(software_category__iexact=software_category)

    if search:
        clean_search = search.strip()
        qs = qs.filter(
            Q(software_name__icontains=clean_search)
            | Q(org_name__icontains=clean_search)
            | Q(software_category__icontains=clean_search)
        )

    return qs.order_by('-started_at')


def get_evaluation_or_error(evaluation_id: int | str) -> Evaluation:
    try:
        return Evaluation.objects.select_related('created_by', 'verdict').get(pk=evaluation_id)
    except (Evaluation.DoesNotExist, ValueError):
        raise EvaluationNotFoundError(f"La evaluación #{evaluation_id} no existe.")


def get_evaluation_by_uuid_or_error(uuid_str: str) -> Evaluation:
    try:
        return Evaluation.objects.select_related('created_by', 'verdict').get(uuid=uuid_str)
    except (Evaluation.DoesNotExist, ValueError):
        raise EvaluationNotFoundError(f"La evaluación con UUID {uuid_str} no existe.")


def get_evaluation_detail_or_error(evaluation_id: int | str) -> Evaluation:
    try:
        return (
            Evaluation.objects.select_related('created_by', 'verdict')
            .prefetch_related(
                'evaluation_factors__factor__dimension',
                'evaluation_subfactors__subfactor__factor',
                'evaluation_results__factor',
            )
            .get(pk=evaluation_id)
        )
    except (Evaluation.DoesNotExist, ValueError):
        raise EvaluationNotFoundError(f"La evaluación #{evaluation_id} no existe.")


def get_evaluation_factors_queryset(evaluation_id: int | str) -> QuerySet[EvaluationFactor]:
    return (
        EvaluationFactor.objects.filter(evaluation_id=evaluation_id)
        .select_related('factor__dimension')
        .order_by('factor__dimension__order', 'factor__order', 'factor__id')
    )


def get_evaluation_subfactors_queryset(
    evaluation_id: int | str,
    factor_id: Optional[int] = None,
) -> QuerySet[EvaluationSubfactor]:
    qs = (
        EvaluationSubfactor.objects.filter(evaluation_id=evaluation_id)
        .select_related('subfactor__factor__dimension')
        .order_by('subfactor__factor__order', 'subfactor__order', 'subfactor__id')
    )
    if factor_id:
        qs = qs.filter(subfactor__factor_id=factor_id)
    return qs


def get_evaluation_results_queryset(evaluation_id: int | str) -> QuerySet[EvaluationResult]:
    return (
        EvaluationResult.objects.filter(evaluation_id=evaluation_id)
        .select_related('factor__dimension')
        .order_by('factor__dimension__order', 'factor__order', 'factor__id')
    )


def get_evaluation_verdict_or_none(evaluation_id: int | str) -> Optional[EvaluationVerdict]:
    return EvaluationVerdict.objects.filter(evaluation_id=evaluation_id).first()


# ── Selectors para la evaluación pública (flujo wizard) ─────────────────────

def hash_session_token(token: str) -> str:
    """En la base solo se guarda el SHA-256 del token de sesión anónima."""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def get_evaluation_by_token(evaluation_uuid: UUID, token: str) -> Optional[Evaluation]:
    """Devuelve la evaluación solo si el token corresponde; si no, None."""
    evaluation = Evaluation.objects.filter(uuid=evaluation_uuid).first()
    if evaluation is None or not evaluation.session_token:
        return None
    if not hmac.compare_digest(evaluation.session_token, hash_session_token(token)):
        return None
    return evaluation


def evaluation_factors(evaluation: Evaluation):
    """Factores de la evaluación en el orden del catálogo, con sus subfactores."""
    subfactors = (
        EvaluationSubfactor.objects
        .select_related('subfactor')
        .order_by('subfactor__order', 'subfactor_id')
    )
    factors = list(
        EvaluationFactor.objects
        .filter(evaluation=evaluation)
        .select_related('factor', 'factor__dimension')
        .order_by('factor__dimension__order', 'factor__dimension_id', 'factor__order', 'factor_id')
    )
    by_factor = {}
    for item in subfactors.filter(evaluation=evaluation):
        by_factor.setdefault(item.subfactor.factor_id, []).append(item)
    for item in factors:
        item.items = by_factor.get(item.factor_id, [])
    return factors


def get_evaluation_factor(evaluation: Evaluation, factor_id: int) -> Optional[EvaluationFactor]:
    return (
        EvaluationFactor.objects
        .select_related('factor')
        .filter(evaluation=evaluation, factor_id=factor_id)
        .first()
    )


def get_evaluation_subfactor(evaluation: Evaluation, subfactor_id: int) -> Optional[EvaluationSubfactor]:
    return EvaluationSubfactor.objects.filter(evaluation=evaluation, subfactor_id=subfactor_id).first()


def build_engine_inputs(factors) -> list:
    """
    Entradas del motor a partir de las instantáneas de la evaluación (RN-08):
    IS, nombre del factor y texto del subfactor no dependen del catálogo vivo.
    Los códigos del motor son los ids del catálogo, para volver a los registros.
    """
    from apps.guios.services.engine import FactorInput, SubfactorInput
    return [
        FactorInput(
            code=str(item.factor_id),
            name=item.factor_name_snapshot,
            suggested_importance=item.suggested_importance_snapshot,
            decisor_importance=item.decisor_importance,
            scope=item.scope_used or None,
            scope_configurable=item.factor.scope_configurable,
            subfactors=tuple(
                SubfactorInput(str(sub.subfactor_id), sub.description_snapshot, sub.rating)
                for sub in item.items
            ),
        )
        for item in factors
    ]
