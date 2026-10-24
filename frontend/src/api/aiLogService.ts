/**
 * frontend/src/api/aiLogService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de API tipada para la consulta y auditoría de logs de Inteligencia Artificial (GUIOS).
 */
import api from './axios';
import ENDPOINTS from './endpoints';

export type AIRequestType =
    | 'literature_search'
    | 'factor_importance'
    | 'subfactor_rating'
    | 'executive_summary';

export type AILogStatus = 'success' | 'error' | 'timeout';

export interface AILogItem {
    id: number;
    evaluation_id: number;
    software_name: string;
    org_name: string;
    request_type: AIRequestType | string;
    request_type_display: string;
    factor_id: number | null;
    factor_name: string | null;
    status: AILogStatus | string;
    status_display: string;
    error_message: string;
    response_time_ms: number | null;
    requested_at: string;
}

export interface AILogDetail extends AILogItem {
    request_payload: Record<string, unknown>;
    response_payload: Record<string, unknown> | null;
}

export interface AILogFilters {
    evaluation_id?: number | string;
    request_type?: string;
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
}

export interface AILogsResponse {
    count: number;
    results: AILogItem[];
}

/**
 * Obtiene la lista paginada y filtrada de logs de IA del sistema.
 */
export const getAILogs = async (filters: AILogFilters = {}): Promise<AILogsResponse> => {
    const params = new URLSearchParams();
    if (filters.evaluation_id) params.append('evaluation_id', String(filters.evaluation_id));
    if (filters.request_type) params.append('request_type', filters.request_type);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.page_size) params.append('page_size', String(filters.page_size));

    const response = await api.get<AILogsResponse | AILogItem[]>(
        `${ENDPOINTS.GUIOS.AI_LOGS}?${params.toString()}`
    );

    if (Array.isArray(response.data)) {
        return { count: response.data.length, results: response.data };
    }
    return response.data;
};

/**
 * Obtiene el detalle técnico completo de un log de IA (con payload y response).
 */
export const getAILogDetail = async (id: number | string): Promise<AILogDetail> => {
    const response = await api.get<AILogDetail>(ENDPOINTS.GUIOS.AI_LOG_DETAIL(id));
    return response.data;
};

/**
 * Obtiene todos los logs de IA asociados a una evaluación específica.
 */
export const getEvaluationAILogs = async (evaluationId: number | string): Promise<AILogItem[]> => {
    const response = await api.get<AILogItem[]>(
        ENDPOINTS.GUIOS.EVALUATION_AI_LOGS(evaluationId)
    );
    return Array.isArray(response.data) ? response.data : [];
};
