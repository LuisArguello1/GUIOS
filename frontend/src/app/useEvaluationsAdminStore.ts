import { create } from 'zustand';
import guiosAdminService, {
    getAdminErrorMessage,
    type EvaluationListItem,
    type HistoryFilters,
} from '../api/guiosAdminService';

export const HISTORY_PAGE_SIZE = 20;

interface EvaluationsAdminState {
    filters: HistoryFilters;
    page: number;
    results: EvaluationListItem[];
    count: number;
    isLoading: boolean;
    error: string | null;
    setFilters: (filters: HistoryFilters) => void;
    setPage: (page: number) => void;
    load: () => Promise<void>;
}

/** Historial de evaluaciones con los filtros aplicados (RF-ADM-34). */
const useEvaluationsAdminStore = create<EvaluationsAdminState>((set, get) => ({
    filters: {},
    page: 1,
    results: [],
    count: 0,
    isLoading: false,
    error: null,

    setFilters: (filters) => set({ filters, page: 1 }),
    setPage: (page) => set({ page }),

    load: async () => {
        const { filters, page } = get();
        set({ isLoading: true, error: null });
        try {
            const data = await guiosAdminService.getEvaluations(filters, page, HISTORY_PAGE_SIZE);
            set({ results: data.results, count: data.count, isLoading: false });
        } catch (error) {
            set({ error: getAdminErrorMessage(error, 'No se pudo cargar el historial.'), isLoading: false });
        }
    },
}));

export default useEvaluationsAdminStore;
