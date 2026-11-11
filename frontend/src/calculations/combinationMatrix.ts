/**
 * Figura 5.10 de la tesis GUIOS.
 * La misma matriz calcula IS = M(IE, IL) e IR = M(ID, IS).
 * El motor que persiste el resultado está en el backend; esta copia solo
 * anticipa el valor en la interfaz, antes de guardar.
 */

export const COMBINATION_MATRIX: Record<number, Record<number, number>> = {
    1: { 1: 1, 2: 1, 3: 2, 4: 2 },
    2: { 1: 1, 2: 2, 3: 2, 4: 3 },
    3: { 1: 2, 2: 2, 3: 3, 4: 3 },
    4: { 1: 2, 2: 3, 3: 3, 4: 4 },
};

export const combineImportance = (rowValue: number, columnValue: number): number => {
    const row = Math.max(1, Math.min(4, Math.round(rowValue)));
    const column = Math.max(1, Math.min(4, Math.round(columnValue)));
    return COMBINATION_MATRIX[row]?.[column] ?? 1;
};

/** IS = M(IE, IL). */
export const calculateSuggestedImportance = (
    literatureImportance: number,
    expertImportance: number,
): number => combineImportance(expertImportance, literatureImportance);

/** IR = M(ID, IS). */
export const calculateRelativeImportance = (
    suggestedImportance: number,
    decisorImportance: number,
): number => combineImportance(decisorImportance, suggestedImportance);

/** PM redondeada a 1 decimal, igual que el motor del backend. */
export const roundWeightedAverage = (ratings: number[]): number => {
    if (ratings.length === 0) return 0;
    const raw = ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
    return Math.round(raw * 10) / 10;
};

/** Ecuación 5.3. El umbral es 3.0. */
export const classifyFoda = (weightedAverage: number, scope: 'internal' | 'external'): string => {
    const meetsThreshold = weightedAverage >= 3;
    if (scope === 'internal') return meetsThreshold ? 'Fortaleza' : 'Debilidad';
    return meetsThreshold ? 'Oportunidad' : 'Amenaza';
};

export type RecommendationCode = 'A' | 'B' | 'C';

/**
 * Dictamen A, B o C.
 * Un fallo con IR = 1 no cuenta. B exige que todos los fallos sean IR = 2.
 * C aparece en cuanto un fallo tiene IR >= 3.
 */
export const classifyRecommendation = (
    factors: { meetsThreshold: boolean; relativeImportance: number }[],
): RecommendationCode | null => {
    if (factors.length === 0) return null;
    const failures = factors.filter((factor) => !factor.meetsThreshold);
    if (failures.length === 0) return 'A';
    if (failures.some((factor) => factor.relativeImportance >= 3)) return 'C';
    if (failures.every((factor) => factor.relativeImportance === 2)) return 'B';
    return 'A';
};

export const RECOMMENDATION_LABELS: Record<RecommendationCode, string> = {
    A: 'Adoptar sin observaciones',
    B: 'Es posible adoptar, con matices',
    C: 'Se sugiere analizar la adopción y posponerla',
};
