import { create } from 'zustand';

export interface User {
    id: number | string;
    email: string;
    username: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar?: string | null;
    is_active: boolean;
    is_staff: boolean;
    is_superuser: boolean;
    created_at: string;
    updated_at?: string;
    last_login?: string | null;
    groups?: number[];
}

export interface UserFilters {
    search: string;
    show_inactive: boolean;
    page?: number;
    page_size?: number;
}

interface UserState {
    users: User[];
    loading: boolean;
    total: number;
    filters: UserFilters;

    setUsers: (users: User[], total?: number) => void;
    setLoading: (loading: boolean) => void;
    setFilters: (filters: Partial<UserFilters>) => void;
    resetFilters: () => void;
}

const DEFAULT_FILTERS: UserFilters = {
    search: '',
    show_inactive: false,
    page: 1,
};

const useUserStore = create<UserState>((set) => ({
    users: [],
    loading: false,
    total: 0,
    filters: DEFAULT_FILTERS,

    setUsers: (users, total) =>
        set({ users, total: total !== undefined ? total : users.length }),

    setLoading: (loading) => set({ loading }),

    setFilters: (newFilters) =>
        set((state) => ({
            filters: { ...state.filters, ...newFilters },
        })),

    resetFilters: () => set({ filters: DEFAULT_FILTERS }),
}));

export default useUserStore;
