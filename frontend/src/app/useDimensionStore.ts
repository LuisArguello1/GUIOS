/**
 * app/useDimensionStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Store global de Zustand para la gestión de Dimensiones GUIOS.
 */

import { create } from 'zustand';
import type { Dimension, DimensionDetail, DimensionQueryParams } from '../api/dimensionService';

interface DimensionState {
    dimensions: Dimension[];
    total: number;
    loading: boolean;
    selectedDimension: DimensionDetail | null;
    filters: DimensionQueryParams;

    setDimensions: (dimensions: Dimension[], total?: number) => void;
    setLoading: (loading: boolean) => void;
    setSelectedDimension: (dimension: DimensionDetail | null) => void;
    setFilters: (filters: Partial<DimensionQueryParams>) => void;
    resetFilters: () => void;
}

const DEFAULT_FILTERS: DimensionQueryParams = {
    search: '',
    is_base: undefined,
    page: 1,
    page_size: 20,
};

export const useDimensionStore = create<DimensionState>((set) => ({
    dimensions: [],
    total: 0,
    loading: false,
    selectedDimension: null,
    filters: DEFAULT_FILTERS,

    setDimensions: (dimensions, total) => {
        const safeArray = Array.isArray(dimensions) ? dimensions : [];
        set({
            dimensions: safeArray,
            total: total !== undefined ? total : safeArray.length,
        });
    },

    setLoading: (loading) => set({ loading }),

    setSelectedDimension: (selectedDimension) => set({ selectedDimension }),

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

export default useDimensionStore;
