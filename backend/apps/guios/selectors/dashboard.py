"""
apps/guios/selectors/dashboard.py
─────────────────────────────────────────────────────────────────────────────
Capa de selectores para el Dashboard Ejecutivo y Reportería Analítica de GUIOS.
ÚNICA capa responsable de ejecutar consultas agregadas y métricas ORM.
Utiliza funciones de agregación nativas de base de datos (Count, Avg) para máxima eficiencia.
"""
from typing import Any
from django.db.models import Count, Avg, Q
from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationResult,
    EvaluationVerdict,
    AIAssistanceLog,
    Dimension,
)


def get_dashboard_statistics() -> dict[str, Any]:
    """
    Retorna el conjunto consolidado de métricas, KPIs y series analíticas para el Dashboard.
    Ejecuta consultas agregadas optimizadas sin bucles en Python.
    """
    # ── 1. Resumen de Evaluaciones y Estados ──────────────────────────────────
    eval_counts = Evaluation.objects.aggregate(
        total=Count('id'),
        completed=Count('id', filter=Q(status=Evaluation.STATUS_COMPLETED)),
        in_progress=Count('id', filter=Q(status=Evaluation.STATUS_IN_PROGRESS)),
    )

    total_evaluations = eval_counts['total'] or 0
    completed_evaluations = eval_counts['completed'] or 0
    in_progress_evaluations = eval_counts['in_progress'] or 0

    # ── 2. Distribución de Veredictos (Recomendaciones A, B, C) ───────────────
    verdict_groups = (
        EvaluationVerdict.objects.values('recommendation')
        .annotate(count=Count('id'))
    )
    verdict_map = {'A': 0, 'B': 0, 'C': 0}
    for item in verdict_groups:
        rec = item['recommendation']
        if rec in verdict_map:
            verdict_map[rec] = item['count']

    total_with_verdict = sum(verdict_map.values())
    viable_count = verdict_map['A'] + verdict_map['B']
    adoption_viability_rate = (
        round((viable_count / total_with_verdict) * 100, 1)
        if total_with_verdict > 0 else 0.0
    )

    # ── 3. Rendimiento Medio por Dimensión GUIOS ──────────────────────────────
    dim_avgs_qs = (
        EvaluationResult.objects.values('factor__dimension__id', 'factor__dimension__name')
        .annotate(avg_score=Avg('weighted_average'), total_factors=Count('id'))
        .order_by('factor__dimension__id')
    )
    dimension_scores = []
    for item in dim_avgs_qs:
        dimension_scores.append({
            "dimension_id": item['factor__dimension__id'],
            "name": item['factor__dimension__name'],
            "avg_score": round(float(item['avg_score'] or 0.0), 2),
            "sample_count": item['total_factors'],
        })

    # Si aún no hay evaluaciones con resultados calculados, proveer dimensiones con score 0
    if not dimension_scores:
        for dim in Dimension.objects.all().order_by('order'):
            dimension_scores.append({
                "dimension_id": dim.id,
                "name": dim.name,
                "avg_score": 0.0,
                "sample_count": 0,
            })

    # ── 4. Balance FODA Consolidado ───────────────────────────────────────────
    foda_qs = (
        EvaluationResult.objects.values('foda_classification')
        .annotate(count=Count('id'))
    )
    foda_counts = {
        EvaluationResult.FODA_STRENGTH: 0,
        EvaluationResult.FODA_OPPORTUNITY: 0,
        EvaluationResult.FODA_WEAKNESS: 0,
        EvaluationResult.FODA_THREAT: 0,
    }
    for item in foda_qs:
        fclass = item['foda_classification']
        if fclass in foda_counts:
            foda_counts[fclass] = item['count']

    total_strengths = foda_counts[EvaluationResult.FODA_STRENGTH] + foda_counts[EvaluationResult.FODA_OPPORTUNITY]
    total_weaknesses = foda_counts[EvaluationResult.FODA_WEAKNESS] + foda_counts[EvaluationResult.FODA_THREAT]
    foda_ratio = (
        round(total_strengths / total_weaknesses, 2)
        if total_weaknesses > 0 else float(total_strengths)
    )

    # ── 5. Métricas de Rendimiento de IA ──────────────────────────────────────
    ai_aggregates = AIAssistanceLog.objects.aggregate(
        total_calls=Count('id'),
        avg_latency=Avg('response_time_ms', filter=Q(response_time_ms__isnull=False)),
        success_count=Count('id', filter=Q(status=AIAssistanceLog.STATUS_SUCCESS)),
        error_count=Count('id', filter=Q(status=AIAssistanceLog.STATUS_ERROR)),
    )
    total_ai_calls = ai_aggregates['total_calls'] or 0
    avg_ai_latency = round(float(ai_aggregates['avg_latency'] or 0.0), 1)
    ai_success_count = ai_aggregates['success_count'] or 0
    ai_error_count = ai_aggregates['error_count'] or 0
    ai_success_rate = (
        round((ai_success_count / total_ai_calls) * 100, 1)
        if total_ai_calls > 0 else 100.0
    )

    # ── 6. Categorías de Software más Evaluadas ────────────────────────────────
    categories_qs = (
        Evaluation.objects.exclude(software_category__isnull=True)
        .exclude(software_category='')
        .values('software_category')
        .annotate(count=Count('id'))
        .order_by('-count')[:5]
    )
    categories_distribution = [
        {"category": item['software_category'], "count": item['count']}
        for item in categories_qs
    ]

    # ── 7. Top Software Evaluado con Mayor Aptitud ────────────────────────────
    top_software_qs = (
        Evaluation.objects.filter(verdict__isnull=False)
        .select_related('verdict')
        .order_by('verdict__recommendation', '-completed_at')[:5]
    )
    top_software = [
        {
            "id": ev.id,
            "software_name": ev.software_name,
            "software_version": ev.software_version,
            "software_category": ev.software_category,
            "org_name": ev.org_name,
            "recommendation": ev.verdict.recommendation if hasattr(ev, 'verdict') and ev.verdict else None,
            "completed_at": ev.completed_at.isoformat() if ev.completed_at else None,
        }
        for ev in top_software_qs
    ]

    # ── 8. Evaluaciones Recientes ─────────────────────────────────────────────
    recent_qs = (
        Evaluation.objects.select_related('verdict')
        .order_by('-started_at')[:6]
    )
    recent_evaluations = [
        {
            "id": ev.id,
            "software_name": ev.software_name,
            "software_version": ev.software_version,
            "software_category": ev.software_category,
            "org_name": ev.org_name,
            "status": ev.status,
            "status_display": ev.get_status_display(),
            "recommendation": ev.verdict.recommendation if hasattr(ev, 'verdict') and ev.verdict else None,
            "started_at": ev.started_at.isoformat() if ev.started_at else None,
        }
        for ev in recent_qs
    ]

    return {
        "kpis": {
            "total_evaluations": total_evaluations,
            "completed_evaluations": completed_evaluations,
            "in_progress_evaluations": in_progress_evaluations,
            "adoption_viability_rate": adoption_viability_rate,
            "total_with_verdict": total_with_verdict,
            "foda_strengths": total_strengths,
            "foda_weaknesses": total_weaknesses,
            "foda_ratio": foda_ratio,
            "ai_total_calls": total_ai_calls,
            "ai_avg_latency_ms": avg_ai_latency,
            "ai_success_rate": ai_success_rate,
        },
        "verdict_distribution": [
            {"recommendation": "A", "label": "Adoptar sin restricciones", "count": verdict_map['A']},
            {"recommendation": "B", "label": "Adoptar con mitigaciones", "count": verdict_map['B']},
            {"recommendation": "C", "label": "Posponer adopción", "count": verdict_map['C']},
        ],
        "dimension_averages": dimension_scores,
        "foda_distribution": [
            {"type": "fortaleza", "label": "Fortalezas", "count": foda_counts[EvaluationResult.FODA_STRENGTH]},
            {"type": "oportunidad", "label": "Oportunidades", "count": foda_counts[EvaluationResult.FODA_OPPORTUNITY]},
            {"type": "debilidad", "label": "Debilidades", "count": foda_counts[EvaluationResult.FODA_WEAKNESS]},
            {"type": "amenaza", "label": "Amenazas", "count": foda_counts[EvaluationResult.FODA_THREAT]},
        ],
        "categories_distribution": categories_distribution,
        "top_software": top_software,
        "recent_evaluations": recent_evaluations,
    }
