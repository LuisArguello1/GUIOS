/** Datos y utilidades de las pruebas del panel administrativo de GUIOS. */
import { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import useAuthStore from '../app/useAuthStore';
import type { AdminDimension, EvaluationDetail, GuiosMetrics } from '../api/guiosAdminService';

/** Inicia sesión en el store con los permisos indicados (sin superusuario). */
export const loginWith = (permissions: string[]) => {
    useAuthStore.setState({
        isAuthenticated: true,
        user: {
            id: 1, email: 'admin@unemi.edu.ec', username: 'admin', first_name: 'Ana', last_name: 'Pérez',
            is_staff: true, is_superuser: false, permissions,
        },
    });
};

export const httpError = (status: number, data: Record<string, unknown>) =>
    new AxiosError(String(status), 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as AxiosResponse);

export const catalogTree = (): AdminDimension[] => [
    {
        id: 1, code: 'TEC', name: 'Tecnológica', description: '', order: 1, is_base: true, factors_count: 2, can_delete: false,
        factors: [
            {
                id: 10, code: 'TEC-USA', name: 'Usabilidad', description: 'Facilidad de uso', suggested_importance: 2,
                scope: 'external', scope_configurable: false, order: 1, is_base: true, is_active: true,
                subfactors_count: 1, active_subfactors_count: 1, evaluations_count: 3, can_delete: false,
                subfactors: [{
                    id: 100, code: 'TEC-USA-01', description: 'El software es fácil de usar', order: 1,
                    is_base: true, is_active: true, evaluations_count: 3, can_delete: false,
                }],
            },
            {
                id: 11, code: null, name: 'Accesibilidad', description: '', suggested_importance: 3,
                scope: 'both', scope_configurable: true, order: 2, is_base: false, is_active: false,
                subfactors_count: 0, active_subfactors_count: 0, evaluations_count: 0, can_delete: true, subfactors: [],
            },
        ],
    },
    {
        id: 2, code: null, name: 'Legal', description: '', order: 4, is_base: false, factors_count: 0, can_delete: true, factors: [],
    },
];

const NO_AI = { ai_suggested_rating: null, ai_rating_justification: '', rating_was_ai_accepted: false };

export const closedDetail = (): EvaluationDetail => ({
    evaluation: {
        uuid: '11111111-2222-4333-8444-555555555555', software_name: 'LibreOffice', software_version: '24.2',
        org_name: 'UNEMI', org_sector: 'Educación superior', status: 'completed', recommendation: 'C', ai_enabled: false,
        started_at: '2026-10-20T10:00:00Z', completed_at: '2026-10-20T11:00:00Z',
        software_repo_url: null, org_description: 'Universidad pública',
    },
    results_source: 'stored',
    factors: [
        {
            factor_id: 1, code: 'ORG-FOR', dimension: 'Organizacional', name: 'Formación', suggested_importance: 3,
            decisor_importance: 3, relative_importance: 3, is_relevant: true, scope_used: 'internal', scope_configurable: false,
            ai_suggested_id: null, ai_id_justification: '', id_was_ai_accepted: false,
            weighted_average: '2.75', meets_threshold: false, foda: 'weakness',
            failing_subfactors: [{ subfactor_id: 7, description: 'Hay planes de formación', rating: 2 }],
            subfactors: [
                { subfactor_id: 5, code: 'ORG-FOR-01', description: 'Hay cursos disponibles', rating: 3, ...NO_AI },
                { subfactor_id: 7, code: 'ORG-FOR-04', description: 'Hay planes de formación', rating: 2, ...NO_AI },
            ],
        },
        {
            factor_id: 2, code: 'TEC-COM', dimension: 'Tecnológica', name: 'Compatibilidad', suggested_importance: 3,
            decisor_importance: 4, relative_importance: 3, is_relevant: true, scope_used: 'external', scope_configurable: false,
            ai_suggested_id: null, ai_id_justification: '', id_was_ai_accepted: false,
            weighted_average: '3.75', meets_threshold: true, foda: 'opportunity', failing_subfactors: [],
            subfactors: [{ subfactor_id: 9, code: 'TEC-COM-01', description: 'Exporta formatos estándar', rating: 4, ...NO_AI }],
        },
        {
            factor_id: 3, code: 'TEC-REU', dimension: 'Tecnológica', name: 'Reusabilidad', suggested_importance: 2,
            decisor_importance: 1, relative_importance: 1, is_relevant: false, scope_used: 'external', scope_configurable: false,
            ai_suggested_id: null, ai_id_justification: '', id_was_ai_accepted: false,
            weighted_average: null, meets_threshold: null, foda: null, failing_subfactors: [],
            subfactors: [{ subfactor_id: 11, code: 'TEC-REU-01', description: 'Se reutiliza', rating: null, ...NO_AI }],
        },
    ],
    missing: [],
    verdict: {
        recommendation: 'C', recommendation_label: 'Recomendación C (Analizar y posponer la adopción)',
        explanation_text: 'Factores que causan el dictamen:\n- Formación: IR Importante, PM 2.75, Debilidad.',
        ai_executive_summary: '', ai_mitigation_plan: '', calculated_at: '2026-10-20T11:00:00Z',
    },
});

export const metrics = (): GuiosMetrics => ({
    total: 5, in_progress: 2, completed: 3, verdicts: { A: 1, B: 0, C: 2 },
    recent: [
        { uuid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', software_name: 'LibreOffice', org_name: 'UNEMI', status: 'completed', recommendation: 'C', started_at: '2026-10-20T10:00:00Z', completed_at: '2026-10-20T11:00:00Z' },
        { uuid: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee', software_name: 'Moodle', org_name: 'UNEMI', status: 'in_progress', recommendation: null, started_at: '2026-10-21T10:00:00Z', completed_at: null },
    ],
});
