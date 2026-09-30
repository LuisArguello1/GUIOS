import { useMemo } from 'react';
import usePermissions from './usePermissions';
import useCoreStore from '../app/useCoreStore';

export const useLandingPath = (): string => {
    const { has, isSuperuser } = usePermissions();
    const menu = useCoreStore((s) => s.menu);
    const menuLoaded = useCoreStore((s) => s.menuLoaded);

    return useMemo(() => {
        // Si el menú no se ha cargado todavía, asumimos /dashboard por defecto
        // para evitar redirecciones prematuras durante el ciclo de vida inicial.
        if (!menuLoaded) {
            return '/dashboard';
        }

        const canViewDashboard = isSuperuser || has('dashboard.view');
        if (canViewDashboard) {
            return '/dashboard';
        }

        // Buscar el primer path del primer módulo activo en el árbol de menús (priorizando los que usen el MainLayout, no fullscreen)
        let fallbackPath: string | null = null;
        for (const group of menu) {
            if (group.modules) {
                for (const m of group.modules) {
                    if (m.path) {
                        const isFullscreen = m.path === '/dashboard/attention' || 
                                             m.path === '/dashboard/display' || 
                                             m.path === '/display';
                        if (isFullscreen) {
                            if (!fallbackPath) {
                                fallbackPath = m.path;
                            }
                        } else {
                            return m.path;
                        }
                    }
                }
            }
        }

        if (fallbackPath) {
            return fallbackPath;
        }

        // Si el usuario no tiene módulos en absoluto, lo mandamos a selección de rol
        return '/select-role';
    }, [has, isSuperuser, menu, menuLoaded]);
};

export default useLandingPath;
