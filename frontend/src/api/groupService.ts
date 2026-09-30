import api from './axios';
import { ENDPOINTS } from './endpoints';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface GroupPayload {
    name: string;
}

/**
 * Los módulos pueden venir del servidor como:
 *   - number[]            → IDs directos
 *   - { id: number }[]    → objetos parciales
 * Ambos casos se aceptan aquí; la normalización a number[] ocurre en el consumidor.
 */
export interface ModulePermission {
    id:          number;
    codename:    string;
    label:       string;
    description: string;
    order:       number;
}

export interface GroupResponse {
    id:               number;
    name:             string;
    modules?:         Array<number | { id: number }>;
    menu_module_ids?: Array<number | { id: number }>;
    permission_ids?:  Array<number>;
    permissions?:     Array<ModulePermission>;
}

/** Respuesta paginada estándar del backend Django REST */
export interface PaginatedResponse<T> {
    count:    number;
    next:     string | null;
    previous: string | null;
    results:  T[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Servicio
// ─────────────────────────────────────────────────────────────────────────────

const groupService = {

    /**
     * Devuelve todos los roles.
     * FIX: la API puede devolver un array o un objeto paginado — ambos se aceptan.
     */
    getAll: async (): Promise<GroupResponse[] | PaginatedResponse<GroupResponse>> => {
        const { data } = await api.get<GroupResponse[] | PaginatedResponse<GroupResponse>>(
            ENDPOINTS.CORE.GROUPS.BASE
        );
        return data;
    },

    /** Obtiene el árbol estructurado de módulos y permisos disponibles */
    getPermissionTree: async () => {
        const { data } = await api.get(ENDPOINTS.CORE.PERMISSION_TREE);
        return data;
    },

    get: async (id: string | number): Promise<GroupResponse> => {
        const { data } = await api.get<GroupResponse>(ENDPOINTS.CORE.GROUPS.DETAIL(id));
        return data;
    },

    create: async (payload: GroupPayload): Promise<GroupResponse> => {
        const { data } = await api.post<GroupResponse>(ENDPOINTS.CORE.GROUPS.BASE, payload);
        return data;
    },

    update: async (id: string | number, payload: Partial<GroupPayload>): Promise<GroupResponse> => {
        const { data } = await api.put<GroupResponse>(ENDPOINTS.CORE.GROUPS.DETAIL(id), payload);
        return data;
    },

    delete: async (id: string | number): Promise<void> => {
        await api.delete(ENDPOINTS.CORE.GROUPS.DETAIL(id));
    },

    /**
     * Asigna módulos a un grupo.
     * FIX: el campo se llama `module_ids` según el backend — mantener consistente.
     * Si el backend devuelve el grupo actualizado lo retornamos; si devuelve 204 retornamos null.
     */
    updateModules: async (
        id: string | number,
        moduleIds: number[]
    ): Promise<GroupResponse | null> => {
        const { data, status } = await api.post<GroupResponse>(
            ENDPOINTS.CORE.GROUPS.UPDATE_MODULES(id),
            { module_ids: moduleIds }
        );
        // 204 No Content → no hay body
        return status === 204 ? null : data;
    },

    /** Asigna permisos granulares a un rol. */
    updatePermissions: async (
        id: string | number,
        permissionIds: number[]
    ): Promise<GroupResponse | null> => {
        const { data, status } = await api.post<GroupResponse>(
            ENDPOINTS.CORE.GROUPS.UPDATE_PERMISSIONS(id),
            { permission_ids: permissionIds }
        );
        return status === 204 ? null : data;
    },

} as const;

export default groupService;