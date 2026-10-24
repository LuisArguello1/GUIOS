/**
 * app/useSubfactorStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Store global de Zustand para la gestión de Subfactores (Criterios evaluables GUIOS).
 */

import { create } from 'zustand';
import type { Subfactor, SubfactorQueryParams } from '../api/subfactorService';

interface SubfactorState {
    subfactors: Subfactor[];
    total: number;
    loading: boolean;
    selectedSubfactor: Subfactor | null;
    filters: SubfactorQueryParams;

    setSubfactors: (subfactors: Subfactor[], total?: number) => void;
    setLoading: (loading: boolean) => void;
    setSelectedSubfactor: (subfactor: Subfactor | null) => void;
    setFilters: (filters: Partial<SubfactorQueryParams>) => void;
    resetFilters: () => void;
}

const DEFAULT_FILTERS: SubfactorQueryParams = {
    factor: undefined,
    dimension: undefined,
    is_base: undefined,
    is_active: undefined,
    search: '',
    page: 1,
    page_size: 20,
};

export const useSubfactorStore = create<SubfactorState>((set) => ({
    subfactors: [],
    total: 0,
    loading: false,
    selectedSubfactor: null,
    filters: DEFAULT_FILTERS,

    setSubfactors: (subfactors, total) => {
        const safeArray = Array.isArray(subfactors) ? subfactors : [];
        set({
            subfactors: safeArray,
            total: total !== undefined ? total : safeArray.length,
        });
    },

    setLoading: (loading) => set({ loading }),

    setSelectedSubfactor: (selectedSubfactor) => set({ selectedSubfactor }),

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

export default useSubfactorStore;
