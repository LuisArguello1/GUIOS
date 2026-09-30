import { create } from 'zustand';

export interface AuditLog {
    id: number | string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'EXPORT';
    action_display: string;
    source: string;
    source_display: string;
    model_name: string;
    object_id: string;
    user: number | null;
    user_email?: string;
    field_labels?: Record<string, string>;
    before: Record<string, unknown> | null;
    before_display?: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    after_display?: Record<string, unknown> | null;
    changed_fields: string[];
    changed_fields_display?: string[];
    deleted_snapshot?: Record<string, unknown> | null;
    deleted_snapshot_display?: Record<string, unknown> | null;
    ip_address?: string;
    request_id?: string;
    timestamp: string;
}

export interface AuditFilters {
    search: string;
    model_name: string;
    // CORRECCIÓN: user_id como number | undefined en lugar de number | string | null.
    // Pasar null o "null" como query param genera ?user_id=null en la URL,
    // que Django rechaza con 400. undefined hace que axios omita el parámetro.
    user_id?: number;
    page?: number;
}

interface AuditState {
    logs: AuditLog[];
    loading: boolean;
    total: number;
    filters: AuditFilters;

    setLogs: (logs: AuditLog[], total?: number) => void;
    setLoading: (loading: boolean) => void;
    setFilters: (filters: Partial<AuditFilters>) => void;
    resetFilters: () => void;
}

const DEFAULT_FILTERS: AuditFilters = {
    search: '',
    model_name: '',
    user_id: undefined,
    page: 1,
};

const useAuditStore = create<AuditState>((set) => ({
    logs: [],
    loading: false,
    total: 0,
    filters: DEFAULT_FILTERS,

    setLogs: (logs, total) =>
        set({ logs, total: total !== undefined ? total : logs.length }),

    setLoading: (loading) => set({ loading }),

    setFilters: (newFilters) =>
        set((state) => ({
            filters: { ...state.filters, ...newFilters },
        })),

    resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}));

export default useAuditStore;