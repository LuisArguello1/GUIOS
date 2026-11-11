/**
 * features/guios/evaluations/utils/factorCodes.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Funciones de utilidad para formatear códigos de factores y subfactores (ej. TEC-FUN-01).
 */

export const getFactorCode = (factorName: string, dimensionName: string): string => {
    const dimPrefix = dimensionName.toLowerCase().includes('tec')
        ? 'TEC'
        : dimensionName.toLowerCase().includes('org')
        ? 'ORG'
        : 'ECO';

    const factorClean = factorName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');

    const facPrefix = factorClean.slice(0, 3);
    return `${dimPrefix}-${facPrefix}`;
};

export const getSubfactorCode = (factorCode: string, order: number): string => {
    return `${factorCode}-${String(order).padStart(2, '0')}`;
};
