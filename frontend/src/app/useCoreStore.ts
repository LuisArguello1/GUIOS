import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import coreService from '../api/coreService';
import type { MenuGroup, Organization, SidebarPrefs } from './types/core';

interface CoreState {
    menu: MenuGroup[];
    organization: Organization | null;
    organizationLoaded: boolean;
    menuLoaded: boolean;

    // Loading granular por operación
    loadingMenu: boolean;
    loadingOrg: boolean;

    // Estado de error explícito
    menuError: string | null;
    orgError: string | null;

    // Estado de UI efímero
    isMobileOpen: boolean;

    fetchMenu: (options?: { force?: boolean; roleId?: number | string }) => Promise<void>;
    fetchOrganization: () => Promise<void>;
    updateOrganization: (data: Partial<Organization>) => Promise<void>;
    setOrganization: (data: Organization | null) => void;
    updatePreferences: (data: {
        sidebar?: Partial<SidebarPrefs>;
    }) => Promise<void>;
    toggleMobile: () => void;
    setMobileOpen: (open: boolean) => void;
}

const useCoreStore = create<CoreState>()(
    persist(
        (set, get) => ({
            menu: [],
            organization: null,
            organizationLoaded: false,
            menuLoaded: false,
            loadingMenu: false,
            loadingOrg: false,
            menuError: null,
            orgError: null,
            isMobileOpen: false,

            fetchMenu: async (options) => {
                const { loadingMenu, menuLoaded } = get();
                if (loadingMenu) return;
                if (menuLoaded && !options?.force) return;

                set({ loadingMenu: true, menuError: null });
                try {
                    const data = await coreService.getMenu(options?.roleId);
                    set({ menu: data, menuLoaded: true });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Error al cargar el menú';
                    // Marcamos intento para evitar tormenta de reintentos automáticos.
                    set({ menuError: msg, menuLoaded: true });
                } finally {
                    set({ loadingMenu: false });
                }
            },

            fetchOrganization: async () => {
                set({ loadingOrg: true, orgError: null });
                try {
                    const data = await coreService.getOrganization();
                    set({ organization: data, organizationLoaded: true });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Error al cargar la organización';
                    set({ orgError: msg });
                } finally {
                    set({ loadingOrg: false, organizationLoaded: true });
                }
            },

            updateOrganization: async (data) => {
                set({ loadingOrg: true, orgError: null });
                try {
                    const updated = await coreService.updateOrganization(data);
                    set({ organization: updated, organizationLoaded: true });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Error al actualizar';
                    set({ orgError: msg });
                    throw err;
                } finally {
                    set({ loadingOrg: false });
                }
            },

            setOrganization: (data) => set({ organization: data, organizationLoaded: true }),

            updatePreferences: async (data) => {
                // Actualización del estado local para el Sidebar (Optimista/Local)
                const currentOrg = get().organization;
                if (currentOrg) {
                    const newSidebar = data.sidebar
                        ? { ...currentOrg.sidebar_preferences, ...data.sidebar }
                        : currentOrg.sidebar_preferences;

                    set({ 
                        organization: { 
                            ...currentOrg, 
                            sidebar_preferences: newSidebar,
                        },
                        organizationLoaded: true,
                    });
                }
            },

            toggleMobile: () => set({ isMobileOpen: !get().isMobileOpen }),
            setMobileOpen: (open: boolean) => set({ isMobileOpen: open }),
        }),
        {
            name: 'core-storage',
            partialize: (state) => ({
                organization: state.organization
                    ? {
                          ...state.organization,
                          // Forzamos que la organización guarde el estado del sidebar en disco (LocalStorage)
                          sidebar_preferences: state.organization.sidebar_preferences
                      }
                    : null,
            }),
        }
    )
);

export default useCoreStore;