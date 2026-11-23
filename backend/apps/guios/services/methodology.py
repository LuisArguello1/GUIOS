"""
Orquestación del motor GUIOS.

Las fórmulas viven en apps.guios.services.calculations, un archivo por cálculo.
Este módulo solo lee el catálogo, aplica esas funciones y persiste snapshots.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.guios.models import (
    Evaluation,
    EvaluationFactor,
    EvaluationResult,
    EvaluationSubfactor,
    EvaluationVerdict,
    Factor,
)
from apps.guios.services.calculations import (
    COMBINATION_MATRIX,
    VerdictFactor,
    assign_literature_importance,
    calculate_citation_ratio,
    calculate_literature_thresholds,
    calculate_quartiles,
    calculate_raw_weighted_average,
    calculate_relative_importance,
    calculate_suggested_importance,
    calculate_systemic_importance,
    calculate_weighted_average,
    classify_foda,
    classify_recommendation,
    combine_importance,
    is_factor_relevant,
    meets_adoption_threshold,
)

__all__ = [
    "COMBINATION_MATRIX",
    "assign_literature_importance",
    "apply_step1_decisor_importance",
    "apply_step3_subfactor_ratings_and_foda",
    "calculate_quartiles",
    "calculate_systemic_importance",
    "combine_importance",
    "compute_evaluation_literature_metrics",
    "compute_final_verdict",
    "determine_final_recommendation",
]


def _rating_suggestion(ratings: dict | None, subfactor_id: int) -> dict | None:
    """Lee la nota sugerida sin pisar una calificación que el modelo no envió."""
    if not ratings:
        return None
    raw = ratings.get(subfactor_id)
    if raw is None:
        raw = ratings.get(str(subfactor_id))
    if not isinstance(raw, dict):
        return None
    try:
        rating = int(raw.get("rating"))
    except (TypeError, ValueError):
        return None
    if rating < 1 or rating > 4:
        return None
    justification = str(raw.get("justification") or "").strip()
    if not justification:
        return None
    return {"rating": rating, "justification": justification[:1200]}


def _importance_suggestion(importances: dict | None, factor_id: int) -> dict | None:
    """Lee la importancia del decisor sugerida sin tocar la nota que el usuario ya guardó."""
    if not importances:
        return None
    raw = importances.get(factor_id)
    if raw is None:
        raw = importances.get(str(factor_id))
    if not isinstance(raw, dict):
        return None
    try:
        suggested_id = int(raw.get("suggested_id") or raw.get("rating"))
    except (TypeError, ValueError):
        return None
    if suggested_id < 1 or suggested_id > 4:
        return None
    justification = str(raw.get("justification") or "").strip()
    if not justification:
        return None
    return {"suggested_id": suggested_id, "justification": justification[:1200]}


@transaction.atomic
def compute_evaluation_literature_metrics(
    evaluation: Evaluation,
    ai_citations_by_subfactor: dict[int, int] | None = None,
    ai_sources_by_factor: dict[int, list[dict]] | None = None,
    ai_ratings_by_subfactor: dict | None = None,
    ai_importance_by_factor: dict | None = None,
) -> Evaluation:
    """
    Fase previa: r_i, cuartiles, IL e IS.
    Si no llegan citas de la IA, usa el conteo base del catálogo.
    """
    factors = Factor.objects.filter(is_active=True).prefetch_related(
        "subfactors"
    ).select_related("dimension").order_by("dimension__order", "order", "id")

    factor_data: list[dict] = []
    citation_ratios = []

    for factor in factors:
        active_subfactors = [sf for sf in factor.subfactors.all() if sf.is_active]
        subfactor_count = len(active_subfactors)
        if subfactor_count == 0:
            continue

        if ai_citations_by_subfactor:
            total_citations = sum(ai_citations_by_subfactor.get(sf.id, 0) for sf in active_subfactors)
        else:
            total_citations = sum(sf.base_citations_count for sf in active_subfactors)

        citation_ratio = calculate_citation_ratio(total_citations, subfactor_count)
        exact_ratio = calculate_citation_ratio(total_citations, subfactor_count, decimals=10)
        citation_ratios.append(exact_ratio)
        factor_data.append({
            "factor": factor,
            "subfactors": active_subfactors,
            "subfactor_count": subfactor_count,
            "total_citations": total_citations,
            "citation_ratio": citation_ratio,
            "exact_ratio": exact_ratio,
            "expert_importance": factor.expert_importance,
        })

    if not factor_data:
        raise ValidationError("No existen factores activos con subfactores para evaluar.")

    q1, q2, q3, q4 = calculate_literature_thresholds(citation_ratios)
    evaluation.q1_threshold = q1
    evaluation.q2_threshold = q2
    evaluation.q3_threshold = q3
    evaluation.q4_threshold = q4
    evaluation.ai_status = Evaluation.AI_STATUS_COMPLETED
    evaluation.save(update_fields=[
        "q1_threshold",
        "q2_threshold",
        "q3_threshold",
        "q4_threshold",
        "ai_status",
    ])

    for item in factor_data:
        factor: Factor = item["factor"]
        literature_importance = assign_literature_importance(
            item["exact_ratio"], q1, q2, q3, q4
        )
        suggested_importance = calculate_suggested_importance(
            literature_importance,
            item["expert_importance"],
        )
        sources = (ai_sources_by_factor or {}).get(factor.id, [])
        scope_used = (
            factor.scope
            if factor.scope in (Factor.SCOPE_INTERNAL, Factor.SCOPE_EXTERNAL)
            else Factor.SCOPE_INTERNAL
        )
        factor_defaults = {
            "systemic_importance_snapshot": suggested_importance,
            "subfactors_count_snapshot": item["subfactor_count"],
            "citations_count": item["total_citations"],
            "citation_ratio": item["citation_ratio"],
            "literature_importance_calculated": literature_importance,
            "expert_importance_snapshot": item["expert_importance"],
            "ai_literature_sources": sources,
            "scope_used": scope_used,
        }
        importance = _importance_suggestion(ai_importance_by_factor, factor.id)
        if importance:
            factor_defaults["ai_suggested_id"] = importance["suggested_id"]
            factor_defaults["ai_id_justification"] = importance["justification"]

        EvaluationFactor.objects.update_or_create(
            evaluation=evaluation,
            factor=factor,
            defaults=factor_defaults,
        )

        for subfactor in item["subfactors"]:
            subfactor_citations = (ai_citations_by_subfactor or {}).get(
                subfactor.id,
                subfactor.base_citations_count,
            )
            defaults = {
                "description_snapshot": subfactor.description,
                "ai_citations_count": subfactor_citations,
            }
            suggestion = _rating_suggestion(ai_ratings_by_subfactor, subfactor.id)
            if suggestion:
                defaults["ai_suggested_rating"] = suggestion["rating"]
                defaults["ai_rating_justification"] = suggestion["justification"]
            EvaluationSubfactor.objects.update_or_create(
                evaluation=evaluation,
                subfactor=subfactor,
                defaults=defaults,
            )

    return evaluation


def _sync_factor_result(
    evaluation: Evaluation,
    eval_factor: EvaluationFactor,
) -> EvaluationResult | None:
    """
    Recalcula o limpia EvaluationResult para un factor según relevancia y completitud de subfactores.
    Evalúa el umbral PM >= 3.0 con el promedio exacto (sin redondeo previo).
    """
    if not eval_factor.is_relevant:
        EvaluationResult.objects.filter(
            evaluation=evaluation,
            factor=eval_factor.factor,
        ).delete()
        return None

    stored_ratings = list(
        EvaluationSubfactor.objects.filter(
            evaluation=evaluation,
            subfactor__factor=eval_factor.factor,
            subfactor__is_active=True,
        ).values_list("rating", flat=True)
    )
    # RN-02: la PM solo es válida cuando todos los subfactores activos tienen calificación.
    if not stored_ratings or any(rating is None for rating in stored_ratings):
        EvaluationResult.objects.filter(
            evaluation=evaluation,
            factor=eval_factor.factor,
        ).delete()
        return None

    raw_average = calculate_raw_weighted_average(stored_ratings)
    weighted_average = calculate_weighted_average(stored_ratings)
    meets_threshold = meets_adoption_threshold(raw_average)
    foda_classification = classify_foda(raw_average, eval_factor.scope_used)

    result, _ = EvaluationResult.objects.update_or_create(
        evaluation=evaluation,
        factor=eval_factor.factor,
        defaults={
            "weighted_average": weighted_average,
            "meets_threshold": meets_threshold,
            "foda_classification": foda_classification,
        },
    )
    return result


@transaction.atomic
def apply_step1_decisor_importance(
    evaluation: Evaluation,
    decisor_data: list[dict],
) -> list[EvaluationFactor]:
    """
    Paso 1-2: IR = M(ID, IS) y es_relevante = IR > 1.
    Sincroniza EvaluationResult existentes ante cambios de relevancia o ámbito.
    """
    updated_factors: list[EvaluationFactor] = []
    factors_by_id = {
        ef.factor_id: ef
        for ef in EvaluationFactor.objects.select_related("factor").filter(evaluation=evaluation)
    }

    for entry in decisor_data:
        factor_id = entry["factor_id"]
        eval_factor = factors_by_id.get(factor_id)
        if eval_factor is None:
            raise ValidationError(
                f"El factor #{factor_id} no pertenece a la evaluación #{evaluation.id}."
            )
        decisor_importance = int(entry["decisor_importance"])
        relative_importance = calculate_relative_importance(
            eval_factor.systemic_importance_snapshot,
            decisor_importance,
        )

        eval_factor.decisor_importance = decisor_importance
        eval_factor.relative_importance = relative_importance
        eval_factor.is_relevant = is_factor_relevant(relative_importance)

        factor = eval_factor.factor
        is_configurable_scope = bool(
            factor.scope_configurable or factor.scope == Factor.SCOPE_BOTH
        )
        requested_scope = entry.get("scope_used")
        if is_configurable_scope:
            if requested_scope:
                if requested_scope not in (
                    EvaluationFactor.SCOPE_INTERNAL,
                    EvaluationFactor.SCOPE_EXTERNAL,
                ):
                    raise ValidationError(
                        f"Ámbito FODA inválido '{requested_scope}' para el factor '{factor.name}'."
                    )
                eval_factor.scope_used = requested_scope
        else:
            canonical_scope = (
                factor.scope
                if factor.scope in (EvaluationFactor.SCOPE_INTERNAL, EvaluationFactor.SCOPE_EXTERNAL)
                else EvaluationFactor.SCOPE_INTERNAL
            )
            if requested_scope and requested_scope != canonical_scope:
                raise ValidationError(
                    f"El ámbito FODA del factor '{factor.name}' es fijo ({canonical_scope}) y no puede modificarse."
                )
            eval_factor.scope_used = canonical_scope

        eval_factor.save(update_fields=[
            "decisor_importance",
            "relative_importance",
            "is_relevant",
            "scope_used",
        ])
        _sync_factor_result(evaluation, eval_factor)
        updated_factors.append(eval_factor)

    relevant_factor_ids = [
        ef.factor_id for ef in EvaluationFactor.objects.filter(evaluation=evaluation, is_relevant=True)
    ]
    EvaluationResult.objects.filter(evaluation=evaluation).exclude(
        factor_id__in=relevant_factor_ids
    ).delete()

    return updated_factors


@transaction.atomic
def apply_step3_subfactor_ratings_and_foda(
    evaluation: Evaluation,
    ratings_by_subfactor: dict[int, int],
) -> list[EvaluationResult]:
    """
    Paso 3-4: guarda PS, calcula PM y clasifica FODA en los factores relevantes.
    """
    if ratings_by_subfactor:
        existing_subfactor_ids = set(
            EvaluationSubfactor.objects.filter(
                evaluation=evaluation,
                subfactor_id__in=ratings_by_subfactor.keys(),
            ).values_list("subfactor_id", flat=True)
        )
        invalid_ids = sorted(
            sf_id for sf_id in ratings_by_subfactor.keys() if sf_id not in existing_subfactor_ids
        )
        if invalid_ids:
            raise ValidationError(
                "Los siguientes subfactores no pertenecen a la evaluación "
                f"#{evaluation.id}: {', '.join(str(sf_id) for sf_id in invalid_ids)}."
            )

    for subfactor_id, rating in ratings_by_subfactor.items():
        EvaluationSubfactor.objects.filter(
            evaluation=evaluation,
            subfactor_id=subfactor_id,
        ).update(rating=max(1, min(4, int(rating))))

    relevant_eval_factors = EvaluationFactor.objects.filter(
        evaluation=evaluation,
        is_relevant=True,
    ).select_related("factor")

    results: list[EvaluationResult] = []
    for eval_factor in relevant_eval_factors:
        result = _sync_factor_result(evaluation, eval_factor)
        if result is not None:
            results.append(result)

    return results


def determine_final_recommendation(results) -> tuple[str, str]:
    """
    Arma el dictamen a partir de resultados ya persistidos.
    La Importancia Relativa se lee del factor de la misma evaluación.
    """
    result_rows = list(results)
    if not result_rows:
        raise ValidationError("No existen resultados calculados para emitir un dictamen.")

    evaluation_ids = {row.evaluation_id for row in result_rows}
    relative_by_factor = {
        (eval_factor.evaluation_id, eval_factor.factor_id): eval_factor.relative_importance
        for eval_factor in EvaluationFactor.objects.filter(
            evaluation_id__in=evaluation_ids,
            is_relevant=True,
        )
    }

    verdict_factors = [
        VerdictFactor(
            name=row.factor.name,
            weighted_average=row.weighted_average,
            meets_threshold=row.meets_threshold,
            relative_importance=relative_by_factor.get((row.evaluation_id, row.factor_id), 1) or 1,
            foda_label=row.get_foda_classification_display(),
        )
        for row in result_rows
    ]

    try:
        return classify_recommendation(verdict_factors)
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc


def ensure_all_relevant_factors_have_results(evaluation: Evaluation) -> list[EvaluationResult]:
    """
    Verifica que todos los factores relevantes (IR > 1) cuenten con su PM calculada
    antes de emitir el dictamen final (D-16).
    """
    relevant_factors = list(
        EvaluationFactor.objects.filter(
            evaluation=evaluation,
            is_relevant=True,
        ).select_related("factor")
    )
    if not relevant_factors:
        raise ValidationError("No existen factores relevantes calificados para emitir un dictamen.")

    relevant_factor_ids = [ef.factor_id for ef in relevant_factors]
    results = list(
        EvaluationResult.objects.filter(
            evaluation=evaluation,
            factor_id__in=relevant_factor_ids,
        ).select_related("factor")
    )
    rated_factor_ids = {row.factor_id for row in results}
    missing_factors = [
        ef.factor.name
        for ef in relevant_factors
        if ef.factor_id not in rated_factor_ids
    ]
    if missing_factors:
        raise ValidationError(
            "Faltan factores relevantes por calificar antes de emitir el dictamen: "
            f"{', '.join(missing_factors)}."
        )
    return results


@transaction.atomic
def compute_final_verdict(
    evaluation: Evaluation,
    ai_executive_summary: str = "",
    ai_mitigation_plan: str = "",
) -> EvaluationVerdict:
    """
    Paso 5-6: persiste la recomendación A, B o C y cierra la evaluación.
    """
    if (
        evaluation.status == Evaluation.STATUS_COMPLETED
        or EvaluationVerdict.objects.filter(evaluation_id=evaluation.id).exists()
    ):
        raise ValidationError(
            f"La evaluación #{evaluation.id} ya cuenta con un dictamen emitido y se encuentra cerrada."
        )

    results = ensure_all_relevant_factors_have_results(evaluation)
    recommendation, explanation = determine_final_recommendation(results)

    from django.utils import timezone

    evaluation.status = Evaluation.STATUS_COMPLETED
    evaluation.completed_at = timezone.now()
    evaluation.save(update_fields=["status", "completed_at"])

    verdict, _ = EvaluationVerdict.objects.update_or_create(
        evaluation=evaluation,
        defaults={
            "recommendation": recommendation,
            "explanation_text": explanation,
            "ai_executive_summary": ai_executive_summary,
            "ai_mitigation_plan": ai_mitigation_plan,
        },
    )
    return verdict
