/**
 * api/evaluationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa HTTP para la gestión de Evaluaciones de Software en GUIOS.
 * Se comunica exclusivamente con /api/v1/guios/evaluations/ vía ENDPOINTS.
 */

import api from './axios';
import { ENDPOINTS } from './endpoints';
import type { PaginatedResponse } from './dimensionService';

export type EvaluationStatus = 'in_progress' | 'completed';
export type AIStatus = 'pending' | 'searching' | 'completed' | 'failed';
export type RecommendationType = 'A' | 'B' | 'C';
export type FODAClassification = 'strength' | 'weakness' | 'opportunity' | 'threat';

export interface AISourceItem {
    title?: string;
    url?: string;
    doi?: string;
    snippet?: string;
    subfactor_id?: number;
}

export interface EvaluationItem {
    id: number;
    uuid: string;
    software_name: string;
    software_category: string;
    software_version: string;
    org_name: string;
    org_sector: string;
    status: EvaluationStatus;
    ai_enabled: boolean;
    ai_status: AIStatus;
    created_by_username: string | null;
    started_at: string;
    completed_at: string | null;
    recommendation: RecommendationType | null;
    recommendation_display?: string | null;
}

export interface EvaluationFactorItem {
    id: number;
    factor_id: number;
    factor_name: string;
    dimension_id: number;
    dimension_name: string;
    dimension_order: number;
    order: number;
    systemic_importance_snapshot: number;
    subfactors_count_snapshot: number;
    citations_count: number;
    citation_ratio: string | number;
    literature_importance_calculated: number;
    expert_importance_snapshot: number;
    decisor_importance: number | null;
    relative_importance: number | null;
    is_relevant: boolean | null;
    scope_used: 'internal' | 'external';
    ai_literature_sources: AISourceItem[];
    ai_suggested_id?: number | null;
    ai_id_justification?: string;
    id_was_ai_accepted?: boolean;
}

export interface EvaluationSubfactorItem {
    id: number;
    subfactor_id: number;
    factor_id: number;
    factor_name: string;
    order: number;
    description_snapshot: string;
    ai_citations_count: number;
    rating: number | null;
    ai_suggested_rating?: number | null;
    ai_rating_justification?: string;
    rating_was_ai_accepted?: boolean;
    saved_at: string;
}

export interface EvaluationResultItem {
    id: number;
    factor_id: number;
    factor_name: string;
    weighted_average: string | number;
    meets_threshold: boolean;
    foda_classification: FODAClassification;
    foda_display: string;
    calculated_at: string;
}

export interface EvaluationVerdictItem {
    id: number;
    recommendation: RecommendationType;
    recommendation_display: string;
    explanation_text: string;
    ai_executive_summary: string;
    ai_mitigation_plan: string;
    calculated_at: string;
}

export interface EvaluationDetail extends EvaluationItem {
    software_repo_url: string | null;
    software_description: string;
    org_description: string;
    q1_threshold: string | number | null;
    q2_threshold: string | number | null;
    q3_threshold: string | number | null;
    q4_threshold: string | number | null;
    factors: EvaluationFactorItem[];
    subfactors: EvaluationSubfactorItem[];
    results: EvaluationResultItem[];
    verdict: EvaluationVerdictItem | null;
    org_size?: string;
    it_staff?: string;
    replaced_software?: string;
    target_timeline?: string;
    current_platforms?: string;
    main_goal?: string;
    data_storage_consent?: boolean;
    ai_processing_consent?: boolean;
    consent_timestamp?: string | null;
    privacy_policy_version?: string;
}

export interface EvaluationCreateInput {
    software_name: string;
    org_name: string;
    software_category?: string;
    software_version?: string;
    software_repo_url?: string;
    software_description?: string;
    org_sector?: string;
    org_description?: string;
    org_size?: string;
    it_staff?: string;
    replaced_software?: string;
    target_timeline?: string;
    current_platforms?: string;
    main_goal?: string;
    ai_enabled?: boolean;
    auto_compute_literature?: boolean;
    data_storage_consent: boolean;
    ai_processing_consent?: boolean;
    privacy_policy_version?: string;
}

export interface EvaluationUpdateInput {
    software_name?: string;
    org_name?: string;
    software_category?: string;
    software_version?: string;
    software_repo_url?: string;
    software_description?: string;
    org_sector?: string;
    org_description?: string;
    org_size?: string;
    it_staff?: string;
    replaced_software?: string;
    target_timeline?: string;
    current_platforms?: string;
    main_goal?: string;
}

export interface DecisorItemInput {
    factor_id: number;
    decisor_importance: number;
    scope_used?: 'internal' | 'external';
}

export interface EvaluationQueryParams {
    page?: number;
    page_size?: number;
    status?: string;
    category?: string;
    search?: string;
}

const evaluationService = {
    /**
     * Obtiene el listado paginado de sesiones de evaluación.
     */
    async getEvaluations(params?: EvaluationQueryParams): Promise<PaginatedResponse<EvaluationItem> | EvaluationItem[]> {
        const cleanParams: Record<string, string | number> = {};
        if (params?.page) cleanParams.page = params.page;
        if (params?.page_size) cleanParams.page_size = params.page_size;
        if (params?.status) cleanParams.status = params.status;
        if (params?.category) cleanParams.category = params.category;
        if (params?.search?.trim()) cleanParams.search = params.search.trim();

        const response = await api.get(ENDPOINTS.GUIOS.EVALUATIONS, { params: cleanParams });
        return response.data;
    },

    /**
     * Obtiene el detalle integral de una evaluación con todas sus fases y satélites.
     */
    async getEvaluationDetail(id: number | string): Promise<EvaluationDetail> {
        const response = await api.get(ENDPOINTS.GUIOS.EVALUATION_DETAIL(id));
        return response.data;
    },

    /**
     * Inicia una nueva evaluación de software candidato.
     */
    async createEvaluation(data: EvaluationCreateInput): Promise<EvaluationDetail> {
        const response = await api.post(ENDPOINTS.GUIOS.EVALUATIONS, data);
        return response.data;
    },

    /**
     * Actualiza los metadatos descriptivos de la evaluación.
     */
    async updateEvaluation(id: number | string, data: EvaluationUpdateInput): Promise<EvaluationDetail> {
        const response = await api.patch(ENDPOINTS.GUIOS.EVALUATION_DETAIL(id), data);
        return response.data;
    },

    /**
     * Elimina una sesión de evaluación.
     */
    async deleteEvaluation(id: number | string): Promise<void> {
        await api.delete(ENDPOINTS.GUIOS.EVALUATION_DETAIL(id));
    },

    /**
     * Fase 3 / Paso 0: Ejecuta el cálculo de razones r_i, cuartiles e IS.
     */
    async calculateLiterature(
        id: number | string,
        data?: {
            ai_citations_by_subfactor?: Record<number, number>;
            ai_sources_by_factor?: Record<number, AISourceItem[]>;
        }
    ): Promise<EvaluationDetail> {
        const response = await api.post(ENDPOINTS.GUIOS.EVALUATION_CALCULATE_LITERATURE(id), data || {});
        return response.data;
    },

    /**
     * Fase 4 / Pasos 1 y 2: Registra la Importancia del Decisor (ID), calcula IR y filtra factores relevantes.
     */
    async applyDecisor(id: number | string, factors: DecisorItemInput[]): Promise<EvaluationDetail> {
        const response = await api.post(ENDPOINTS.GUIOS.EVALUATION_APPLY_DECISOR(id), { factors });
        return response.data;
    },

    /**
     * Fase 4 / Pasos 3 y 4: Registra calificaciones de subfactores y calcula la matriz FODA.
     */
    async rateSubfactors(id: number | string, ratings: Record<number | string, number>): Promise<EvaluationDetail> {
        const response = await api.post(ENDPOINTS.GUIOS.EVALUATION_RATE_SUBFACTORS(id), { ratings });
        return response.data;
    },

    /**
     * Fase 4 / Paso 6: Emite el dictamen institucional final (A, B o C) y finaliza la sesión.
     */
    async computeVerdict(
        id: number | string,
        data?: { ai_executive_summary?: string; ai_mitigation_plan?: string }
    ): Promise<EvaluationDetail> {
        const response = await api.post(ENDPOINTS.GUIOS.EVALUATION_COMPUTE_VERDICT(id), data || {});
        return response.data;
    },

    /**
     * Descarga el Dossier Técnico oficial de la evaluación en PDF.
     */
    async exportPdf(id: number | string): Promise<{ blob: Blob; contentDisposition?: string }> {
        const response = await api.get(ENDPOINTS.GUIOS.EVALUATION_EXPORT_PDF(id), {
            responseType: 'blob',
        });
        return {
            blob: response.data,
            contentDisposition: response.headers['content-disposition'],
        };
    },

    /**
     * Descarga el Dossier Técnico oficial de la evaluación en Excel (.xlsx).
     */
    async exportExcel(id: number | string): Promise<{ blob: Blob; contentDisposition?: string }> {
        const response = await api.get(ENDPOINTS.GUIOS.EVALUATION_EXPORT_EXCEL(id), {
            responseType: 'blob',
        });
        return {
            blob: response.data,
            contentDisposition: response.headers['content-disposition'],
        };
    },
};

export default evaluationService;

