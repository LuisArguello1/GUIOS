/**
 * frontend/src/api/dashboardService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de servicio para las métricas del Dashboard Ejecutivo de GUIOS
 * y la exportación de reportes consolidados en PDF y Excel.
 */

import api from './axios';
import { ENDPOINTS } from './endpoints';

export interface DashboardKpis {
    total_evaluations: number;
    completed_evaluations: number;
    in_progress_evaluations: number;
    adoption_viability_rate: number;
    total_with_verdict: number;
    foda_strengths: number;
    foda_weaknesses: number;
    foda_ratio: number;
    ai_total_calls: number;
    ai_avg_latency_ms: number;
    ai_success_rate: number;
}

export interface VerdictDistributionItem {
    recommendation: 'A' | 'B' | 'C';
    label: string;
    count: number;
}

export interface DimensionAverageItem {
    dimension_id: number;
    name: string;
    avg_score: number;
    sample_count: number;
}

export interface FodaDistributionItem {
    type: 'fortaleza' | 'oportunidad' | 'debilidad' | 'amenaza';
    label: string;
    count: number;
}

export interface CategoryDistributionItem {
    category: string;
    count: number;
}

export interface TopSoftwareItem {
    id: number;
    software_name: string;
    software_version: string;
    software_category: string;
    org_name: string;
    recommendation: 'A' | 'B' | 'C' | null;
    completed_at: string | null;
}

export interface RecentEvaluationItem {
    id: number;
    software_name: string;
    software_version: string;
    software_category: string;
    org_name: string;
    status: string;
    status_display: string;
    recommendation: 'A' | 'B' | 'C' | null;
    started_at: string | null;
}

export interface DashboardStatisticsResponse {
    kpis: DashboardKpis;
    verdict_distribution: VerdictDistributionItem[];
    dimension_averages: DimensionAverageItem[];
    foda_distribution: FodaDistributionItem[];
    categories_distribution: CategoryDistributionItem[];
    top_software: TopSoftwareItem[];
    recent_evaluations: RecentEvaluationItem[];
}

const dashboardService = {
    /**
     * Obtiene la matriz analítica consolidada de KPIs, distribuciones y rankings.
     */
    getStatistics: async (): Promise<DashboardStatisticsResponse> => {
        const { data } = await api.get<DashboardStatisticsResponse>(ENDPOINTS.GUIOS.DASHBOARD_STATS);
        return data;
    },

    /**
     * Descarga el Reporte Ejecutivo del Dashboard en formato PDF.
     */
    exportPdf: async (): Promise<{ blob: Blob; contentDisposition?: string }> => {
        const response = await api.get(ENDPOINTS.GUIOS.DASHBOARD_EXPORT_PDF, {
            responseType: 'blob',
        });
        return {
            blob: response.data,
            contentDisposition: response.headers['content-disposition'],
        };
    },

    /**
     * Descarga el Libro Analítico del Dashboard en formato Excel (.xlsx).
     */
    exportExcel: async (): Promise<{ blob: Blob; contentDisposition?: string }> => {
        const response = await api.get(ENDPOINTS.GUIOS.DASHBOARD_EXPORT_EXCEL, {
            responseType: 'blob',
        });
        return {
            blob: response.data,
            contentDisposition: response.headers['content-disposition'],
        };
    },
};

export default dashboardService;
