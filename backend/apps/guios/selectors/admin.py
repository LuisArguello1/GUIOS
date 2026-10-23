"""
Consultas del panel administrativo: historial con filtros (RF-ADM-34), detalle de
solo lectura (RF-ADM-35) y métricas del tablero (RF-ADM-19).

El detalle de una evaluación completada usa los resultados y el dictamen guardados
(EvaluationResult y EvaluationVerdict). Solo las evaluaciones en progreso se calculan
con el motor, a partir de sus instantáneas.
"""
from datetime import date
from typing import Optional

from django.db.models import Count, Q, QuerySet

from ..models import Evaluation, EvaluationResult, EvaluationVerdict
from ..services import engine
from .evaluation import build_engine_inputs, evaluation_factors

RECENT_LIMIT = 10


def evaluation_history(
    *,
    software: str = '',
    organization: str = '',
    recommendation: str = '',
    status: str = '',
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> QuerySet[Evaluation]:
    """Historial filtrado, más recientes primero. Las fechas filtran por inicio."""
    queryset = Evaluation.objects.select_related('verdict').order_by('-started_at', '-id')
    if software:
        queryset = queryset.filter(software_name__icontains=software)
    if organization:
        queryset = queryset.filter(org_name__icontains=organization)
    if recommendation:
        queryset = queryset.filter(verdict__recommendation=recommendation)
    if status:
        queryset = queryset.filter(status=status)
    if date_from:
        queryset = queryset.filter(started_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(started_at__date__lte=date_to)
    return queryset


def get_evaluation_by_uuid(evaluation_uuid) -> Optional[Evaluation]:
    return Evaluation.objects.select_related('verdict').filter(uuid=evaluation_uuid).first()


def _subfactor_rows(item):
    return [
        {
            'subfactor_id': sub.subfactor_id,
            'code': sub.subfactor.code,
            'description': sub.description_snapshot,
            'rating': sub.rating,
            'ai_suggested_rating': sub.ai_suggested_rating,
            'ai_rating_justification': sub.ai_rating_justification,
            'rating_was_ai_accepted': sub.rating_was_ai_accepted,
        }
        for sub in item.items
    ]


def _failing(item):
    return [
        {'subfactor_id': sub.subfactor_id, 'description': sub.description_snapshot, 'rating': sub.rating}
        for sub in item.items
        if sub.rating is not None and sub.rating < engine.RATING_PARTIAL
    ]


def _factor_base(item):
    return {
        'factor_id': item.factor_id,
        'code': item.factor.code,
        'dimension': item.factor.dimension.name,
        'name': item.factor_name_snapshot,
        'suggested_importance': item.suggested_importance_snapshot,
        'decisor_importance': item.decisor_importance,
        'scope_used': item.scope_used or None,
        'scope_configurable': item.factor.scope_configurable,
        'ai_suggested_id': item.ai_suggested_id,
        'ai_id_justification': item.ai_id_justification,
        'id_was_ai_accepted': item.id_was_ai_accepted,
        'subfactors': _subfactor_rows(item),
    }


def _stored_factors(evaluation, factors):
    """Evaluación completada: IR y relevancia guardadas; PM y FODA de EvaluationResult."""
    results = {r.factor_id: r for r in EvaluationResult.objects.filter(evaluation=evaluation)}
    rows = []
    for item in factors:
        result = results.get(item.factor_id)
        rows.append({
            **_factor_base(item),
            'relative_importance': item.relative_importance,
            'is_relevant': item.is_relevant,
            'weighted_average': result.weighted_average if result else None,
            'meets_threshold': result.meets_threshold if result else None,
            'foda': result.foda_classification if result else None,
            'failing_subfactors': _failing(item) if result else [],
        })
    return rows


def _calculated_factors(factors, outcome):
    """Evaluación en progreso: valores calculados por el motor con las instantáneas."""
    by_id = {int(r.code): r for r in outcome.factors}
    rows = []
    for item in factors:
        result = by_id[item.factor_id]
        rows.append({
            **_factor_base(item),
            'relative_importance': result.relative_importance,
            'is_relevant': result.is_relevant,
            'weighted_average': result.weighted_average_display,
            'meets_threshold': result.meets_threshold,
            'foda': result.foda,
            'failing_subfactors': [
                {'subfactor_id': int(s.code), 'description': s.description, 'rating': s.rating}
                for s in result.failing_subfactors
            ],
        })
    return rows


def get_evaluation_detail(evaluation: Evaluation) -> dict:
    """Detalle de solo lectura (RF-ADM-35) basado en las instantáneas guardadas."""
    factors = evaluation_factors(evaluation)
    completed = evaluation.status == Evaluation.STATUS_COMPLETED
    missing = []
    if completed:
        rows = _stored_factors(evaluation, factors)
    else:
        outcome = engine.evaluate(build_engine_inputs(factors))
        rows = _calculated_factors(factors, outcome)
        missing = [
            {'kind': m.kind, 'factor_id': int(m.factor_code), 'factor_name': m.factor_name,
             'subfactor_id': int(m.subfactor_code) if m.subfactor_code else None}
            for m in outcome.missing
        ]
    verdict = getattr(evaluation, 'verdict', None) if completed else None
    return {
        'evaluation': evaluation,
        'results_source': 'stored' if completed else 'calculated',
        'factors': rows,
        'missing': missing,
        'verdict': verdict,
    }


def dashboard_metrics() -> dict:
    """Métricas del tablero (RF-ADM-19): totales, dictámenes A/B/C y recientes."""
    totals = Evaluation.objects.aggregate(
        total=Count('id'),
        in_progress=Count('id', filter=Q(status=Evaluation.STATUS_IN_PROGRESS)),
        completed=Count('id', filter=Q(status=Evaluation.STATUS_COMPLETED)),
    )
    by_letter = dict(
        EvaluationVerdict.objects.values_list('recommendation').annotate(n=Count('id')).values_list('recommendation', 'n')
    )
    return {
        **totals,
        'verdicts': {letter: by_letter.get(letter, 0) for letter in ('A', 'B', 'C')},
        'recent': list(evaluation_history()[:RECENT_LIMIT]),
    }
