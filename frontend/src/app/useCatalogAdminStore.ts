import { create } from 'zustand';
import guiosAdminService, { getAdminErrorMessage, type AdminDimension } from '../api/guiosAdminService';

interface CatalogAdminState {
    tree: AdminDimension[];
    isLoading: boolean;
    error: string | null;
    loadTree: () => Promise<void>;
}

/** Árbol del catálogo para el panel (incluye inactivos, con conteos y can_delete). */
const useCatalogAdminStore = create<CatalogAdminState>((set) => ({
    tree: [],
    isLoading: false,
    error: null,

    loadTree: async () => {
        set({ isLoading: true, error: null });
        try {
            const tree = await guiosAdminService.getCatalogTree();
            set({ tree, isLoading: false });
        } catch (error) {
            set({ error: getAdminErrorMessage(error, 'No se pudo cargar el catálogo.'), isLoading: false });
        }
    },
}));

export default useCatalogAdminStore;
