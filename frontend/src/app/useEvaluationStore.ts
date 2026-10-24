/**
 * app/useEvaluationStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Store global de Zustand para la gestión de Evaluaciones de Software (GUIOS).
 * Mantiene el estado del listado paginado, filtros y la evaluación actualmente activa en detalle.
 */

import { create } from 'zustand';
import type { EvaluationItem, EvaluationDetail, EvaluationQueryParams } from '../api/evaluationService';

interface EvaluationState {
    evaluations: EvaluationItem[];
    total: number;
    loading: boolean;
    selectedEvaluation: EvaluationDetail | null;
    isDetailLoading: boolean;
    filters: EvaluationQueryParams;

    setEvaluations: (evaluations: EvaluationItem[], total?: number) => void;
    setLoading: (loading: boolean) => void;
    setSelectedEvaluation: (evaluation: EvaluationDetail | null) => void;
    setIsDetailLoading: (isDetailLoading: boolean) => void;
    setFilters: (filters: Partial<EvaluationQueryParams>) => void;
    resetFilters: () => void;
    removeEvaluationFromList: (id: number | string) => void;
    updateEvaluationInList: (updated: Partial<EvaluationItem> & { id: number }) => void;
}

const DEFAULT_FILTERS: EvaluationQueryParams = {
    status: undefined,
    category: undefined,
    search: '',
    page: 1,
    page_size: 20,
};

export const useEvaluationStore = create<EvaluationState>((set) => ({
    evaluations: [],
    total: 0,
    loading: false,
    selectedEvaluation: null,
    isDetailLoading: false,
    filters: DEFAULT_FILTERS,

    setEvaluations: (evaluations, total) => {
        const safeArray = Array.isArray(evaluations) ? evaluations : [];
        set({
            evaluations: safeArray,
            total: total !== undefined ? total : safeArray.length,
        });
    },

    setLoading: (loading) => set({ loading }),

    setSelectedEvaluation: (selectedEvaluation) => set({ selectedEvaluation }),

    setIsDetailLoading: (isDetailLoading) => set({ isDetailLoading }),

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

    removeEvaluationFromList: (id) =>
        set((state) => {
            const numericId = Number(id);
            const nextList = state.evaluations.filter((e) => e.id !== numericId);
            return {
                evaluations: nextList,
                total: Math.max(0, state.total - 1),
                selectedEvaluation: state.selectedEvaluation?.id === numericId ? null : state.selectedEvaluation,
            };
        }),

    updateEvaluationInList: (updated) =>
        set((state) => ({
            evaluations: state.evaluations.map((item) =>
                item.id === updated.id ? { ...item, ...updated } : item
            ),
        })),
}));

export default useEvaluationStore;
