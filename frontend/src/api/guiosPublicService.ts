import publicApi from './publicAxios';
import { ENDPOINTS } from './endpoints';

// ── Tipos (espejo de apps/guios/api/serializers) ─────────────────────────────

export type Importance = 1 | 2 | 3 | 4;
export type Rating = 1 | 2 | 3 | 4;
export type Scope = 'internal' | 'external';
export type Foda = 'strength' | 'weakness' | 'opportunity' | 'threat';
export type Recommendation = 'A' | 'B' | 'C';
export type EvaluationStatus = 'in_progress' | 'completed';

export interface RegistrationPayload {
    software_name: string;
    org_name: string;
    software_version?: string;
    software_repo_url?: string | null;
    org_sector?: string;
    org_description?: string;
    /** Activar asistencia IA (RF-IA-01): requiere descripción o repositorio. */
    ai_enabled?: boolean;
}

export interface EvaluationSubfactorState {
    subfactor_id: number;
    code: string | null;
    description: string;
    rating: Rating | null;
    ai_suggested_rating: Rating | null;
    ai_rating_justification: string;
    rating_was_ai_accepted: boolean;
}

export interface EvaluationFactorState {
    factor_id: number;
    code: string | null;
    dimension: string;
    name: string;
    description: string;
    suggested_importance: Importance;
    decisor_importance: Importance | null;
    relative_importance: Importance | null;
    is_relevant: boolean | null;
    scope_used: Scope | '';
    scope_configurable: boolean;
    ai_suggested_id: Importance | null;
    ai_id_justification: string;
    id_was_ai_accepted: boolean;
    subfactors: EvaluationSubfactorState[];
}

export interface Verdict {
    recommendation: Recommendation;
    recommendation_label: string;
    explanation_text: string;
    /** Complemento de la IA, separado del dictamen ('' si no se generó). */
    ai_executive_summary: string;
    /** Solo en B o C, si se generó con la IA. */
    ai_mitigation_plan: string;
    calculated_at: string;
}

export interface EvaluationState {
    uuid: string;
    software_name: string;
    software_version: string;
    software_repo_url: string | null;
    org_name: string;
    org_sector: string;
    org_description: string;
    ai_enabled: boolean;
    status: EvaluationStatus;
    started_at: string;
    completed_at: string | null;
    factors: EvaluationFactorState[];
    verdict: Verdict | null;
}

export interface CreatedEvaluation extends EvaluationState {
    session_token: string;
}

export interface FailingSubfactor {
    subfactor_id: number;
    description: string;
    rating: 1 | 2;
}

export interface FactorSummary {
    factor_id: number;
    code: string | null;
    name: string;
    suggested_importance: Importance;
    decisor_importance: Importance | null;
    relative_importance: Importance | null;
    relative_importance_label: string | null;
    is_relevant: boolean | null;
    scope_used: Scope | null;
    scope_configurable: boolean;
    weighted_average: string | null;
    meets_threshold: boolean | null;
    foda: Foda | null;
    subfactors_total: number;
    subfactors_rated: number;
    failing_subfactors: FailingSubfactor[];
}

export type MissingKind = 'decisor_importance' | 'scope' | 'subfactor_rating';

export interface MissingItem {
    kind: MissingKind;
    factor_id: number;
    factor_name: string;
    subfactor_id: number | null;
}

export interface Summary {
    status: EvaluationStatus;
    is_complete: boolean;
    factors: FactorSummary[];
    missing: MissingItem[];
}

export interface VerdictResult {
    verdict: Verdict;
    summary: Summary;
}

export interface PublicOrganization {
    name?: string;
    logo?: string | null;
}

export interface AiStatus {
    available: boolean;
}

export interface AiImportanceSuggestions {
    suggestions: { factor_id: number; suggested_value: Importance; justification: string }[];
}

export interface AiRatingSuggestions {
    factor_id: number;
    suggestions: { subfactor_id: number; suggested_value: Rating; justification: string }[];
}

export interface AiReport {
    executive_summary: string;
    mitigation_plan: string;
}

const tokenHeader = (token: string) => ({ headers: { 'X-Evaluation-Token': token } });

/** La IA puede tardar hasta GUIOS_AI_TIMEOUT (30 s) en el servidor: margen propio. */
const AI_TIMEOUT_MS = 60000;
const aiConfig = (token: string) => ({ ...tokenHeader(token), timeout: AI_TIMEOUT_MS });

// ── Llamadas ─────────────────────────────────────────────────────────────────

const guiosPublicService = {
    /** Registra una evaluación. El session_token solo llega en esta respuesta. */
    createEvaluation: async (payload: RegistrationPayload): Promise<CreatedEvaluation> => {
        const { data } = await publicApi.post<CreatedEvaluation>(ENDPOINTS.GUIOS_PUBLIC.EVALUATIONS, payload);
        return data;
    },

    getEvaluation: async (uuid: string, token: string): Promise<EvaluationState> => {
        const { data } = await publicApi.get<EvaluationState>(ENDPOINTS.GUIOS_PUBLIC.EVALUATION(uuid), tokenHeader(token));
        return data;
    },

    getSummary: async (uuid: string, token: string): Promise<Summary> => {
        const { data } = await publicApi.get<Summary>(ENDPOINTS.GUIOS_PUBLIC.SUMMARY(uuid), tokenHeader(token));
        return data;
    },

    /** Guarda la ID (null = sin calificar). Devuelve el resumen actualizado. */
    setDecisorImportance: async (uuid: string, token: string, factorId: number, value: Importance | null): Promise<Summary> => {
        const { data } = await publicApi.patch<Summary>(
            ENDPOINTS.GUIOS_PUBLIC.FACTOR(uuid, factorId), { decisor_importance: value }, tokenHeader(token),
        );
        return data;
    },

    /** Guarda el ámbito de Soporte (null = sin elegir). */
    setScope: async (uuid: string, token: string, factorId: number, value: Scope | null): Promise<Summary> => {
        const { data } = await publicApi.patch<Summary>(
            ENDPOINTS.GUIOS_PUBLIC.FACTOR(uuid, factorId), { scope_used: value }, tokenHeader(token),
        );
        return data;
    },

    /** Guarda la calificación de un subfactor (null = sin calificar). */
    setRating: async (uuid: string, token: string, subfactorId: number, value: Rating | null): Promise<Summary> => {
        const { data } = await publicApi.patch<Summary>(
            ENDPOINTS.GUIOS_PUBLIC.SUBFACTOR(uuid, subfactorId), { rating: value }, tokenHeader(token),
        );
        return data;
    },

    generateVerdict: async (uuid: string, token: string): Promise<VerdictResult> => {
        const { data } = await publicApi.post<VerdictResult>(ENDPOINTS.GUIOS_PUBLIC.VERDICT(uuid), null, tokenHeader(token));
        return data;
    },

    duplicateEvaluation: async (uuid: string, token: string): Promise<CreatedEvaluation> => {
        const { data } = await publicApi.post<CreatedEvaluation>(ENDPOINTS.GUIOS_PUBLIC.DUPLICATE(uuid), null, tokenHeader(token));
        return data;
    },

    /** ¿El servidor tiene IA configurada? Sin clave, ningún control de IA aparece. */
    getAiStatus: async (): Promise<AiStatus> => {
        const { data } = await publicApi.get<AiStatus>(ENDPOINTS.GUIOS_PUBLIC.AI_STATUS);
        return data;
    },

    /** Sugerencias de ID (Paso 1-2). No cambian la ID: solo los campos ai_*. */
    suggestImportance: async (uuid: string, token: string): Promise<AiImportanceSuggestions> => {
        const { data } = await publicApi.post<AiImportanceSuggestions>(ENDPOINTS.GUIOS_PUBLIC.AI_IMPORTANCE(uuid), null, aiConfig(token));
        return data;
    },

    /** Sugerencias de calificación de un factor relevante (Paso 3-4). */
    suggestRatings: async (uuid: string, token: string, factorId: number): Promise<AiRatingSuggestions> => {
        const { data } = await publicApi.post<AiRatingSuggestions>(
            ENDPOINTS.GUIOS_PUBLIC.AI_RATINGS(uuid, factorId), null, aiConfig(token),
        );
        return data;
    },

    /** Resumen ejecutivo y plan de mitigación (B o C), después del dictamen. */
    generateAiReport: async (uuid: string, token: string): Promise<AiReport> => {
        const { data } = await publicApi.post<AiReport>(ENDPOINTS.GUIOS_PUBLIC.AI_REPORT(uuid), null, aiConfig(token));
        return data;
    },

    /** Nombre y logo de la organización para la cabecera pública (sin cookies del panel). */
    getOrganization: async (): Promise<PublicOrganization> => {
        const { data } = await publicApi.get<PublicOrganization>(ENDPOINTS.CORE.ORGANIZATION);
        return data;
    },
};

export default guiosPublicService;
