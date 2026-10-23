import { AxiosError } from 'axios';
import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { PaginatedResponse } from './userService';
import type { EvaluationStatus, Foda, Importance, Rating, Recommendation } from './guiosPublicService';

// ── Catálogo (espejo de admin_catalog_serializers) ───────────────────────────

export type AdminScope = 'internal' | 'external' | 'both';

export interface AdminSubfactor {
    id: number;
    code: string | null;
    factor?: number;
    description: string;
    order: number;
    is_base: boolean;
    is_active: boolean;
    evaluations_count: number;
    can_delete: boolean;
}

export interface AdminFactor {
    id: number;
    code: string | null;
    dimension?: number;
    name: string;
    description: string;
    suggested_importance: Importance;
    scope: AdminScope;
    scope_configurable: boolean;
    order: number;
    is_base: boolean;
    is_active: boolean;
    subfactors_count: number;
    active_subfactors_count: number;
    evaluations_count: number;
    can_delete: boolean;
    subfactors?: AdminSubfactor[];
}

export interface AdminDimension {
    id: number;
    code: string | null;
    name: string;
    description: string;
    order: number;
    is_base: boolean;
    factors_count: number;
    can_delete: boolean;
    factors?: AdminFactor[];
}

export interface DimensionPayload { name: string; description?: string; order?: number }
export interface FactorPayload {
    dimension: number; name: string; description?: string; suggested_importance: Importance;
    scope: AdminScope; order?: number; is_active?: boolean;
}
export interface SubfactorPayload { factor: number; description: string; order?: number; is_active?: boolean }

// ── Evaluaciones (espejo de admin_evaluation_serializers) ────────────────────

export interface HistoryFilters {
    software?: string;
    organization?: string;
    recommendation?: Recommendation | '';
    status?: EvaluationStatus | '';
    date_from?: string;
    date_to?: string;
}

export interface EvaluationListItem {
    uuid: string;
    software_name: string;
    software_version: string;
    org_name: string;
    org_sector: string;
    status: EvaluationStatus;
    recommendation: Recommendation | null;
    ai_enabled: boolean;
    started_at: string;
    completed_at: string | null;
}

export interface AdminFactorDetail {
    factor_id: number;
    code: string | null;
    dimension: string;
    name: string;
    suggested_importance: Importance;
    decisor_importance: Importance | null;
    relative_importance: Importance | null;
    is_relevant: boolean | null;
    scope_used: 'internal' | 'external' | null;
    scope_configurable: boolean;
    weighted_average: string | null;
    meets_threshold: boolean | null;
    foda: Foda | null;
    failing_subfactors: { subfactor_id: number; description: string; rating: 1 | 2 }[];
    subfactors: { subfactor_id: number; code: string | null; description: string; rating: Rating | null }[];
}

export interface AdminVerdict {
    recommendation: Recommendation;
    recommendation_label: string;
    explanation_text: string;
    ai_executive_summary: string;
    ai_mitigation_plan: string;
    calculated_at: string;
}

export interface EvaluationDetail {
    evaluation: EvaluationListItem & { software_repo_url: string | null; org_description: string };
    results_source: 'stored' | 'calculated';
    factors: AdminFactorDetail[];
    missing: { kind: string; factor_id: number; factor_name: string; subfactor_id: number | null }[];
    verdict: AdminVerdict | null;
}

export interface GuiosMetrics {
    total: number;
    in_progress: number;
    completed: number;
    verdicts: Record<Recommendation, number>;
    recent: Pick<EvaluationListItem, 'uuid' | 'software_name' | 'org_name' | 'status' | 'recommendation' | 'started_at' | 'completed_at'>[];
}

export interface DownloadedFile { blob: Blob; disposition?: string }

/** Mensaje del backend (detail, o el primer error de campo) para mostrar al usuario. */
export const getAdminErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof AxiosError) || !error.response) return fallback;
    const data = error.response.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') return fallback;
    if (typeof data.detail === 'string' && data.detail.trim()) return data.detail;
    for (const value of Object.values(data)) {
        if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
        if (typeof value === 'string' && value.trim()) return value;
    }
    return fallback;
};

const clean = (params: object) =>
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const guiosAdminService = {
    getCatalogTree: async (): Promise<AdminDimension[]> =>
        (await api.get<AdminDimension[]>(ENDPOINTS.GUIOS_ADMIN.CATALOG_TREE)).data,

    createDimension: async (payload: DimensionPayload) =>
        (await api.post<AdminDimension>(ENDPOINTS.GUIOS_ADMIN.DIMENSIONS, payload)).data,
    updateDimension: async (id: number, payload: Partial<DimensionPayload>) =>
        (await api.patch<AdminDimension>(ENDPOINTS.GUIOS_ADMIN.DIMENSION(id), payload)).data,
    deleteDimension: async (id: number) => { await api.delete(ENDPOINTS.GUIOS_ADMIN.DIMENSION(id)); },

    createFactor: async (payload: FactorPayload) =>
        (await api.post<AdminFactor>(ENDPOINTS.GUIOS_ADMIN.FACTORS, payload)).data,
    updateFactor: async (id: number, payload: Partial<FactorPayload>) =>
        (await api.patch<AdminFactor>(ENDPOINTS.GUIOS_ADMIN.FACTOR(id), payload)).data,
    deleteFactor: async (id: number) => { await api.delete(ENDPOINTS.GUIOS_ADMIN.FACTOR(id)); },

    createSubfactor: async (payload: SubfactorPayload) =>
        (await api.post<AdminSubfactor>(ENDPOINTS.GUIOS_ADMIN.SUBFACTORS, payload)).data,
    updateSubfactor: async (id: number, payload: Partial<SubfactorPayload>) =>
        (await api.patch<AdminSubfactor>(ENDPOINTS.GUIOS_ADMIN.SUBFACTOR(id), payload)).data,
    deleteSubfactor: async (id: number) => { await api.delete(ENDPOINTS.GUIOS_ADMIN.SUBFACTOR(id)); },

    getEvaluations: async (filters: HistoryFilters, page: number, pageSize: number) =>
        (await api.get<PaginatedResponse<EvaluationListItem>>(ENDPOINTS.GUIOS_ADMIN.EVALUATIONS, {
            params: clean({ ...filters, page, page_size: pageSize }),
        })).data,

    getEvaluation: async (uuid: string): Promise<EvaluationDetail> =>
        (await api.get<EvaluationDetail>(ENDPOINTS.GUIOS_ADMIN.EVALUATION(uuid))).data,

    exportCsv: async (filters: HistoryFilters): Promise<DownloadedFile> => {
        const response = await api.get<Blob>(ENDPOINTS.GUIOS_ADMIN.EXPORT_CSV, {
            params: clean(filters), responseType: 'blob',
        });
        return { blob: response.data, disposition: response.headers['content-disposition'] };
    },

    exportPdf: async (uuid: string): Promise<DownloadedFile> => {
        const response = await api.get<Blob>(ENDPOINTS.GUIOS_ADMIN.EXPORT_PDF(uuid), { responseType: 'blob' });
        return { blob: response.data, disposition: response.headers['content-disposition'] };
    },

    getMetrics: async (): Promise<GuiosMetrics> =>
        (await api.get<GuiosMetrics>(ENDPOINTS.GUIOS_ADMIN.METRICS)).data,
};

export default guiosAdminService;
