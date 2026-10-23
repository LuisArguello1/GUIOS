import type { AdminFactorDetail, AdminVerdict } from '../../api/guiosAdminService';
import type { FactorSummary, Verdict } from '../../api/guiosPublicService';

/**
 * Convierte el detalle administrativo al tipo que usan los componentes de
 * resultados del módulo público (VerdictCard, FodaMatrix, FactorsTable), para
 * reutilizarlos sin modificarlos.
 */
export const toFactorSummary = (factor: AdminFactorDetail): FactorSummary => ({
    factor_id: factor.factor_id,
    code: factor.code,
    name: factor.name,
    suggested_importance: factor.suggested_importance,
    decisor_importance: factor.decisor_importance,
    relative_importance: factor.relative_importance,
    relative_importance_label: null,
    is_relevant: factor.is_relevant,
    scope_used: factor.scope_used,
    scope_configurable: factor.scope_configurable,
    weighted_average: factor.weighted_average,
    meets_threshold: factor.meets_threshold,
    foda: factor.foda,
    subfactors_total: factor.subfactors.length,
    subfactors_rated: factor.subfactors.filter((s) => s.rating !== null).length,
    failing_subfactors: factor.failing_subfactors,
});

export const toVerdict = (verdict: AdminVerdict): Verdict => ({
    recommendation: verdict.recommendation,
    recommendation_label: verdict.recommendation_label,
    explanation_text: verdict.explanation_text,
    calculated_at: verdict.calculated_at,
});
