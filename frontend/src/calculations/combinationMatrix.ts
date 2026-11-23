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

/** PM exacta sin redondear, usada para evaluar el umbral PM >= 3.0. */
export const calculateRawWeightedAverage = (ratings: number[]): number => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((total, rating) => total + rating, 0);
    return sum / ratings.length;
};

/** PM redondeada a 1 decimal, igual que el motor del backend (ROUND_HALF_UP). */
export const roundWeightedAverage = (ratings: number[]): number => {
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((total, rating) => total + rating, 0);
    return Math.round((sum * 10) / ratings.length) / 10;
};

/** Ecuación 5.3. El umbral es 3.0. */
export const classifyFoda = (weightedAverage: number, scope: 'internal' | 'external'): string => {
    const meetsThreshold = weightedAverage >= 3;
    if (scope === 'internal') return meetsThreshold ? 'Fortaleza' : 'Debilidad';
    return meetsThreshold ? 'Oportunidad' : 'Amenaza';
};

export type RecommendationCode = 'A' | 'B' | 'C';

/**
 * Dictamen A, B o C (alineado con verdict.py del backend, tesis págs. 104-106).
 * Un fallo con IR = 1 no cuenta.
 * C aparece si algún fallo tiene IR >= 3 o si los fallos opcionales (IR = 2)
 * superan en cantidad a los positivos (PM >= 3.0).
 * B exige que todos los fallos relevantes sean IR = 2 y no superen a los positivos.
 */
export const classifyRecommendation = (
    factors: { meetsThreshold: boolean; relativeImportance: number }[],
): RecommendationCode | null => {
    if (factors.length === 0) return null;
    const positives = factors.filter((factor) => factor.meetsThreshold);
    const failures = factors.filter(
        (factor) => !factor.meetsThreshold && factor.relativeImportance > 1,
    );
    if (failures.length === 0) return 'A';
    if (failures.some((factor) => factor.relativeImportance >= 3)) return 'C';
    if (failures.length > positives.length) return 'C';
    return 'B';
};

export const RECOMMENDATION_LABELS: Record<RecommendationCode, string> = {
    A: 'Adoptar sin observaciones',
    B: 'Es posible adoptar, con matices',
    C: 'Se sugiere analizar la adopción y posponerla',
};
