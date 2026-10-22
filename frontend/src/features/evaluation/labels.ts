import type { FactorSummary, Foda, Importance, Rating, Recommendation, Scope } from '../../api/guiosPublicService';

/** Escala de importancia (Tabla 5.2 de la tesis): IS, ID e IR. */
export const IMPORTANCE_OPTIONS: { value: Importance; label: string }[] = [
    { value: 1, label: 'Irrelevante' },
    { value: 2, label: 'Opcional' },
    { value: 3, label: 'Importante' },
    { value: 4, label: 'Fundamental' },
];

/** Escala de calificación de subfactores (Sección 5.2.3, p. 89). */
export const RATING_OPTIONS: { value: Rating; label: string }[] = [
    { value: 1, label: 'No cumple' },
    { value: 2, label: 'No se sabe' },
    { value: 3, label: 'Cumple parcialmente' },
    { value: 4, label: 'Cumple' },
];

export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
    { value: 'internal', label: 'Interno' },
    { value: 'external', label: 'Externo' },
];

export const importanceLabel = (value: number | null | undefined): string =>
    IMPORTANCE_OPTIONS.find((option) => option.value === value)?.label ?? 'Sin calificar';

export const scopeLabel = (value: string | null | undefined): string =>
    SCOPE_OPTIONS.find((option) => option.value === value)?.label ?? 'Sin elegir';

export const FODA_INFO: Record<Foda, { label: string; plural: string; scope: string; rule: string; positive: boolean }> = {
    strength: { label: 'Fortaleza', plural: 'Fortalezas', scope: 'Interno', rule: 'PM ≥ 3', positive: true },
    weakness: { label: 'Debilidad', plural: 'Debilidades', scope: 'Interno', rule: 'PM < 3', positive: false },
    opportunity: { label: 'Oportunidad', plural: 'Oportunidades', scope: 'Externo', rule: 'PM ≥ 3', positive: true },
    threat: { label: 'Amenaza', plural: 'Amenazas', scope: 'Externo', rule: 'PM < 3', positive: false },
};

export const FODA_ORDER: Foda[] = ['strength', 'weakness', 'opportunity', 'threat'];

/** Agrupa los factores relevantes por cuadrante FODA. */
export const groupByFoda = (factors: FactorSummary[]): Record<Foda, FactorSummary[]> => {
    const groups: Record<Foda, FactorSummary[]> = { strength: [], weakness: [], opportunity: [], threat: [] };
    factors.forEach((factor) => {
        if (factor.is_relevant && factor.foda) groups[factor.foda].push(factor);
    });
    return groups;
};

export const RECOMMENDATION_TITLES: Record<Recommendation, string> = {
    A: 'Adoptar',
    B: 'Es posible adoptar, con matices',
    C: 'Analizar y posponer la adopción',
};
