import React, { memo } from 'react';
import { usePermissions, type PermissionAction } from '../../hooks/usePermissions';

interface PermissionGuardProps {
    children: React.ReactNode;
    /**
     * Acción requerida para mostrar el contenido. 
     * Soporta acciones legacy ('read', 'modify', 'delete') o permisos granulares
     * (ej: 'can_cancel_sales', 'can_download_reports').
     */
    require?: PermissionAction;
    /**
     * Alternativamente, requiere que sea Staff o Superuser.
     */
    requireStaff?: boolean;
    /**
     * Qué mostrar si no tiene permiso. Por defecto: null (nada).
     */
    fallback?: React.ReactNode;
}

/**
 * PermissionGuard Component
 * 
 * Condiciona el renderizado basado en permisos del usuario con rendimiento optimizado.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    children,
    require,
    requireStaff = false,
    fallback = null,
}) => {
    const { has, isStaff } = usePermissions();

    // 1. Si requiere staff y no lo es, mostrar fallback
    if (requireStaff && !isStaff) return <>{fallback}</>;

    // 2. Si requiere una acción específica y no la tiene, mostrar fallback
    if (require && !has(require)) return <>{fallback}</>;

    // 3. Caso de éxito: tiene todos los requisitos
    return <>{children}</>;
};

export default memo(PermissionGuard);
