/**
 * app/useFactorStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Store global de Zustand para la gestión del catálogo de Factores GUIOS.
 */

import { create } from 'zustand';
import type { Factor, FactorDetail, FactorQueryParams } from '../api/factorService';

interface FactorState {
    factors: Factor[];
    total: number;
    loading: boolean;
    selectedFactor: FactorDetail | null;
    filters: FactorQueryParams;

    setFactors: (factors: Factor[], total?: number) => void;
    setLoading: (loading: boolean) => void;
    setSelectedFactor: (factor: FactorDetail | null) => void;
    setFilters: (filters: Partial<FactorQueryParams>) => void;
    resetFilters: () => void;
}

const DEFAULT_FILTERS: FactorQueryParams = {
    dimension: undefined,
    scope: undefined,
    is_base: undefined,
    is_active: undefined,
    search: '',
    page: 1,
    page_size: 20,
};

export const useFactorStore = create<FactorState>((set) => ({
    factors: [],
    total: 0,
    loading: false,
    selectedFactor: null,
    filters: DEFAULT_FILTERS,

    setFactors: (factors, total) => {
        const safeArray = Array.isArray(factors) ? factors : [];
        set({
            factors: safeArray,
            total: total !== undefined ? total : safeArray.length,
        });
    },

    setLoading: (loading) => set({ loading }),

    setSelectedFactor: (selectedFactor) => set({ selectedFactor }),

    setFilters: (newFilters) =>
        set((state) => {
            const isPageOnly = Object.keys(newFilters).length === 1 && 'page' in newFilters;
            return {
                filters: {
                    ...state.filters,
                    ...newFilters,
                    page: isPageOnly ? newFilters.page : (newFilters.page ?? 1),
                },
            };
        }),

    resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}));

export default useFactorStore;
