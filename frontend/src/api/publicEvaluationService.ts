/**
 * api/publicEvaluationService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de servicio HTTP para la Evaluación Pública anónima de software en GUIOS PRO.
 * Consume los endpoints públicos bajo /api/v1/guios/public/evaluations/ mediante UUID.
 */

import api from './axios';
import { ENDPOINTS } from './endpoints';
import type {
    EvaluationDetail,
    EvaluationCreateInput,
    EvaluationUpdateInput,
    DecisorItemInput,
} from './evaluationService';

export interface PublicSubfactorCatalogItem {
    id: number;
    description: string;
    base_citations_count: number;
    keywords_ia: string;
    order: number;
}

export interface PublicFactorCatalogItem {
    id: number;
    name: string;
    scope: 'internal' | 'external' | 'both';
    scope_configurable: boolean;
    systemic_importance: number;
    expert_importance: number;
    literature_importance_base: number;
    order: number;
    subfactors: PublicSubfactorCatalogItem[];
}

export interface PublicCatalogDimension {
    id: number;
    name: string;
    description: string;
    order: number;
    factors_count: number;
    factors: PublicFactorCatalogItem[];
}

export interface AISuggestionResponse {
    suggested_id?: number;
    suggested_rating?: number;
    justification: string;
}

export interface FactorRatingsSuggestion {
    factor_id: number;
    ratings: Array<{
        subfactor_id: number;
        suggested_rating: number;
        justification: string;
    }>;
}

const publicEvaluationService = {
    /**
     * Obtiene el catálogo activo completo (Dimensiones -> Factores -> Subfactores)
     * para consulta pública y ayuda en el wizard.
     */
    async getCatalog(): Promise<PublicCatalogDimension[]> {
        const response = await api.get<PublicCatalogDimension[]>(ENDPOINTS.GUIOS.PUBLIC_CATALOG);
        return response.data;
    },

    /**
     * Inicia una nueva evaluación anónima (Paso 0 / Modal de Inicio).
     */
    async createEvaluation(data: EvaluationCreateInput, sessionToken?: string): Promise<EvaluationDetail> {
        const headers: Record<string, string> = {};
        if (sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }
        const response = await api.post<EvaluationDetail>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATIONS,
            data,
            { headers }
        );
        return response.data;
    },

    /**
     * Obtiene el detalle integral de una evaluación pública por su UUID.
     */
    async getEvaluation(uuid: string): Promise<EvaluationDetail> {
        const response = await api.get<EvaluationDetail>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_DETAIL(uuid)
        );
        return response.data;
    },

    /**
     * Actualiza metadatos descriptivos de la evaluación (software, organización).
     */
    async updateEvaluation(uuid: string, data: EvaluationUpdateInput): Promise<EvaluationDetail> {
        const response = await api.patch<EvaluationDetail>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_DETAIL(uuid),
            data
        );
        return response.data;
    },

    /**
     * Aplica la ponderación del decisor (ID: 1 a 4) y ámbitos seleccionados (Pasos 1 y 2).
     */
    async applyDecisor(uuid: string, factors: DecisorItemInput[]): Promise<EvaluationDetail> {
        const response = await api.post<EvaluationDetail>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_APPLY_DECISOR(uuid),
            { factors }
        );
        return response.data;
    },

    /**
     * Registra las calificaciones de subfactores y calcula PM y FODA (Pasos 3 y 4).
     */
    async rateSubfactors(uuid: string, ratings: Record<number | string, number>): Promise<EvaluationDetail> {
        const response = await api.post<EvaluationDetail>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_RATE_SUBFACTORS(uuid),
            { ratings }
        );
        return response.data;
    },

    /**
     * Emite el dictamen final institucional y genera el resumen con IA (Pasos 5 y 6).
     */
    async computeVerdict(
        uuid: string,
        data?: { ai_executive_summary?: string; ai_mitigation_plan?: string }
    ): Promise<EvaluationDetail> {
        const response = await api.post<EvaluationDetail>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_COMPUTE_VERDICT(uuid),
            data || {},
            { timeout: 180000 }
        );
        return response.data;
    },

    /**
     * Solicita a la IA una sugerencia orientativa de Importancia del Decisor (ID: 1 a 4).
     */
    async aiSuggestImportance(uuid: string, factorId: number): Promise<AISuggestionResponse> {
        const response = await api.post<AISuggestionResponse>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_AI_SUGGEST_IMPORTANCE(uuid),
            { factor_id: factorId },
            { timeout: 120000 }
        );
        return response.data;
    },

    async aiSuggestFactorRatings(uuid: string, factorId: number): Promise<FactorRatingsSuggestion> {
        const response = await api.post<FactorRatingsSuggestion>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_AI_SUGGEST_FACTOR_RATINGS(uuid),
            { factor_id: factorId },
            { timeout: 120000 }
        );
        return response.data;
    },

    /**
     * Solicita a la IA una sugerencia orientativa de calificación para un subfactor (1 a 4).
     */
    async aiSuggestRating(uuid: string, subfactorId: number): Promise<AISuggestionResponse> {
        const response = await api.post<AISuggestionResponse>(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_AI_SUGGEST_RATING(uuid),
            { subfactor_id: subfactorId }
        );
        return response.data;
    },

    /**
     * Descarga el Dossier Técnico oficial de la evaluación en PDF.
     */
    async exportPdf(uuid: string): Promise<{ blob: Blob; contentDisposition: string | null }> {
        const response = await api.get(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_EXPORT_PDF(uuid),
            { responseType: 'blob' }
        );
        return {
            blob: response.data,
            contentDisposition: response.headers['content-disposition'] || null,
        };
    },

    /**
     * Descarga el Dossier Metodológico en formato Excel (.xlsx).
     */
    async exportExcel(uuid: string): Promise<{ blob: Blob; contentDisposition: string | null }> {
        const response = await api.get(
            ENDPOINTS.GUIOS.PUBLIC_EVALUATION_EXPORT_EXCEL(uuid),
            { responseType: 'blob' }
        );
        return {
            blob: response.data,
            contentDisposition: response.headers['content-disposition'] || null,
        };
    },
};

export default publicEvaluationService;
