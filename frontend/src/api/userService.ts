import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { User, UserFilters } from '../app/useUserStore';

export interface UserDeleteResult {
    action: 'HARD_DELETE' | 'SOFT_DELETE';
    message: string;
    detail: string[];
}

export const DEFAULT_DELETE_MESSAGE = 'Usuario eliminado.';

/** Qué pasará al eliminar: misma regla que el DELETE (registros como autor → se desactiva). */
export interface UserDeleteImpact {
    action: 'HARD_DELETE' | 'SOFT_DELETE';
    total: number;
    items: { key: string; label: string; count: number }[];
    summary: string;
}

/**
 * Respuesta paginada estándar de Django REST Framework.
 * DRF con PageNumberPagination retorna { count, next, previous, results }
 * no un array directo. El hook debe leer .results y .count.
 */
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

/** Parámetros que acepta el endpoint GET /users/ */
type UserQueryParams = Omit<UserFilters, 'page_size'> & {
    page_size?: number;
};

const userService = {
    /**
     * Lista de usuarios con filtros y paginación.
     * Retorna PaginatedResponse<User> — leer .results y .count en el hook.
     */
    getAll: async (params: Partial<UserQueryParams> = {}): Promise<PaginatedResponse<User>> => {
        // CORRECCIÓN: limpiar valores undefined/vacíos antes de enviar
        // para no generar params como ?search=&show_inactive=false innecesarios
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
        const response = await api.get<PaginatedResponse<User>>(ENDPOINTS.USERS.BASE, {
            params: cleanParams,
        });
        return response.data;
    },

    getSelectors: async (): Promise<User[]> => {
        const response = await api.get<User[]>(ENDPOINTS.USERS.SELECTORS);
        return response.data;
    },

    getById: async (id: string | number): Promise<User> => {
        const response = await api.get<User>(ENDPOINTS.USERS.DETAIL(id));
        return response.data;
    },

    create: async (userData: Partial<User> & { password: string }): Promise<User> => {
        const response = await api.post<User>(ENDPOINTS.USERS.BASE, userData);
        return response.data;
    },

    /**
     * Actualización parcial (PATCH). Detecta FormData para envío de avatar.
     *
     * CORRECCIÓN: la detección de FormData usa Object.prototype.toString
     * en lugar de instanceof para funcionar correctamente con proxies y
     * entornos donde FormData puede ser de un iframe diferente.
     */
    update: async (
        id: string | number,
        userData: Partial<User> | FormData
    ): Promise<User> => {
        const isFormData =
            Object.prototype.toString.call(userData) === '[object FormData]';
        const response = await api.patch<User>(
            ENDPOINTS.USERS.DETAIL(id),
            userData,
            isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
        );
        return response.data;
    },

    /**
     * Soft/Hard delete. El backend responde 200 con { action, message, detail }.
     * Un 2xx es éxito aunque el cuerpo falte o no sea JSON: nunca se depende de él.
     */
    delete: async (id: string | number): Promise<UserDeleteResult> => {
        const response = await api.delete(ENDPOINTS.USERS.DETAIL(id));
        const data: unknown = response.data;
        if (data && typeof data === 'object' && 'action' in data) {
            const result = data as Partial<UserDeleteResult>;
            return {
                action: result.action === 'SOFT_DELETE' ? 'SOFT_DELETE' : 'HARD_DELETE',
                message: result.message || DEFAULT_DELETE_MESSAGE,
                detail: Array.isArray(result.detail) ? result.detail : [],
            };
        }
        return { action: 'HARD_DELETE', message: DEFAULT_DELETE_MESSAGE, detail: [] };
    },

    getDeleteImpact: async (id: string | number): Promise<UserDeleteImpact> => {
        const response = await api.get<UserDeleteImpact>(ENDPOINTS.USERS.DELETE_IMPACT(id));
        return response.data;
    },

    toggleActive: async (id: string | number): Promise<{ is_active: boolean; detail: string }> => {
        const response = await api.post(ENDPOINTS.USERS.TOGGLE_ACTIVE(id));
        return response.data;
    },
};

export default userService;