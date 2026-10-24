import { create } from 'zustand';
import guiosPublicService, {
    type EvaluationFactorState,
    type EvaluationState,
    type Importance,
    type MissingItem,
    type Rating,
    type Scope,
    type Summary,
} from '../api/guiosPublicService';
import { getErrorData, getErrorStatus } from '../api/publicAxios';
import { aiErrorMessage } from '../features/evaluation/aiErrors';
import { createKeyedQueue } from '../features/evaluation/autosave';
import useSavedEvaluationsStore from './useSavedEvaluationsStore';
import useToastStore from './useToastStore';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'no_access' | 'error';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type VerdictOutcome = 'ok' | 'incomplete' | 'locked' | 'error';
/** Operación de IA en curso: 'importance', 'report' o `ratings:<factorId>`. */
export type AiTask = string;

interface EvaluationStoreState {
    uuid: string | null;
    token: string | null;
    evaluation: EvaluationState | null;
    summary: Summary | null;
    loadStatus: LoadStatus;
    saveStatus: SaveStatus;
    pendingSaves: number;
    failedKeys: string[];
    isGenerating: boolean;
    /** El servidor tiene IA configurada (ai/status). */
    aiAvailable: boolean;
    aiBusy: AiTask[];
    aiError: string | null;
    /** Sugerencias ocultadas con "Ignorar" o "Cambiar": `factor:<id>` / `subfactor:<id>`. */
    dismissedSuggestions: string[];

    load: (uuid: string) => Promise<void>;
    setDecisorImportance: (factorId: number, value: Importance | null) => void;
    setScope: (factorId: number, value: Scope | null) => void;
    setRating: (subfactorId: number, value: Rating | null) => void;
    retryFailed: () => void;
    generateVerdict: () => Promise<VerdictOutcome>;
    duplicate: () => Promise<string | null>;
    suggestImportance: () => Promise<void>;
    suggestRatings: (factorId: number) => Promise<void>;
    acceptAllRatings: (factorId: number) => number;
    dismissSuggestion: (key: string) => void;
    generateAiReport: () => Promise<boolean>;
    clearAiError: () => void;
    reset: () => void;
}

type SaveCall = () => Promise<Summary>;

const initialState = {
    uuid: null,
    token: null,
    evaluation: null,
    summary: null,
    loadStatus: 'idle' as LoadStatus,
    saveStatus: 'idle' as SaveStatus,
    pendingSaves: 0,
    failedKeys: [] as string[],
    isGenerating: false,
    aiAvailable: false,
    aiBusy: [] as AiTask[],
    aiError: null as string | null,
    dismissedSuggestions: [] as string[],
};

const toast = (type: 'success' | 'error' | 'warning' | 'info', message: string) =>
    useToastStore.getState().addToast({ type, message });

const updateFactor = (
    evaluation: EvaluationState,
    factorId: number,
    change: (factor: EvaluationFactorState) => EvaluationFactorState,
): EvaluationState => ({
    ...evaluation,
    factors: evaluation.factors.map((factor) => (factor.factor_id === factorId ? change(factor) : factor)),
});

const useEvaluationStore = create<EvaluationStoreState>((set, get) => {
    let queue = createKeyedQueue();
    let lastCalls = new Map<string, SaveCall>();
    let failedCalls = new Map<string, SaveCall>();
    let reportedFailures = new WeakSet<Promise<void>>();

    const syncSaved = (evaluation: EvaluationState) => {
        useSavedEvaluationsStore.getState().update(evaluation.uuid, {
            status: evaluation.status,
            software_name: evaluation.software_name,
            org_name: evaluation.org_name,
        });
    };

    const refresh = async () => {
        const { uuid, token } = get();
        if (!uuid || !token) return;
        const [evaluation, summary] = await Promise.all([
            guiosPublicService.getEvaluation(uuid, token),
            guiosPublicService.getSummary(uuid, token),
        ]);
        set({ evaluation, summary });
        syncSaved(evaluation);
    };

    const finishSave = () => {
        set((state) => {
            const pendingSaves = Math.max(0, state.pendingSaves - 1);
            const failedKeys = [...failedCalls.keys()];
            let saveStatus: SaveStatus = state.saveStatus;
            if (pendingSaves === 0) saveStatus = failedKeys.length > 0 ? 'error' : 'saved';
            return { pendingSaves, failedKeys, saveStatus };
        });
    };

    const save = (key: string, call: SaveCall) => {
        const { evaluation } = get();
        if (!evaluation || evaluation.status === 'completed') return;

        lastCalls.set(key, call);
        const task = async () => {
            const summary = await call();
            set({ summary });
        };
        set((state) => ({ pendingSaves: state.pendingSaves + 1, saveStatus: 'saving' }));

        const promise = queue.enqueue(key, task);
        promise
            .then(() => {
                failedCalls.delete(key);
            })
            .catch(async (error: unknown) => {
                const status = getErrorStatus(error);
                const firstReport = !reportedFailures.has(promise);
                reportedFailures.add(promise);
                if (status === 409) {
                    failedCalls.delete(key);
                    if (firstReport) {
                        toast('warning', 'La evaluación ya tiene dictamen y está cerrada. Para corregirla, duplíquela.');
                        await refresh().catch(() => undefined);
                    }
                } else if (status === 403 || status === 404) {
                    failedCalls.delete(key);
                    set({ loadStatus: 'no_access' });
                } else {
                    const latest = lastCalls.get(key);
                    if (latest) failedCalls.set(key, latest);
                    if (firstReport) toast('error', 'No se pudo guardar el último cambio. Revise su conexión y use "Reintentar".');
                }
            })
            .finally(finishSave);
    };

    /** Ejecuta una operación de IA; si falla, deja un mensaje y la evaluación sigue en modo manual. */
    const runAi = async (task: AiTask, operation: () => Promise<void>): Promise<boolean> => {
        if (get().aiBusy.includes(task)) return false;
        set((state) => ({ aiBusy: [...state.aiBusy, task], aiError: null }));
        try {
            await operation();
            return true;
        } catch (error) {
            const status = getErrorStatus(error);
            set({ aiError: aiErrorMessage(error), ...(status === 503 ? { aiAvailable: false } : {}) });
            if (status === 409) await refresh().catch(() => undefined);
            return false;
        } finally {
            set((state) => ({ aiBusy: state.aiBusy.filter((item) => item !== task) }));
        }
    };

    return {
        ...initialState,

        load: async (uuid) => {
            queue = createKeyedQueue();
            lastCalls = new Map();
            failedCalls = new Map();
            reportedFailures = new WeakSet();
            const token = useSavedEvaluationsStore.getState().getToken(uuid);
            set({ ...initialState, uuid, token, loadStatus: token ? 'loading' : 'no_access' });
            if (!token) return;
            guiosPublicService.getAiStatus()
                .then(({ available }) => { if (get().uuid === uuid) set({ aiAvailable: available }); })
                .catch(() => undefined);
            try {
                await refresh();
                set({ loadStatus: 'ready' });
            } catch (error) {
                const status = getErrorStatus(error);
                set({ loadStatus: status === 403 || status === 404 ? 'no_access' : 'error' });
            }
        },

        setDecisorImportance: (factorId, value) => {
            const { evaluation, uuid, token } = get();
            if (!evaluation || !uuid || !token || evaluation.status === 'completed') return;
            set({
                evaluation: updateFactor(evaluation, factorId, (factor) => ({
                    ...factor,
                    decisor_importance: value,
                    id_was_ai_accepted: value !== null && value === factor.ai_suggested_id,
                })),
            });
            save(`factor:${factorId}:id`, () => guiosPublicService.setDecisorImportance(uuid, token, factorId, value));
        },

        setScope: (factorId, value) => {
            const { evaluation, uuid, token } = get();
            if (!evaluation || !uuid || !token || evaluation.status === 'completed') return;
            set({
                evaluation: updateFactor(evaluation, factorId, (factor) => ({ ...factor, scope_used: value ?? '' })),
            });
            save(`factor:${factorId}:scope`, () => guiosPublicService.setScope(uuid, token, factorId, value));
        },

        setRating: (subfactorId, value) => {
            const { evaluation, uuid, token } = get();
            if (!evaluation || !uuid || !token || evaluation.status === 'completed') return;
            set({
                evaluation: {
                    ...evaluation,
                    factors: evaluation.factors.map((factor) => ({
                        ...factor,
                        subfactors: factor.subfactors.map((sub) => (
                            sub.subfactor_id === subfactorId
                                ? { ...sub, rating: value, rating_was_ai_accepted: value !== null && value === sub.ai_suggested_rating }
                                : sub
                        )),
                    })),
                },
            });
            save(`subfactor:${subfactorId}`, () => guiosPublicService.setRating(uuid, token, subfactorId, value));
        },

        retryFailed: () => {
            const pending = [...failedCalls.entries()];
            failedCalls = new Map();
            set({ failedKeys: [] });
            pending.forEach(([key, call]) => save(key, call));
        },

        generateVerdict: async () => {
            const { uuid, token } = get();
            if (!uuid || !token) return 'error';
            set({ isGenerating: true });
            try {
                await queue.flush();
                if (failedCalls.size > 0) {
                    toast('error', 'Hay cambios sin guardar. Use "Reintentar" antes de generar el dictamen.');
                    return 'error';
                }
                const result = await guiosPublicService.generateVerdict(uuid, token);
                set({ summary: result.summary });
                await refresh();
                return 'ok';
            } catch (error) {
                const status = getErrorStatus(error);
                const data = getErrorData<{ code?: string; missing?: MissingItem[] }>(error);
                if (status === 400 && data?.code === 'evaluation_incomplete') {
                    const summary = get().summary;
                    if (summary && data.missing) set({ summary: { ...summary, is_complete: false, missing: data.missing } });
                    toast('warning', 'Todavía faltan datos por evaluar. Revise la lista de pendientes.');
                    return 'incomplete';
                }
                if (status === 409) {
                    await refresh().catch(() => undefined);
                    return 'locked';
                }
                toast('error', 'No se pudo generar el dictamen. Intente de nuevo.');
                return 'error';
            } finally {
                set({ isGenerating: false });
            }
        },

        duplicate: async () => {
            const { uuid, token } = get();
            if (!uuid || !token) return null;
            try {
                const copy = await guiosPublicService.duplicateEvaluation(uuid, token);
                useSavedEvaluationsStore.getState().add({
                    uuid: copy.uuid,
                    token: copy.session_token,
                    software_name: copy.software_name,
                    org_name: copy.org_name,
                    status: copy.status,
                });
                return copy.uuid;
            } catch (error) {
                toast('error', getErrorStatus(error) === 429
                    ? 'Se alcanzó el límite de evaluaciones nuevas desde esta red. Intente más tarde.'
                    : 'No se pudo duplicar la evaluación.');
                return null;
            }
        },

        suggestImportance: async () => {
            const { uuid, token } = get();
            if (!uuid || !token) return;
            await runAi('importance', async () => {
                const { suggestions } = await guiosPublicService.suggestImportance(uuid, token);
                const byId = new Map(suggestions.map((item) => [item.factor_id, item]));
                set((state) => ({
                    evaluation: state.evaluation && {
                        ...state.evaluation,
                        factors: state.evaluation.factors.map((factor) => {
                            const item = byId.get(factor.factor_id);
                            return item
                                ? { ...factor, ai_suggested_id: item.suggested_value, ai_id_justification: item.justification, id_was_ai_accepted: false }
                                : factor;
                        }),
                    },
                    dismissedSuggestions: state.dismissedSuggestions.filter((key) => !key.startsWith('factor:')),
                }));
            });
        },

        suggestRatings: async (factorId) => {
            const { uuid, token } = get();
            if (!uuid || !token) return;
            await runAi(`ratings:${factorId}`, async () => {
                const { suggestions } = await guiosPublicService.suggestRatings(uuid, token, factorId);
                const byId = new Map(suggestions.map((item) => [item.subfactor_id, item]));
                set((state) => ({
                    evaluation: state.evaluation && updateFactor(state.evaluation, factorId, (factor) => ({
                        ...factor,
                        subfactors: factor.subfactors.map((sub) => {
                            const item = byId.get(sub.subfactor_id);
                            return item
                                ? { ...sub, ai_suggested_rating: item.suggested_value, ai_rating_justification: item.justification, rating_was_ai_accepted: false }
                                : sub;
                        }),
                    })),
                    dismissedSuggestions: state.dismissedSuggestions.filter(
                        (key) => !suggestions.some((item) => key === `subfactor:${item.subfactor_id}`),
                    ),
                }));
            });
        },

        acceptAllRatings: (factorId) => {
            const factor = get().evaluation?.factors.find((item) => item.factor_id === factorId);
            if (!factor) return 0;
            // Solo los subfactores que siguen sin calificar: nunca se pisa una decisión del evaluador.
            const pending = factor.subfactors.filter((sub) => sub.rating === null && sub.ai_suggested_rating !== null);
            pending.forEach((sub) => get().setRating(sub.subfactor_id, sub.ai_suggested_rating));
            return pending.length;
        },

        dismissSuggestion: (key) => set((state) => ({
            dismissedSuggestions: state.dismissedSuggestions.includes(key)
                ? state.dismissedSuggestions
                : [...state.dismissedSuggestions, key],
        })),

        generateAiReport: async () => {
            const { uuid, token } = get();
            if (!uuid || !token) return false;
            return runAi('report', async () => {
                const report = await guiosPublicService.generateAiReport(uuid, token);
                set((state) => ({
                    evaluation: state.evaluation?.verdict ? {
                        ...state.evaluation,
                        verdict: {
                            ...state.evaluation.verdict,
                            ai_executive_summary: report.executive_summary,
                            ai_mitigation_plan: report.mitigation_plan,
                        },
                    } : state.evaluation,
                }));
            });
        },

        clearAiError: () => set({ aiError: null }),

        reset: () => set({ ...initialState }),
    };
});

export { useEvaluationStore };
export default useEvaluationStore;

