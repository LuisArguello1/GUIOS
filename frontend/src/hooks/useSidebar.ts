import useCoreStore from '../app/useCoreStore';



/**
 * useSidebar Hook
 * 
 * Abstracción para el estado de colapso y diseño del sidebar.
 */
export const useSidebar = () => {
    const sidebarPrefs = useCoreStore((s) => s.organization?.sidebar_preferences);
    const updatePreferences = useCoreStore((s) => s.updatePreferences);
    
    // Prioritize local session state, falling back to persistent default
    const isCollapsed = sidebarPrefs?.is_collapsed ?? true;
    const isMobileOpen = useCoreStore((s) => s.isMobileOpen);
    const toggleMobile = useCoreStore((s) => s.toggleMobile);
    const setMobileOpen = useCoreStore((s) => s.setMobileOpen);

    const toggleSidebar = async () => {
        const nextValue = !isCollapsed;
        await updatePreferences({
            sidebar: { is_collapsed: nextValue }
        });
    };

    const setCollapsed = async (collapsed: boolean) => {
        await updatePreferences({
            sidebar: { is_collapsed: collapsed }
        });
    };

    return {
        isCollapsed,
        isMobileOpen,
        toggleSidebar,
        toggleMobile,
        setMobileOpen,
        setCollapsed,
        sidebarPrefs,
    };
};

export default useSidebar;
