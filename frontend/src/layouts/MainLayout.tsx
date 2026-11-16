import { Suspense, useCallback, useEffect, useRef, memo } from 'react';
import { Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import Sidebar from '../components/layouts/Sidebar';
import Navbar from '../components/navigation/navbar';
import Breadcrumbs from '../components/navigation/breadcrumbs';
import Loading from '../components/ui/Loading';

import { useMenu } from '../hooks/useMenu';
import { useSessionIdleTimeout } from '../hooks/useSessionIdleTimeout';
import useCoreStore from '../app/useCoreStore';
import useAuthStore from '../app/useAuthStore';
import authService from '../api/authService';

/**
 * MainLayout.
 * Unifica Sidebar, Navbar y el área de contenido dinámico (Outlet).
 * Implementa la lógica de diseño responsivo y carga inicial.
 */
const MainLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isLoadingMenu } = useMenu();
    const { fetchOrganization, loadingOrg, organizationLoaded } = useCoreStore();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const groups = useAuthStore((state) => state.groups);
    const user = useAuthStore((state) => state.user);
    const setAuthUser = useAuthStore((state) => state.setUser);
    const logoutStore = useAuthStore((state) => state.logout);
    const sessionIdleTimeoutSeconds = useAuthStore((state) => state.sessionIdleTimeoutSeconds);
    const lastPermissionSyncRef = useRef(0);

    const handleIdleLogout = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // Si la sesión ya venció en backend, continuamos limpiando estado local.
        } finally {
            logoutStore();
            navigate('/login?session=idle', { replace: true });
        }
    }, [logoutStore, navigate]);

    useSessionIdleTimeout({
        enabled: isAuthenticated,
        timeoutSeconds: sessionIdleTimeoutSeconds,
        onIdleLogout: handleIdleLogout,
    });

    // Carga inicial de datos de la organización al montar el layout principal
    useEffect(() => {
        if (!isAuthenticated) return;
        if (!organizationLoaded && !loadingOrg) {
            void fetchOrganization();
        }
    }, [isAuthenticated, organizationLoaded, loadingOrg, fetchOrganization]);

    // Mantiene permisos/perfil sincronizados con backend sin exigir re-login.
    const syncAuthenticatedUser = useCallback(async (force = false, background = false) => {
        if (!isAuthenticated) return;

        const now = Date.now();
        if (!force && now - lastPermissionSyncRef.current < 20000) return;
        lastPermissionSyncRef.current = now;

        try {
            const backendUser = await authService.getCurrentUser({ background });
            setAuthUser(backendUser);
        } catch {
            // El interceptor global de axios ya maneja 401 y expiracion.
        }
    }, [isAuthenticated, setAuthUser]);

    useEffect(() => {
        if (!isAuthenticated) return;
        void syncAuthenticatedUser(true);
    }, [isAuthenticated, syncAuthenticatedUser]);

    useEffect(() => {
        if (!isAuthenticated) return;
        void syncAuthenticatedUser(false);
    }, [isAuthenticated, location.pathname, syncAuthenticatedUser]);

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        const handleFocus = () => {
            void syncAuthenticatedUser(true);
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [isAuthenticated, syncAuthenticatedUser]);

    useEffect(() => {
        if (!isAuthenticated) return undefined;
        const intervalId = window.setInterval(() => {
            void syncAuthenticatedUser(false, true);
        }, 45000);
        return () => window.clearInterval(intervalId);
    }, [isAuthenticated, syncAuthenticatedUser]);

    // Fallback para carga de páginas (Suspense)
    const PageFallback = (
        <div className="flex items-center justify-center p-12">
            <Loading label="Cargando módulo..." />
        </div>
    );

    // Mientras se carga la configuración inicial (menú u organización)
    const isInitialLoading = isLoadingMenu || loadingOrg || !organizationLoaded;

    // Si no está autenticado, redirigir a login inmediatamente (después de ejecutar los hooks)
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (groups.length === 0 && !user?.is_superuser && !user?.is_staff) {
        return <Navigate to="/no-role" replace />;
    }

    return (
        <div className="h-screen w-full bg-[var(--color-bg-page)] text-[var(--color-text-primary)] flex p-0 lg:p-3 lg:gap-3 overflow-hidden">
            {/* Sidebar Dinámico — Isla flotante con espacio en desktop */}
            <Sidebar />

            {/* Contenedor Principal Unificado — Navbar y MainLayout integrados como uno solo */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[var(--color-bg-page)]">
                {/* Navbar Superior Integrado */}
                <Navbar />

                {/* Área de Trabajo */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[var(--color-bg-page)]">
                    {isInitialLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loading fullPage={false} label="Sincronizando seguridad..." />
                        </div>
                    ) : (
                        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
                            <Breadcrumbs />

                            {/* Contenido Dinámico con Animación de Transición */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={location.pathname}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                >
                                    <Suspense fallback={PageFallback}>
                                        <Outlet />
                                    </Suspense>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default memo(MainLayout);
