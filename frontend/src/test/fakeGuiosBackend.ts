/**
 * Backend simulado de la API pública para las pruebas del frontend. Construye la
 * evaluación con el catálogo real (docs/catalogo_guios.json) y reproduce las
 * reglas del motor (IR, PM, FODA, pendientes y dictamen) de forma simplificada;
 * la implementación de referencia y sus pruebas están en el backend.
 */
import { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';
import catalog from '../../../docs/catalogo_guios.json';
import type {
    CreatedEvaluation,
    EvaluationState,
    Foda,
    Importance,
    MissingItem,
    Rating,
    Scope,
    Summary,
    VerdictResult,
} from '../api/guiosPublicService';

const MATRIX: Record<number, number[]> = { 1: [1, 1, 2, 2], 2: [1, 2, 2, 3], 3: [2, 2, 3, 3], 4: [2, 3, 3, 4] };
const SCOPE: Record<string, Scope | ''> = { interno: 'internal', externo: 'external', ambos: '' };
const LABELS = ['', 'Irrelevante', 'Opcional', 'Importante', 'Fundamental'];

export interface FakeCall { method: string; args: unknown[] }

const httpError = (status: number, data: Record<string, unknown> = {}) =>
    new AxiosError(String(status), 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as AxiosResponse);

export const createFakeBackend = () => {
    const calls: FakeCall[] = [];
    const evaluations = new Map<string, EvaluationState>();
    let counter = 0;

    const build = (uuid: string): EvaluationState => {
        let factorId = 0;
        let subfactorId = 0;
        return {
            uuid,
            software_name: 'LibreOffice', software_version: '24.2', software_repo_url: null,
            org_name: 'UNEMI', org_sector: '', org_description: '',
            status: 'in_progress', started_at: '2026-10-22T10:00:00Z', completed_at: null, verdict: null,
            factors: catalog.dimensiones.flatMap((dimension) => dimension.factores.map((factor) => ({
                factor_id: ++factorId,
                code: factor.codigo,
                dimension: dimension.nombre,
                name: factor.nombre,
                description: factor.descripcion,
                suggested_importance: factor.is as Importance,
                decisor_importance: null,
                relative_importance: null,
                is_relevant: null,
                scope_used: SCOPE[factor.ambito],
                scope_configurable: factor.ambito_configurable,
                subfactors: factor.subfactores.map((sub) => ({
                    subfactor_id: ++subfactorId, code: sub.codigo, description: sub.texto_mostrar, rating: null,
                })),
            }))),
        };
    };

    const summarize = (evaluation: EvaluationState): Summary => {
        const missing: MissingItem[] = [];
        const factors = evaluation.factors.map((factor) => {
            const base = { factor_id: factor.factor_id, factor_name: factor.name };
            const id = factor.decisor_importance;
            const ir = id === null ? null : (MATRIX[id][factor.suggested_importance - 1] as Importance);
            const relevant = ir === null ? null : ir > 1;
            let pm: number | null = null;
            let foda: Foda | null = null;
            if (id === null) missing.push({ ...base, kind: 'decisor_importance', subfactor_id: null });
            if (relevant) {
                if (!factor.scope_used) missing.push({ ...base, kind: 'scope', subfactor_id: null });
                factor.subfactors.filter((s) => s.rating === null)
                    .forEach((s) => missing.push({ ...base, kind: 'subfactor_rating', subfactor_id: s.subfactor_id }));
                if (factor.subfactors.every((s) => s.rating !== null)) {
                    pm = factor.subfactors.reduce((t, s) => t + (s.rating ?? 0), 0) / factor.subfactors.length;
                    if (factor.scope_used) {
                        const meets = pm >= 3;
                        foda = factor.scope_used === 'internal' ? (meets ? 'strength' : 'weakness') : (meets ? 'opportunity' : 'threat');
                    }
                }
            }
            return {
                factor_id: factor.factor_id, code: factor.code, name: factor.name,
                suggested_importance: factor.suggested_importance, decisor_importance: id,
                relative_importance: ir, relative_importance_label: ir ? LABELS[ir] : null, is_relevant: relevant,
                scope_used: factor.scope_used || null, scope_configurable: factor.scope_configurable,
                weighted_average: pm === null ? null : (Math.round(pm * 100) / 100).toFixed(2),
                meets_threshold: pm === null ? null : pm >= 3, foda,
                subfactors_total: factor.subfactors.length,
                subfactors_rated: factor.subfactors.filter((s) => s.rating !== null).length,
                failing_subfactors: factor.subfactors.filter((s) => s.rating !== null && s.rating < 3)
                    .map((s) => ({ subfactor_id: s.subfactor_id, description: s.description, rating: s.rating as 1 | 2 })),
            };
        });
        return { status: evaluation.status, is_complete: missing.length === 0, factors, missing };
    };

    const get = (uuid: string, token: string) => {
        const evaluation = evaluations.get(uuid);
        if (!evaluation || token !== `token-${uuid}`) {
            throw httpError(404);
        }
        return evaluation;
    };

    const ensureOpen = (evaluation: EvaluationState) => {
        if (evaluation.status === 'completed') {
            throw httpError(409, { code: 'evaluation_locked' });
        }
    };

    const service = {
        createEvaluation: async (): Promise<CreatedEvaluation> => {
            const uuid = `eval-${++counter}`;
            const evaluation = build(uuid);
            evaluations.set(uuid, evaluation);
            return { ...structuredClone(evaluation), session_token: `token-${uuid}` };
        },
        getEvaluation: async (uuid: string, token: string) => structuredClone(get(uuid, token)),
        getSummary: async (uuid: string, token: string) => summarize(get(uuid, token)),
        setDecisorImportance: async (uuid: string, token: string, factorId: number, value: Importance | null) => {
            calls.push({ method: 'setDecisorImportance', args: [factorId, value] });
            const evaluation = get(uuid, token);
            ensureOpen(evaluation);
            const factor = evaluation.factors.find((f) => f.factor_id === factorId)!;
            factor.decisor_importance = value;
            return summarize(evaluation);
        },
        setScope: async (uuid: string, token: string, factorId: number, value: Scope | null) => {
            calls.push({ method: 'setScope', args: [factorId, value] });
            const evaluation = get(uuid, token);
            ensureOpen(evaluation);
            evaluation.factors.find((f) => f.factor_id === factorId)!.scope_used = value ?? '';
            return summarize(evaluation);
        },
        setRating: async (uuid: string, token: string, subfactorId: number, value: Rating | null) => {
            calls.push({ method: 'setRating', args: [subfactorId, value] });
            const evaluation = get(uuid, token);
            ensureOpen(evaluation);
            evaluation.factors.flatMap((f) => f.subfactors).find((s) => s.subfactor_id === subfactorId)!.rating = value;
            return summarize(evaluation);
        },
        generateVerdict: async (uuid: string, token: string): Promise<VerdictResult> => {
            calls.push({ method: 'generateVerdict', args: [] });
            const evaluation = get(uuid, token);
            ensureOpen(evaluation);
            const summary = summarize(evaluation);
            if (!summary.is_complete) {
                throw httpError(400, { code: 'evaluation_incomplete', missing: summary.missing });
            }
            const negatives = summary.factors.filter((f) => f.is_relevant && (f.foda === 'weakness' || f.foda === 'threat'));
            const critical = negatives.filter((f) => (f.relative_importance ?? 0) >= 3);
            const recommendation = critical.length ? 'C' : negatives.length ? 'B' : 'A';
            const causing = critical.length ? critical : negatives;
            evaluation.status = 'completed';
            evaluation.completed_at = '2026-10-22T11:00:00Z';
            evaluation.verdict = {
                recommendation,
                recommendation_label: `Recomendación ${recommendation}`,
                explanation_text: `Recomendación ${recommendation}.\n${causing.map((f) => `- ${f.name}: IR ${f.relative_importance_label}, PM ${f.weighted_average}.`).join('\n')}`,
                calculated_at: '2026-10-22T11:00:00Z',
            };
            return { verdict: evaluation.verdict, summary: summarize(evaluation) };
        },
        duplicateEvaluation: async (uuid: string, token: string): Promise<CreatedEvaluation> => {
            calls.push({ method: 'duplicateEvaluation', args: [uuid] });
            const original = get(uuid, token);
            const copyUuid = `eval-${++counter}`;
            const copy: EvaluationState = {
                ...structuredClone(original), uuid: copyUuid, status: 'in_progress', completed_at: null, verdict: null,
            };
            evaluations.set(copyUuid, copy);
            return { ...structuredClone(copy), session_token: `token-${copyUuid}` };
        },
        getOrganization: async () => ({ name: 'UNEMI', logo: null }),
    };

    return { service, calls, evaluations };
};
