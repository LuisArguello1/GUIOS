import { useEffect } from 'react';
import useCoreStore from '../app/useCoreStore';
import useAuthStore from '../app/useAuthStore';

export const useMenu = () => {
    const menu = useCoreStore((s) => s.menu);
    const menuLoaded = useCoreStore((s) => s.menuLoaded);
    const loadingMenu = useCoreStore((s) => s.loadingMenu);
    const menuError = useCoreStore((s) => s.menuError);
    // Selector estable: Zustand garantiza identidad de referencia en acciones
    const fetchMenu = useCoreStore((s) => s.fetchMenu);
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const userId = useAuthStore((s) => s.user?.id);
    const selectedGroupId = useAuthStore((s) => s.selectedGroup?.id);

    useEffect(() => {
        if (isAuthenticated && !menuLoaded) {
            void fetchMenu({ roleId: selectedGroupId });
        }
    }, [isAuthenticated, menuLoaded, userId, selectedGroupId, fetchMenu]);

    return {
        menu,
        isLoadingMenu: loadingMenu,
        menuError,
        hasModules: menu.length > 0,
        refreshMenu: () => fetchMenu({ force: true, roleId: selectedGroupId }),
    };
};

export default useMenu;