import { create } from 'zustand';
import organizationService, { type Organization } from '../api/organizationService';

interface OrganizationState {
    organization: Organization | null;
    isLoading: boolean;
    error: string | null;
    fetchOrganization: () => Promise<void>;
    setOrganization: (data: Organization | null) => void;
    clearOrganization: () => void;
}

const useOrganizationStore = create<OrganizationState>((set) => ({
    organization: null,
    isLoading: false,
    error: null,

    fetchOrganization: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await organizationService.getOrganization();
            set({ organization: data, isLoading: false });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo cargar la organización.';
            set({ error: message, isLoading: false });
        }
    },

    setOrganization: (data) => set({ organization: data }),

    clearOrganization: () => set({ organization: null }),
}));

export default useOrganizationStore;
