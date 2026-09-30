import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../app/useAuthStore';
import { useMenu } from '../../hooks/useMenu';
import { useLandingPath } from '../../hooks/useLandingPath';
import Loading from '../ui/Loading';

interface ModuleGuardProps {
    children: ReactNode;
    requiredPath: string;
}

/**
 * ModuleGuard — Protector de acceso a módulos del sistema.
 * Valida autenticación y permisos según el menú dinámico del usuario.
 */
const ModuleGuard = ({ children, requiredPath }: ModuleGuardProps) => {
    const { user, isAuthenticated } = useAuthStore();
    const { menu, isLoadingMenu, hasModules } = useMenu();
    const location = useLocation();
    const landingPath = useLandingPath();

    const hasBypass = user?.is_superuser;

    // 1. Redirección si no está autenticado
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Pantalla de carga mientras se sincroniza el menú
    if (isLoadingMenu) {
        return (
            <div className="h-full min-h-[350px] flex items-center justify-center bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                <Loading label="Sincronizando permisos..." />
            </div>
        );
    }

    // 3. Superusuario con bypass completo
    if (hasBypass) {
        return <>{children}</>;
    }

    // 4. Verificación basada en módulos asignados al usuario
    const isModuleHabilitado = menu.some((group) =>
        group.modules.some(
            (module) =>
                requiredPath.startsWith(module.path) || module.path.startsWith(requiredPath)
        )
    );

    if (!isModuleHabilitado) {
        if (!hasModules) {
            return <Navigate to="/select-role" replace />;
        }
        return <Navigate to={landingPath} replace />;
    }

    return <>{children}</>;
};

export default ModuleGuard;