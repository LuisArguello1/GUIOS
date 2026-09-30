import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { AuditLog, AuditFilters } from '../app/useAuditStore';
import type { PaginatedResponse } from './userService';

export interface AuditModelOption {
    value: string;
    label: string;
}

const MODEL_LABEL_FALLBACKS: Record<string, string> = {
    auditlog: 'Logs de auditoría',
    user: 'Usuarios',
    group: 'Roles / Grupos',
    organization: 'Organización',
    menugroup: 'Categorías de menú',
    menumodule: 'Módulos del sistema',
};

const fallbackModelLabel = (modelName: string): string => {
    const key = modelName.toLowerCase();
    const mapped = MODEL_LABEL_FALLBACKS[key];
    if (mapped) return mapped;

    const normalized = modelName.replace(/_/g, ' ').trim();
    if (!normalized) return 'Módulo';

    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const auditService = {
    /**
     * Lista de logs con filtros opcionales.
     * Retorna PaginatedResponse<AuditLog> — leer .results y .count en el hook.
     */
    getAll: async (params: Partial<AuditFilters> = {}): Promise<PaginatedResponse<AuditLog>> => {
        // CORRECCIÓN: filtrar undefined/null/'' igual que en userService
        // para evitar ?user_id=null o ?model_name= en la URL
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
        );
        const response = await api.get<PaginatedResponse<AuditLog>>(ENDPOINTS.AUDIT.LOGS, {
            params: cleanParams,
        });
        return response.data;
    },

    getById: async (id: string | number): Promise<AuditLog> => {
        const response = await api.get<AuditLog>(ENDPOINTS.AUDIT.DETAIL(id));
        return response.data;
    },

    getModels: async (): Promise<AuditModelOption[]> => {
        const response = await api.get<Array<string | Partial<AuditModelOption>>>(ENDPOINTS.AUDIT.MODELS);
        const rawItems = Array.isArray(response.data) ? response.data : [];

        const parsed = rawItems
            .map((item) => {
                if (typeof item === 'string') {
                    const value = item.trim();
                    if (!value) return null;
                    return {
                        value,
                        label: fallbackModelLabel(value),
                    };
                }

                if (!item || typeof item !== 'object') return null;

                const value = typeof item.value === 'string' ? item.value.trim() : '';
                if (!value) return null;

                const label = typeof item.label === 'string' ? item.label.trim() : '';
                return {
                    value,
                    label: label || fallbackModelLabel(value),
                };
            })
            .filter((item): item is AuditModelOption => item !== null);

        parsed.sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
        return parsed;
    },
};

export default auditService;