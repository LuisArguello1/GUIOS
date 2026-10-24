"""
apps/guios/selectors/evaluation.py
─────────────────────────────────────────────────────────────────────────────
Capa de selectores para Evaluaciones Metodológicas GUIOS.
ÚNICA capa responsable de ejecutar consultas ORM sobre Evaluation y modelos satélite.
Implementa optimizaciones anti N+1 con select_related y prefetch_related explícitos.
"""

from typing import Optional
from django.db.models import QuerySet, Q
from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationSubfactor,
    EvaluationResult,
    EvaluationVerdict,
)
from apps.guios.exceptions import EvaluationNotFoundError


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
        # Los usuarios no administradores solo visualizan sus propias evaluaciones
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
    """
    Retorna la instancia de evaluación por su ID primario o lanza EvaluationNotFoundError.
    """
    try:
        return Evaluation.objects.select_related('created_by', 'verdict').get(pk=evaluation_id)
    except (Evaluation.DoesNotExist, ValueError):
        raise EvaluationNotFoundError(f"La evaluación #{evaluation_id} no existe.")


def get_evaluation_by_uuid_or_error(uuid_str: str) -> Evaluation:
    """
    Retorna la instancia de evaluación por su UUID público o lanza EvaluationNotFoundError.
    """
    try:
        return Evaluation.objects.select_related('created_by', 'verdict').get(uuid=uuid_str)
    except (Evaluation.DoesNotExist, ValueError):
        raise EvaluationNotFoundError(f"La evaluación con UUID {uuid_str} no existe.")


def get_evaluation_detail_or_error(evaluation_id: int | str) -> Evaluation:
    """
    Retorna la evaluación con TODA su jerarquía precargada en memoria (anti N+1):
    - Creador y veredicto (select_related)
    - Factores evaluados con dimensión padre (prefetch_related)
    - Subfactores evaluados con factor (prefetch_related)
    - Resultados FODA con factor (prefetch_related)
    """
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
    """
    Retorna los factores de evaluación vinculados a la sesión, ordenados por dimensión y factor.
    """
    return (
        EvaluationFactor.objects.filter(evaluation_id=evaluation_id)
        .select_related('factor__dimension')
        .order_by('factor__dimension__order', 'factor__order', 'factor__id')
    )


def get_evaluation_subfactors_queryset(
    evaluation_id: int | str,
    factor_id: Optional[int] = None,
) -> QuerySet[EvaluationSubfactor]:
    """
    Retorna los subfactores de evaluación vinculados a la sesión, opcionalmente filtrados por factor.
    """
    qs = (
        EvaluationSubfactor.objects.filter(evaluation_id=evaluation_id)
        .select_related('subfactor__factor__dimension')
        .order_by('subfactor__factor__order', 'subfactor__order', 'subfactor__id')
    )
    if factor_id:
        qs = qs.filter(subfactor__factor_id=factor_id)
    return qs


def get_evaluation_results_queryset(evaluation_id: int | str) -> QuerySet[EvaluationResult]:
    """
    Retorna los resultados FODA calculados para los factores relevantes de la evaluación.
    """
    return (
        EvaluationResult.objects.filter(evaluation_id=evaluation_id)
        .select_related('factor__dimension')
        .order_by('factor__dimension__order', 'factor__order', 'factor__id')
    )


def get_evaluation_verdict_or_none(evaluation_id: int | str) -> Optional[EvaluationVerdict]:
    """
    Retorna el veredicto final emitido para la evaluación o None si aún no se ha concluido.
    """
    return EvaluationVerdict.objects.filter(evaluation_id=evaluation_id).first()
