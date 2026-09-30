import useAuthStore from '../app/useAuthStore';
 
export type PermissionAction = 'read' | 'modify' | 'delete' | string;
 

export const usePermissions = () => {
    const user = useAuthStore((state) => state.user);

    const isSuperuser = !!user?.is_superuser;
    const permissions = new Set<string>(user?.permissions ?? []);
    const isWildcard = permissions.has('*');

    /** Verifica un permiso específico. Uso: has('pos.cancel_sale') */
    const has = (codename: string): boolean => {
        if (!user) return false;
        if (isSuperuser || isWildcard) return true;
        return permissions.has(codename);
    };

    /** Verifica que el usuario tiene TODOS los permisos indicados. */
    const hasAll = (...codenames: string[]): boolean =>
        codenames.every(has);

    /** Verifica que el usuario tiene AL MENOS UNO de los permisos. */
    const hasAny = (...codenames: string[]): boolean =>
        codenames.some(has);

    return {
        has,
        hasAll,
        hasAny,
        hasPermission: has, // Alias para compatibilidad legacy
        isSuperuser: isSuperuser || isWildcard,
        isAdmin: !!user?.is_staff || isSuperuser || isWildcard, // Alias legacy
        isStaff: !!user?.is_staff || isSuperuser || isWildcard,
        isAuthenticated: !!user,

        // ── Helpers de compatibilidad temporal ─────────────────────────────
        // Borrar estos cuando se hayan migrado todos los componentes:
        canRead:   has('dashboard.view'),
        canModify: isSuperuser || isWildcard,
        canDelete: isSuperuser || isWildcard,
    };
};

export default usePermissions;
