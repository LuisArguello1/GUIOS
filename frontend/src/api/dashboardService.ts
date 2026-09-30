import api from './axios';
import { ENDPOINTS } from './endpoints';

export interface DashboardResponse {
    status: string;
    message: string;
    server_time: string;
    active_users_count: number;
}

const dashboardService = {
    /** Obtiene los datos del dashboard principal. */
    getData: async (): Promise<DashboardResponse> => {
        const { data } = await api.get<DashboardResponse>(ENDPOINTS.CORE.DASHBOARD);
        return data;
    },

    /** Inicia la exportación de métricas (stub limpio). */
    exportData: async (params?: Record<string, unknown>): Promise<{ status: string; detail: string }> => {
        const { data } = await api.post<{ status: string; detail: string }>(`${ENDPOINTS.CORE.DASHBOARD}export/`, params || {});
        return data;
    },

    /** Obtiene el estado de la tarea de exportación. */
    getExportStatus: async (): Promise<{ status: string }> => {
        const { data } = await api.get<{ status: string }>(`${ENDPOINTS.CORE.DASHBOARD}export/status/`);
        return data;
    },
};

export default dashboardService;
