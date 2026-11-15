/**
 * features/publicEvaluation/hooks/usePublicEvaluation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook orquestador de lógica de negocio y reactividad para el Módulo de Evaluación Pública.
 * Cumple con RNF-01 (recálculo <100ms), RF-PUB-06 (persistencia en localStorage),
 * RF-IA-01 a RF-IA-05 (asistencia orientativa con degradación elegante) y RN-01 a RN-06.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import publicEvaluationService, {
    type PublicCatalogDimension,
} from '../../../api/publicEvaluationService';
import type {
    EvaluationDetail,
    EvaluationFactorItem,
    EvaluationSubfactorItem,
    EvaluationCreateInput,
    DecisorItemInput,
} from '../../../api/evaluationService';
import useToastStore from '../../../app/useToastStore';
import { downloadBlob } from '../../../utils/fileDownloader';
import { getErrorDetail } from '../../../utils/errorUtils';
import {
    getSavedEvaluations,
    saveEvaluationToHistory,
    removeEvaluationFromHistory,
    clearAllEvaluationHistory,
    type SavedEvaluationItem,
} from '../utils/historyStorage';
import {
    calculateRelativeImportance,
    classifyFoda,
    roundWeightedAverage,
} from '../../../calculations/combinationMatrix';

const STORAGE_KEY_UUID = 'guios_public_evaluation_uuid';
const STORAGE_KEY_STEP = 'guios_public_evaluation_step';
const STORAGE_KEY_LOCKED = 'guios_public_evaluation_locked';

export interface LocalDecisorState {
    id_value: number;
    scope: 'internal' | 'external';
    is_modified: boolean;
    ai_suggested?: number;
    ai_justification?: string;
    user_adjusted?: boolean;
}

function draftDecisorState(factor: EvaluationFactorItem): LocalDecisorState {
    const saved = factor.decisor_importance !== null && factor.decisor_importance !== undefined;
    const suggested = factor.ai_suggested_id && factor.ai_suggested_id >= 1 && factor.ai_suggested_id <= 4
        ? factor.ai_suggested_id
        : undefined;
    return {
        id_value: saved ? factor.decisor_importance! : (suggested ?? 3),
        scope: factor.scope_used === 'external' ? 'external' : 'internal',
        is_modified: false,
        ai_suggested: suggested,
        ai_justification: factor.ai_id_justification || undefined,
        user_adjusted: false,
    };
}

export interface LocalSubfactorRatingState {
    rating: number;
    is_modified: boolean;
    ai_suggested?: number;
    ai_justification?: string;
    user_adjusted?: boolean;
}

function draftSubfactorRating(sf: EvaluationSubfactorItem): LocalSubfactorRatingState {
    const saved = sf.rating !== null && sf.rating !== undefined;
    const suggested = sf.ai_suggested_rating && sf.ai_suggested_rating >= 1 && sf.ai_suggested_rating <= 4
        ? sf.ai_suggested_rating
        : undefined;
    return {
        rating: saved ? sf.rating! : (suggested ?? 3),
        is_modified: false,
        ai_suggested: suggested,
        ai_justification: sf.ai_rating_justification || undefined,
        user_adjusted: false,
    };
}

export const usePublicEvaluation = () => {
    const { addToast } = useToastStore();

    // ── Estados Principales ──
    const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
    const [catalog, setCatalog] = useState<PublicCatalogDimension[]>([]);
    // currentStep: 0: Registro del Software (Página completa), 1: Factores, 2: Subfactores, 3: Veredicto
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(() => {
        const urlUuid = new URLSearchParams(window.location.search).get('uuid');
        return Boolean(urlUuid || localStorage.getItem(STORAGE_KEY_UUID));
    });
    const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);
    const [isComputing, setIsComputing] = useState<boolean>(false);
    const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);

    // Historial de evaluaciones en localStorage (RF-PUB-06)
    const [savedEvaluations, setSavedEvaluations] = useState<SavedEvaluationItem[]>(() => getSavedEvaluations());
    const [clonedDraft, setClonedDraft] = useState<Partial<EvaluationCreateInput> | null>(null);

    // Modales de UI y Bloqueo de Fases Previas al avanzar al Paso 3
    const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
    const [helpStep, setHelpStep] = useState<number>(1);
    const [isConfirmStep3ModalOpen, setIsConfirmStep3ModalOpen] = useState<boolean>(false);
    const [isStep1And2Locked, setIsStep1And2Locked] = useState<boolean>(false);

    // Estados de carga por IA
    const [aiLoadingFactors, setAiLoadingFactors] = useState<Record<number, boolean>>({});
    const [aiLoadingSubfactors, setAiLoadingSubfactors] = useState<Record<number, boolean>>({});
    const [aiSuggesting, setAiSuggesting] = useState<'importance' | 'ratings' | null>(null);
    const [syncingRepoHealth, setSyncingRepoHealth] = useState<boolean>(false);
    const autoSyncedRepoRef = useRef<string | null>(null);
    const aiRequestEpochRef = useRef<number>(0);

    // ── Estados Locales de Formulario Reactivo (para <100ms de latencia en sliders) ──
    const [decisorMap, setDecisorMap] = useState<Record<number, LocalDecisorState>>({});
    const [subfactorRatingsMap, setSubfactorRatingsMap] = useState<Record<number, LocalSubfactorRatingState>>({});

    // Factor seleccionado para calificar en el Paso 2 (Subfactores)
    const [activeFactorId, setActiveFactorId] = useState<number | null>(null);

    // Bandera para evitar sincronización infinita
    const initializedRef = useRef<boolean>(false);

    const hydrateEvaluation = useCallback((data: EvaluationDetail) => {
        setEvaluation(data);
        localStorage.setItem(STORAGE_KEY_UUID, data.uuid);
        window.history.replaceState({}, '', `${window.location.pathname}?uuid=${data.uuid}`);

        const newDecisorMap: Record<number, LocalDecisorState> = {};
        (data.factors || []).forEach((f: EvaluationFactorItem) => {
            newDecisorMap[f.factor_id] = draftDecisorState(f);
        });
        setDecisorMap(newDecisorMap);

        const newSubMap: Record<number, LocalSubfactorRatingState> = {};
        (data.subfactors || []).forEach((sf: EvaluationSubfactorItem) => {
            newSubMap[sf.subfactor_id] = draftSubfactorRating(sf);
        });
        setSubfactorRatingsMap(newSubMap);

        const savedHistoryItem = getSavedEvaluations().find((item) => item.uuid === data.uuid);
        const savedStepStr =
            localStorage.getItem(STORAGE_KEY_UUID) === data.uuid
                ? localStorage.getItem(STORAGE_KEY_STEP)
                : null;
        const savedLockedUuid = localStorage.getItem(STORAGE_KEY_LOCKED);
        const alreadyInStep3 =
            data.status === 'completed' ||
            Boolean(data.verdict) ||
            Boolean(data.phases_locked) ||
            savedHistoryItem?.step === 3 ||
            savedStepStr === '3' ||
            savedLockedUuid === data.uuid;

        let stepToSet = 1;
        if (alreadyInStep3) {
            const parsedSavedStep = savedStepStr ? parseInt(savedStepStr, 10) : 3;
            stepToSet = parsedSavedStep >= 1 && parsedSavedStep <= 3 ? parsedSavedStep : 3;
            localStorage.setItem(STORAGE_KEY_LOCKED, data.uuid);
        } else if (data.factors?.some((f) => f.decisor_importance !== null && f.decisor_importance !== undefined)) {
            stepToSet = savedStepStr
                ? Math.max(1, Math.min(2, parseInt(savedStepStr, 10)))
                : savedHistoryItem?.step === 2
                ? 2
                : 2;
        }
        setCurrentStep(stepToSet);
        setIsStep1And2Locked(alreadyInStep3);
        setIsConfirmStep3ModalOpen(false);

        saveEvaluationToHistory({
            uuid: data.uuid,
            software_name: data.software_name,
            software_version: data.software_version || undefined,
            software_category: data.software_category || undefined,
            org_name: data.org_name,
            org_sector: data.org_sector || undefined,
            created_at: data.started_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            step: alreadyInStep3 ? 3 : stepToSet,
            status: data.status === 'completed' ? 'completed' : 'in_progress',
            recommendation: data.verdict?.recommendation || undefined,
            recommendation_display: data.verdict?.recommendation_display || undefined,
            factors_count: data.factors?.length || 0,
            ai_enabled: data.ai_enabled,
        });
        setSavedEvaluations(getSavedEvaluations());
    }, []);

    const clearMissingEvaluation = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY_UUID);
        localStorage.removeItem(STORAGE_KEY_STEP);
        localStorage.removeItem(STORAGE_KEY_LOCKED);
        window.history.replaceState({}, '', window.location.pathname);
        setEvaluation(null);
        setCurrentStep(0);
        setIsStep1And2Locked(false);
        setIsConfirmStep3ModalOpen(false);
    }, []);

    // ── 1. Recuperación de Sesión desde localStorage (RF-PUB-06) ──
    const fetchEvaluation = useCallback(
        async (uuid: string) => {
            try {
                const data = await publicEvaluationService.getEvaluation(uuid);
                hydrateEvaluation(data);
            } catch (err: unknown) {
                console.warn('Evaluación guardada no encontrada en el servidor. Mostrando pantalla de registro.', err);
                clearMissingEvaluation();
            } finally {
                setLoading(false);
            }
        },
        [hydrateEvaluation, clearMissingEvaluation]
    );

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        // El catálogo llega en el callback de la petición: el efecto no actualiza estado en el mismo turno.
        publicEvaluationService
            .getCatalog()
            .then((data) => {
                setCatalog(Array.isArray(data) ? data : []);
            })
            .catch((err: unknown) => {
                console.error('Error al cargar catálogo público:', err);
            })
            .finally(() => {
                setLoadingCatalog(false);
            });

        const urlUuid = new URLSearchParams(window.location.search).get('uuid');
        const savedUuid = urlUuid || localStorage.getItem(STORAGE_KEY_UUID);
        if (!savedUuid) return;

        publicEvaluationService.getEvaluation(savedUuid).then(
            (data) => {
                hydrateEvaluation(data);
                setLoading(false);
            },
            (err: unknown) => {
                console.warn('Evaluación guardada no encontrada en el servidor. Mostrando pantalla de registro.', err);
                clearMissingEvaluation();
                setLoading(false);
            }
        );
    }, [hydrateEvaluation, clearMissingEvaluation]);

    // Si el servidor ya guardó una sugerencia, se recupera al volver al paso sin pedirla otra vez.
    useEffect(() => {
        if (!evaluation) return;

        setDecisorMap((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const factor of evaluation.factors || []) {
                if (!factor.ai_suggested_id || !factor.ai_id_justification) continue;
                const current = next[factor.factor_id];
                if (current?.ai_justification) continue;
                next[factor.factor_id] = {
                    ...(current || draftDecisorState(factor)),
                    ai_suggested: factor.ai_suggested_id,
                    ai_justification: factor.ai_id_justification,
                };
                changed = true;
            }
            return changed ? next : prev;
        });

        setSubfactorRatingsMap((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const subfactor of evaluation.subfactors || []) {
                if (!subfactor.ai_suggested_rating || !subfactor.ai_rating_justification) continue;
                const current = next[subfactor.subfactor_id];
                if (current?.ai_justification) continue;
                next[subfactor.subfactor_id] = {
                    ...(current || draftSubfactorRating(subfactor)),
                    ai_suggested: subfactor.ai_suggested_rating,
                    ai_justification: subfactor.ai_rating_justification,
                };
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [evaluation]);

    // Guardar paso en localStorage
    useEffect(() => {
        if (evaluation?.uuid && currentStep > 0) {
            localStorage.setItem(STORAGE_KEY_STEP, String(currentStep));
        }
    }, [currentStep, evaluation?.uuid]);

    // Mientras la tarea de literatura sigue en curso, las citas base permanecen visibles
    // y se sustituyen cuando el backend termina el mapeo.
    useEffect(() => {
        if (!evaluation?.uuid || evaluation.ai_status !== 'searching') return;

        let cancelled = false;
        const MAX_LITERATURE_WAIT_MS = 240000;
        const startedAtMs = Date.now();

        const handleTimeout = () => {
            if (cancelled) return;
            cancelled = true;
            setEvaluation((prev) =>
                prev && prev.ai_status === 'searching'
                    ? { ...prev, ai_status: 'failed' }
                    : prev
            );
            addToast({
                type: 'warning',
                message:
                    'La asistencia de IA no respondió a tiempo. Se mantienen las citas base del catálogo para que puedas continuar sin IA.',
            });
        };

        const pollLiterature = async () => {
            if (Date.now() - startedAtMs >= MAX_LITERATURE_WAIT_MS) {
                handleTimeout();
                return;
            }
            try {
                const refreshed = await publicEvaluationService.getEvaluation(evaluation.uuid);
                if (cancelled) return;
                if (refreshed.ai_status === 'searching') {
                    if (Date.now() - startedAtMs >= MAX_LITERATURE_WAIT_MS) {
                        handleTimeout();
                    }
                    return;
                }
                setEvaluation(refreshed);
                if (refreshed.ai_status === 'completed') {
                    addToast({
                        type: 'success',
                        message: 'Las citas ya están aplicadas. En el paso 1 y el paso 2 puedes pedir la sugerencia de IA del factor que estés viendo.',
                    });
                } else if (refreshed.ai_status === 'failed') {
                    addToast({
                        type: 'warning',
                        message: 'No se pudo actualizar la literatura. Se mantienen las citas base del catálogo.',
                    });
                }
            } catch (err: unknown) {
                console.warn('No se pudo consultar el estado de la literatura.', err);
            }
        };

        const timer = window.setInterval(pollLiterature, 3000);
        const timeoutTimer = window.setTimeout(handleTimeout, MAX_LITERATURE_WAIT_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            window.clearTimeout(timeoutTimer);
        };
    }, [evaluation?.uuid, evaluation?.ai_status, addToast]);

    // ── 3. Acciones Metodológicas y Cálculos Reactivos ──

    /**
     * Calcula reactivamente la Importancia Relativa (IR) para un factor en 0 ms.
     */
    const getCalculatedIR = useCallback(
        (factorId: number, systemicImportance: number): number => {
            const localState = decisorMap[factorId];
            const savedImportance = evaluation?.factors?.find((factor) => factor.factor_id === factorId)?.decisor_importance;
            const idVal = localState?.id_value ?? savedImportance ?? 3;
            return calculateRelativeImportance(systemicImportance, idVal);
        },
        [decisorMap, evaluation?.factors]
    );

    /**
     * Actualiza el valor del slider de ID para un factor específico.
     * Al moverlo manualmente, actualiza la IR de inmediato y marca is_modified=true.
     */
    const handleDecisorChange = useCallback(
        (factorId: number, idValue: number) => {
            if (isStep1And2Locked || currentStep === 3 || evaluation?.status === 'completed' || Boolean(evaluation?.verdict)) {
                addToast({
                    type: 'warning',
                    message: 'No es posible modificar los datos del Paso 1 una vez iniciada la Fase 3.',
                });
                return;
            }
            setDecisorMap((prev) => {
                const current = prev[factorId] || {
                    id_value: 3,
                    scope: 'internal',
                    is_modified: false,
                };
                return {
                    ...prev,
                    [factorId]: {
                        ...current,
                        id_value: idValue,
                        is_modified: true,
                        user_adjusted: true,
                    },
                };
            });
        },
        [isStep1And2Locked, currentStep, evaluation?.status, evaluation?.verdict, addToast]
    );

    /**
     * Actualiza el ámbito de un factor (editable solo si es configurable, ej. 'Soporte').
     */
    const handleScopeChange = useCallback(
        (factorId: number, newScope: 'internal' | 'external') => {
            if (isStep1And2Locked || currentStep === 3 || evaluation?.status === 'completed' || Boolean(evaluation?.verdict)) {
                addToast({
                    type: 'warning',
                    message: 'No es posible modificar los datos del Paso 1 una vez iniciada la Fase 3.',
                });
                return;
            }
            setDecisorMap((prev) => {
                const current = prev[factorId] || {
                    id_value: 3,
                    scope: 'internal',
                    is_modified: false,
                };
                return {
                    ...prev,
                    [factorId]: {
                        ...current,
                        scope: newScope,
                        is_modified: true,
                    },
                };
            });
        },
        [isStep1And2Locked, currentStep, evaluation?.status, evaluation?.verdict, addToast]
    );

    // Variables locales: el compilador de React no conserva useMemo si el cuerpo
    // accede a evaluation.factors después de comprobar evaluation?.factors.
    const evaluationFactors = evaluation?.factors;
    const evaluationSubfactors = evaluation?.subfactors;
    const evaluationUuid = evaluation?.uuid;

    /**
     * Factores relevantes activos calculados localmente (IR > 1).
     * Los factores con IR = 1 quedan excluidos (RN-01).
     */
    const relevantFactors = useMemo(() => {
        if (!evaluationFactors) return [];
        return evaluationFactors.filter((f) => {
            const ir = getCalculatedIR(f.factor_id, f.systemic_importance_snapshot);
            return ir > 1;
        });
    }, [evaluationFactors, getCalculatedIR]);

    const resolvedActiveFactorId =
        activeFactorId ??
        (currentStep === 2 ? (relevantFactors[0]?.factor_id ?? null) : null);

    /**
     * Subfactores del factor activo seleccionado en el Paso 2.
     */
    const activeSubfactors = useMemo(() => {
        if (!resolvedActiveFactorId || !evaluationSubfactors) return [];
        return evaluationSubfactors.filter((sf) => sf.factor_id === resolvedActiveFactorId);
    }, [resolvedActiveFactorId, evaluationSubfactors]);

    /**
     * Actualiza la calificación de un subfactor localmente (modo manual).
     */
    const handleSubfactorRatingChange = useCallback(
        (subfactorId: number, rating: number) => {
            if (isStep1And2Locked || currentStep === 3 || evaluation?.status === 'completed' || Boolean(evaluation?.verdict)) {
                addToast({
                    type: 'warning',
                    message: 'No es posible modificar las calificaciones del Paso 2 una vez iniciada la Fase 3.',
                });
                return;
            }
            setSubfactorRatingsMap((prev) => {
                const current = prev[subfactorId] || {
                    rating: 3,
                    is_modified: false,
                };
                if (current.rating === rating && current.is_modified) return prev;
                return {
                    ...prev,
                    [subfactorId]: {
                        ...current,
                        rating,
                        is_modified: true,
                        user_adjusted: true,
                    },
                };
            });
        },
        [isStep1And2Locked, currentStep, evaluation?.status, evaluation?.verdict, addToast]
    );

    /**
     * Comprueba si hay calificaciones de subfactores modificadas sin guardar.
     */
    const hasUnsavedSubfactorRatings = useMemo(() => {
        const hasModified = Object.values(subfactorRatingsMap).some((s) => s.is_modified);
        const hasNullInDb = (evaluation?.subfactors || []).some((sf) => sf.rating === null || sf.rating === undefined);
        return hasModified || hasNullInDb;
    }, [subfactorRatingsMap, evaluation?.subfactors]);

    const unsavedSubfactorRatingsCount = useMemo(() => {
        const modifiedCount = Object.values(subfactorRatingsMap).filter((s) => s.is_modified).length;
        const unpersistedDbCount = (evaluation?.subfactors || []).filter(
            (sf) => (sf.rating === null || sf.rating === undefined) && !subfactorRatingsMap[sf.subfactor_id]?.is_modified
        ).length;
        return modifiedCount + unpersistedDbCount;
    }, [subfactorRatingsMap, evaluation?.subfactors]);

    /**
     * Calcula la Ponderación Media (PM) local de un factor.
     */
    const getFactorLocalPM = useCallback(
        (factorId: number): { average: number; isComplete: boolean; foda: string } => {
            if (!evaluationSubfactors) return { average: 0, isComplete: false, foda: 'Pendiente' };
            const factorSubfactors = evaluationSubfactors.filter((sf) => sf.factor_id === factorId);
            if (factorSubfactors.length === 0) return { average: 0, isComplete: false, foda: 'Pendiente' };

            const ratings: number[] = [];
            for (const sf of factorSubfactors) {
                const local = subfactorRatingsMap[sf.subfactor_id];
                const rating = local?.rating ?? sf.rating ?? sf.ai_suggested_rating ?? 3;
                if (rating >= 1 && rating <= 4) {
                    ratings.push(rating);
                }
            }

            const isComplete = ratings.length === factorSubfactors.length;
            const avg = isComplete ? roundWeightedAverage(ratings) : 0;
            const savedScope = evaluationFactors?.find((factor) => factor.factor_id === factorId)?.scope_used;
            const scope = decisorMap[factorId]?.scope || savedScope || 'internal';
            const foda = isComplete ? classifyFoda(avg, scope === 'external' ? 'external' : 'internal') : 'Pendiente';

            return { average: avg, isComplete, foda };
        },
        [evaluationSubfactors, evaluationFactors, subfactorRatingsMap, decisorMap]
    );

    // ── 4. Operaciones Asíncronas del Wizard ──

    /**
     * Inicia una nueva sesión de evaluación anónima (Paso 0).
     */
    const handleStartEvaluation = useCallback(
        async (data: EvaluationCreateInput) => {
            setIsComputing(true);
            try {
                const created = await publicEvaluationService.createEvaluation(data);
                setEvaluation(created);
                setClonedDraft(null);
                localStorage.setItem(STORAGE_KEY_UUID, created.uuid);
                localStorage.setItem(STORAGE_KEY_STEP, '1');
                localStorage.removeItem(STORAGE_KEY_LOCKED);
                window.history.replaceState({}, '', `${window.location.pathname}?uuid=${created.uuid}`);
                setCurrentStep(1);
                setIsStep1And2Locked(false);
                setIsConfirmStep3ModalOpen(false);

                // Poblar mapa de decisor con valores iniciales
                const newMap: Record<number, LocalDecisorState> = {};
                (created.factors || []).forEach((f: EvaluationFactorItem) => {
                    newMap[f.factor_id] = draftDecisorState(f);
                });
                setDecisorMap(newMap);

                // Inicializar mapa de subfactores con valores base
                const newSubMap: Record<number, LocalSubfactorRatingState> = {};
                (created.subfactors || []).forEach((sf: EvaluationSubfactorItem) => {
                    newSubMap[sf.subfactor_id] = draftSubfactorRating(sf);
                });
                setSubfactorRatingsMap(newSubMap);

                // Guardar en historial local de localStorage (RF-PUB-06)
                saveEvaluationToHistory({
                    uuid: created.uuid,
                    software_name: created.software_name,
                    software_version: created.software_version || undefined,
                    software_category: created.software_category || undefined,
                    org_name: created.org_name,
                    org_sector: created.org_sector || undefined,
                    created_at: created.started_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    step: 1,
                    status: 'in_progress',
                    factors_count: created.factors?.length || 0,
                    ai_enabled: created.ai_enabled,
                });
                setSavedEvaluations(getSavedEvaluations());

                if (created.ai_enabled && created.ai_status === 'failed') {
                    addToast({
                        type: 'warning',
                        message:
                            'El servicio de IA no está disponible en este momento. Se cargaron los valores base del catálogo para que puedas continuar sin IA.',
                    });
                } else {
                    addToast({
                        type: 'success',
                        message: created.ai_enabled
                            ? `Evaluación iniciada para "${created.software_name}". Mostramos las citas base mientras la IA busca literatura.`
                            : `Evaluación iniciada para "${created.software_name}". Factores del catálogo precargados.`,
                    });
                }
                return true;
            } catch (err: unknown) {
                const message = getErrorDetail(err, 'No fue posible iniciar la evaluación.');
                addToast({ type: 'error', message });
                return false;
            } finally {
                setIsComputing(false);
            }
        },
        [addToast]
    );

    /**
     * Guarda la configuración de factores e Importancia del Decisor (Fase 1 / Pasos 1-2).
     */
    const handleSaveDecisor = useCallback(async (): Promise<boolean> => {
        if (!evaluation?.uuid || !evaluation.factors) return false;

        if (isStep1And2Locked || currentStep === 3 || evaluation.status === 'completed' || Boolean(evaluation.verdict)) {
            addToast({
                type: 'warning',
                message: 'No es posible modificar los datos del Paso 1 una vez iniciada la Fase 3.',
            });
            return false;
        }

        if (evaluation.ai_status === 'searching') {
            addToast({
                type: 'warning',
                message: 'La búsqueda de literatura sigue en curso. El paso 1 espera ese resultado antes de continuar.',
            });
            return false;
        }

        setIsComputing(true);
        try {
            const payload: DecisorItemInput[] = evaluation.factors.map((f) => {
                const local = decisorMap[f.factor_id] || {
                    id_value: f.decisor_importance ?? 1,
                    scope: f.scope_used || 'internal',
                };
                return {
                    factor_id: f.factor_id,
                    decisor_importance: local.id_value,
                    scope_used: local.scope,
                };
            });

            const updated = await publicEvaluationService.applyDecisor(evaluation.uuid, payload);
            setEvaluation(updated);

            // Actualizar historial local con paso 2
            saveEvaluationToHistory({
                uuid: updated.uuid,
                software_name: updated.software_name,
                software_version: updated.software_version || undefined,
                software_category: updated.software_category || undefined,
                org_name: updated.org_name,
                org_sector: updated.org_sector || undefined,
                created_at: updated.started_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                step: 2,
                status: 'in_progress',
                factors_count: updated.factors?.length || 0,
                ai_enabled: updated.ai_enabled,
            });
            setSavedEvaluations(getSavedEvaluations());

            addToast({
                type: 'success',
                message: 'Ponderación del Decisor aplicada correctamente. Factores relevantes determinados.',
            });

            setCurrentStep(2);
            return true;
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al guardar la ponderación del decisor.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setIsComputing(false);
        }
    }, [evaluation, isStep1And2Locked, currentStep, decisorMap, addToast]);

    /**
     * Guarda calificaciones de los subfactores de uno o varios factores (Fase 2 / Pasos 3-4).
     */
    const handleSaveSubfactorRatings = useCallback(
        async (factorIdToSave?: number): Promise<boolean> => {
            if (!evaluation?.uuid) return false;

            if (isStep1And2Locked || currentStep === 3 || evaluation.status === 'completed' || Boolean(evaluation.verdict)) {
                addToast({
                    type: 'warning',
                    message: 'No es posible modificar las calificaciones del Paso 2 una vez iniciada la Fase 3.',
                });
                return false;
            }

            const ratingsToSend: Record<number, number> = {};
            const subfactorsToFilter = factorIdToSave
                ? (evaluation.subfactors || []).filter((sf) => sf.factor_id === factorIdToSave)
                : evaluation.subfactors || [];

            let hasModified = false;
            for (const sf of subfactorsToFilter) {
                const local = subfactorRatingsMap[sf.subfactor_id];
                const rating = local?.rating ?? sf.rating ?? sf.ai_suggested_rating ?? 3;
                if (rating >= 1 && rating <= 4) {
                    ratingsToSend[sf.subfactor_id] = rating;
                    if (local?.is_modified || sf.rating === null || sf.rating === undefined) {
                        hasModified = true;
                    }
                }
            }

            // Validación: Si el usuario presiona guardar sin haber hecho cambios, se le notifica
            if (!hasModified) {
                addToast({
                    type: 'info',
                    message: 'No has realizado cambios en las calificaciones para guardar.',
                });
                return false;
            }

            setIsComputing(true);
            try {
                const updated = await publicEvaluationService.rateSubfactors(evaluation.uuid, ratingsToSend);
                setEvaluation(updated);

                // Marcar los subfactores guardados como no modificados
                setSubfactorRatingsMap((prev) => {
                    const next = { ...prev };
                    Object.keys(ratingsToSend).forEach((idStr) => {
                        const id = Number(idStr);
                        if (next[id]) {
                            next[id] = { ...next[id], is_modified: false };
                        }
                    });
                    return next;
                });

                addToast({
                    type: 'success',
                    message: factorIdToSave
                        ? 'Calificaciones del factor guardadas y Ponderación Media calculada.'
                        : 'Calificaciones registradas exitosamente y Ponderación Media calculada.',
                });
                return true;
            } catch (err: unknown) {
                const message = getErrorDetail(err, 'Error al guardar calificaciones de subfactores.');
                addToast({ type: 'error', message });
                return false;
            } finally {
                setIsComputing(false);
            }
        },
        [evaluation, isStep1And2Locked, currentStep, subfactorRatingsMap, addToast]
    );

    /**
     * Emite el dictamen final institucional y genera el resumen con IA (Fase 3 / Pasos 5-6).
     */
    const handleEmitVerdict = useCallback(async (): Promise<boolean> => {
        if (!evaluation?.uuid) return false;

        const publishVerdict = (updated: EvaluationDetail) => {
            setEvaluation(updated);
            setIsStep1And2Locked(true);
            saveEvaluationToHistory({
                uuid: updated.uuid,
                software_name: updated.software_name,
                software_version: updated.software_version || undefined,
                software_category: updated.software_category || undefined,
                org_name: updated.org_name,
                org_sector: updated.org_sector || undefined,
                created_at: updated.started_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
                step: 3,
                status: 'completed',
                recommendation: updated.verdict?.recommendation || undefined,
                recommendation_display: updated.verdict?.recommendation_display || undefined,
                factors_count: updated.factors?.length || 0,
                ai_enabled: updated.ai_enabled,
            });
            setSavedEvaluations(getSavedEvaluations());
            addToast({
                type: 'success',
                message: `Dictamen final calculado: Recomendación ${updated.verdict?.recommendation || ''}.`,
            });
            setCurrentStep(3);
        };

        setIsComputing(true);
        try {
            const updated = await publicEvaluationService.computeVerdict(evaluation.uuid);
            publishVerdict(updated);
            return true;
        } catch (err: unknown) {
            try {
                const refreshed = await publicEvaluationService.getEvaluation(evaluation.uuid);
                if (refreshed.verdict) {
                    publishVerdict(refreshed);
                    return true;
                }
            } catch {
                // La consulta de respaldo no sustituye el error original.
            }
            const message = getErrorDetail(err, 'Error al calcular el dictamen final.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setIsComputing(false);
        }
    }, [evaluation, addToast]);

    // ── 5. Invocación de Asistente IA ──

    /**
     * Solicita sugerencia de Importancia del Decisor (ID) para un factor.
     */
    const handleAISuggestImportance = useCallback(
        async (factorId: number) => {
            if (!evaluationUuid) return;
            const storedFactor = evaluation?.factors?.find((factor) => factor.factor_id === factorId);
            const storedJustification = decisorMap[factorId]?.ai_justification || storedFactor?.ai_id_justification;
            const storedId = decisorMap[factorId]?.ai_suggested || storedFactor?.ai_suggested_id;
            if (storedJustification && storedId) {
                setDecisorMap((prev) => ({
                    ...prev,
                    [factorId]: {
                        ...(prev[factorId] || {
                            id_value: storedId,
                            scope: storedFactor?.scope_used === 'external' ? 'external' : 'internal',
                            is_modified: false,
                        }),
                        ai_suggested: storedId,
                        ai_justification: storedJustification,
                    },
                }));
                addToast({
                    type: 'info',
                    message: 'Este factor ya tiene una sugerencia de IA. No se vuelve a generar.',
                });
                return;
            }

            const requestEpoch = aiRequestEpochRef.current;
            setAiSuggesting('importance');
            setAiLoadingFactors((prev) => ({ ...prev, [factorId]: true }));

            try {
                const res = await publicEvaluationService.aiSuggestImportance(evaluationUuid, factorId);
                if (aiRequestEpochRef.current !== requestEpoch) return;
                if (res.suggested_id) {
                    setDecisorMap((prev) => ({
                        ...prev,
                        [factorId]: {
                            id_value: res.suggested_id!,
                            scope: prev[factorId]?.scope || 'internal',
                            is_modified: true,
                            ai_suggested: res.suggested_id,
                            ai_justification: res.justification,
                            user_adjusted: false,
                        },
                    }));
                    addToast({
                        type: 'info',
                        message: `Sugerencia lista para este factor: importancia ${res.suggested_id} de 4. Revísala antes de guardar.`,
                    });
                    setEvaluation((prev) => prev ? {
                        ...prev,
                        factors: (prev.factors || []).map((factor) => (
                            factor.factor_id === factorId
                                ? { ...factor, ai_suggested_id: res.suggested_id, ai_id_justification: res.justification }
                                : factor
                        )),
                    } : prev);
                }
            } catch (err: unknown) {
                if (aiRequestEpochRef.current !== requestEpoch) return;
                const message = getErrorDetail(
                    err,
                    'El asistente de IA no pudo generar la sugerencia en este momento.'
                );
                addToast({ type: 'warning', message });
            } finally {
                setAiLoadingFactors((prev) => ({ ...prev, [factorId]: false }));
                setAiSuggesting(null);
            }
        },
        [evaluation, evaluationUuid, decisorMap, addToast]
    );

    /**
     * Solicita sugerencia de calificación de cumplimiento para un subfactor.
     */
    /**
     * Pide calificaciones solo para los subfactores del factor que está en pantalla.
     */
    const handleAISuggestFactorRatings = useCallback(
        async (factorId: number) => {
            if (!evaluationUuid || !evaluation) return;
            const targetSubfactors = (evaluation.subfactors || []).filter((sf) => sf.factor_id === factorId);
            const targetIds = targetSubfactors.map((sf) => sf.subfactor_id);
            if (targetIds.length === 0) return;

            const alreadySuggested = targetSubfactors.every((sf) => (
                Boolean(subfactorRatingsMap[sf.subfactor_id]?.ai_justification || sf.ai_rating_justification)
            ));
            if (alreadySuggested) {
                setSubfactorRatingsMap((prev) => {
                    const next = { ...prev };
                    for (const sf of targetSubfactors) {
                        const current = next[sf.subfactor_id];
                        if (current?.ai_justification || !sf.ai_rating_justification || !sf.ai_suggested_rating) continue;
                        next[sf.subfactor_id] = {
                            ...(current || draftSubfactorRating(sf)),
                            ai_suggested: sf.ai_suggested_rating,
                            ai_justification: sf.ai_rating_justification,
                        };
                    }
                    return next;
                });
                addToast({
                    type: 'info',
                    message: 'Este factor ya tiene sugerencias de IA. No se vuelven a generar.',
                });
                return;
            }

            const requestEpoch = aiRequestEpochRef.current;
            setAiSuggesting('ratings');
            setAiLoadingSubfactors((prev) => {
                const next = { ...prev };
                targetIds.forEach((id) => {
                    next[id] = true;
                });
                return next;
            });

            try {
                const res = await publicEvaluationService.aiSuggestFactorRatings(evaluationUuid, factorId);
                if (aiRequestEpochRef.current !== requestEpoch) return;
                setSubfactorRatingsMap((prev) => {
                    const next = { ...prev };
                    for (const item of res.ratings) {
                        const current = next[item.subfactor_id];
                        if (current?.ai_justification || current?.user_adjusted) continue;
                        next[item.subfactor_id] = {
                            rating: item.suggested_rating,
                            is_modified: true,
                            ai_suggested: item.suggested_rating,
                            ai_justification: item.justification,
                            user_adjusted: false,
                        };
                    }
                    return next;
                });
                setEvaluation((prev) => prev ? {
                    ...prev,
                    subfactors: (prev.subfactors || []).map((sf) => {
                        const item = res.ratings.find((rating) => rating.subfactor_id === sf.subfactor_id);
                        if (!item || sf.ai_rating_justification) return sf;
                        return {
                            ...sf,
                            ai_suggested_rating: item.suggested_rating,
                            ai_rating_justification: item.justification,
                        };
                    }),
                } : prev);
                addToast({
                    type: 'info',
                    message: `Sugerencias listas para ${res.ratings.length} subfactores de este factor. Revísalas y guárdalas.`,
                });
            } catch (err: unknown) {
                if (aiRequestEpochRef.current !== requestEpoch) return;
                const message = getErrorDetail(
                    err,
                    'El asistente de IA no pudo calificar los subfactores de este factor.'
                );
                addToast({ type: 'warning', message });
            } finally {
                setAiLoadingSubfactors((prev) => {
                    const next = { ...prev };
                    targetIds.forEach((id) => {
                        next[id] = false;
                    });
                    return next;
                });
                setAiSuggesting(null);
            }
        },
        [evaluation, evaluationUuid, subfactorRatingsMap, addToast]
    );

    const handleAISuggestRating = useCallback(
        async (subfactorId: number) => {
            if (!evaluationUuid) return;
            const requestEpoch = aiRequestEpochRef.current;
            setAiLoadingSubfactors((prev) => ({ ...prev, [subfactorId]: true }));

            try {
                const res = await publicEvaluationService.aiSuggestRating(evaluationUuid, subfactorId);
                if (aiRequestEpochRef.current !== requestEpoch) return;
                if (res.suggested_rating) {
                    setSubfactorRatingsMap((prev) => ({
                        ...prev,
                        [subfactorId]: {
                            rating: res.suggested_rating!,
                            is_modified: false,
                            ai_suggested: res.suggested_rating,
                            ai_justification: res.justification,
                        },
                    }));
                    addToast({
                        type: 'info',
                        message: `Sugerencia IA aplicada: ${res.suggested_rating} de 4.`,
                    });
                }
            } catch (err: unknown) {
                if (aiRequestEpochRef.current !== requestEpoch) return;
                const message = getErrorDetail(
                    err,
                    'El asistente de IA no pudo generar la calificación del subfactor.'
                );
                addToast({ type: 'warning', message });
            } finally {
                setAiLoadingSubfactors((prev) => ({ ...prev, [subfactorId]: false }));
            }
        },
        [evaluationUuid, addToast]
    );

    // ── 6. Descarga de Dossier en PDF y Excel ──

    const handleDownloadPdf = useCallback(async () => {
        if (!evaluation?.uuid) return;
        setDownloadingFormat('pdf');
        try {
            const { blob, contentDisposition } = await publicEvaluationService.exportPdf(evaluation.uuid);
            const filename = `Dossier_GUIOS_${evaluation.software_name || 'Software'}.pdf`;
            downloadBlob(blob, filename, contentDisposition);
            addToast({ type: 'success', message: 'Dossier técnico en PDF descargado con éxito.' });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el dossier en PDF.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingFormat(null);
        }
    }, [evaluation, addToast]);

    const handleDownloadExcel = useCallback(async () => {
        if (!evaluation?.uuid) return;
        setDownloadingFormat('excel');
        try {
            const { blob, contentDisposition } = await publicEvaluationService.exportExcel(evaluation.uuid);
            const filename = `Metodologia_GUIOS_${evaluation.software_name || 'Software'}.xlsx`;
            downloadBlob(blob, filename, contentDisposition);
            addToast({ type: 'success', message: 'Dossier analítico en Excel descargado con éxito.' });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el dossier en Excel.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingFormat(null);
        }
    }, [evaluation, addToast]);

    const handleSyncRepoHealth = useCallback(
        async (customRepoUrl?: string, silent = false) => {
            if (!evaluation?.uuid) return;
            setSyncingRepoHealth(true);
            try {
                const updated = await publicEvaluationService.syncRepoHealth(
                    evaluation.uuid,
                    customRepoUrl
                );
                setEvaluation((prev) =>
                    prev
                        ? {
                              ...prev,
                              software_repo_url: updated.software_repo_url,
                              repo_health_metrics: updated.repo_health_metrics,
                          }
                        : updated
                );
                if (!silent) {
                    const status = updated.repo_health_metrics?.status;
                    if (status === 'ok') {
                        addToast({
                            type: 'success',
                            message: `Pulso del repositorio sincronizado (${updated.repo_health_metrics?.repo_full_name}).`,
                        });
                    } else {
                        addToast({
                            type: 'info',
                            message:
                                updated.repo_health_metrics?.error_message ||
                                updated.repo_health_metrics?.message ||
                                'No se pudo extraer telemetría de código para la URL indicada.',
                        });
                    }
                }
            } catch (err: unknown) {
                if (!silent) {
                    addToast({
                        type: 'warning',
                        message: getErrorDetail(err, 'No se pudo consultar el repositorio en este momento.'),
                    });
                }
            } finally {
                setSyncingRepoHealth(false);
            }
        },
        [evaluation, addToast]
    );

    useEffect(() => {
        if (!evaluation?.uuid || (currentStep !== 1 && currentStep !== 2)) return;
        if (evaluation.repo_health_metrics || syncingRepoHealth) return;
        const repoUrl = (evaluation.software_repo_url || '').trim();
        if (!/https?:\/\/(www\.)?(github|gitlab)\.com\/[^/]+\/[^/]+/i.test(repoUrl)) return;
        if (autoSyncedRepoRef.current === evaluation.uuid) return;

        autoSyncedRepoRef.current = evaluation.uuid;
        void handleSyncRepoHealth(undefined, true);
    }, [
        evaluation,
        currentStep,
        syncingRepoHealth,
        handleSyncRepoHealth,
    ]);

    /**
     * Reanudar una evaluación guardada en localStorage desde la primera pantalla.
     */
    const handleResumeEvaluation = useCallback(
        (uuid: string) => {
            localStorage.setItem(STORAGE_KEY_UUID, uuid);
            setLoading(true);
            void fetchEvaluation(uuid);
        },
        [fetchEvaluation]
    );

    /**
     * Eliminar una evaluación específica del historial en localStorage.
     */
    const handleDeleteSavedEvaluation = useCallback(
        (uuid: string) => {
            removeEvaluationFromHistory(uuid);
            setSavedEvaluations(getSavedEvaluations());
            if (evaluation?.uuid === uuid) {
                setEvaluation(null);
                setDecisorMap({});
                setSubfactorRatingsMap({});
                setCurrentStep(0);
                setIsStep1And2Locked(false);
                setIsConfirmStep3ModalOpen(false);
            }
            addToast({ type: 'info', message: 'Evaluación eliminada del historial local.' });
        },
        [evaluation?.uuid, addToast]
    );

    /**
     * Limpiar todas las evaluaciones guardadas en localStorage.
     */
    const handleClearAllHistory = useCallback(() => {
        clearAllEvaluationHistory();
        setSavedEvaluations([]);
        setEvaluation(null);
        setDecisorMap({});
        setSubfactorRatingsMap({});
        setCurrentStep(0);
        setIsStep1And2Locked(false);
        setIsConfirmStep3ModalOpen(false);
        addToast({ type: 'info', message: 'Historial local borrado por completo.' });
    }, [addToast]);

    /**
     * Reiniciar o volver a la primera pantalla de registro (Paso 0).
     */
    const handleResetEvaluation = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY_UUID);
        localStorage.removeItem(STORAGE_KEY_STEP);
        localStorage.removeItem(STORAGE_KEY_LOCKED);
        window.history.replaceState({}, '', window.location.pathname);
        setEvaluation(null);
        setDecisorMap({});
        setSubfactorRatingsMap({});
        setCurrentStep(0);
        setIsStep1And2Locked(false);
        setIsConfirmStep3ModalOpen(false);
    }, []);

    /**
     * Clona los metadatos de software y organización de una evaluación previa hacia el formulario
     * del Paso 0 para facilitar la re-evaluación o evaluación de una nueva versión del software.
     */
    const handleCloneEvaluation = useCallback(
        async (targetUuid?: string) => {
            const uuidToClone = targetUuid || evaluation?.uuid;
            if (!uuidToClone) return;

            try {
                const source: EvaluationDetail =
                    evaluation?.uuid === uuidToClone
                        ? evaluation
                        : await publicEvaluationService.getEvaluation(uuidToClone);

                setClonedDraft({
                    software_name: source.software_name,
                    software_version: source.software_version || '',
                    software_category: source.software_category || undefined,
                    software_repo_url: source.software_repo_url || '',
                    software_description: source.software_description || '',
                    org_name: source.org_name,
                    org_sector: source.org_sector || undefined,
                    org_description: source.org_description || '',
                    org_size: source.org_size || '',
                    it_staff: source.it_staff || '',
                    replaced_software: source.replaced_software || '',
                    target_timeline: source.target_timeline || '',
                    current_platforms: source.current_platforms || '',
                    main_goal: source.main_goal || '',
                    ai_enabled: source.ai_enabled,
                });

                localStorage.removeItem(STORAGE_KEY_UUID);
                localStorage.removeItem(STORAGE_KEY_STEP);
                localStorage.removeItem(STORAGE_KEY_LOCKED);
                window.history.replaceState({}, '', window.location.pathname);
                setEvaluation(null);
                setDecisorMap({});
                setSubfactorRatingsMap({});
                setCurrentStep(0);
                setIsStep1And2Locked(false);
                setIsConfirmStep3ModalOpen(false);

                addToast({
                    type: 'info',
                    message: `Datos de "${source.software_name}" precargados. Ajusta la versión o parámetros y comienza la nueva evaluación.`,
                });
            } catch (err: unknown) {
                const message = getErrorDetail(err, 'No se pudieron recuperar los datos de la evaluación para clonar.');
                addToast({ type: 'error', message });
            }
        },
        [evaluation, addToast]
    );

    /**
     * Genera y copia al portapapeles un enlace directo compartible (?uuid=...)
     * para recuperar o compartir la evaluación entre dispositivos o colegas.
     */
    const handleShareEvaluation = useCallback(
        async (targetUuid?: string) => {
            const uuidToShare = targetUuid || evaluation?.uuid;
            if (!uuidToShare) return;

            const shareUrl = `${window.location.origin}${window.location.pathname}?uuid=${uuidToShare}`;
            try {
                await navigator.clipboard.writeText(shareUrl);
                addToast({
                    type: 'success',
                    message: 'Enlace de la evaluación copiado al portapapeles. Puedes compartirlo o abrirlo en otro dispositivo.',
                });
            } catch {
                addToast({
                    type: 'info',
                    message: `Enlace de evaluación: ${shareUrl}`,
                });
            }
        },
        [evaluation?.uuid, addToast]
    );

    /**
     * Valida que los pasos 1 y 2 estén completos y guardados antes de abrir el modal
     * de confirmación para avanzar a la Fase 3 (Matriz FODA y Dictamen).
     */
    const handleRequestAdvanceToStep3 = useCallback(() => {
        if (!evaluation) return;

        if (isStep1And2Locked || currentStep === 3 || evaluation.status === 'completed' || Boolean(evaluation.verdict)) {
            setCurrentStep(3);
            return;
        }

        if (currentStep === 1) {
            addToast({
                type: 'warning',
                message: 'Debes completar y guardar la Fase 1 y la Fase 2 antes de avanzar a la Fase 3.',
            });
            return;
        }

        if (relevantFactors.length === 0) {
            addToast({
                type: 'warning',
                message: 'Debes tener al menos un factor relevante (IR > 1) calificado para pasar a la Fase 3.',
            });
            return;
        }

        if (hasUnsavedSubfactorRatings) {
            addToast({
                type: 'warning',
                message: `Tienes ${unsavedSubfactorRatingsCount} calificación(es) sin guardar. Presiona "Guardar Calificaciones" antes de avanzar a la Fase 3.`,
            });
            return;
        }

        if (!evaluation.results || evaluation.results.length === 0) {
            addToast({
                type: 'warning',
                message: 'Primero debes guardar las calificaciones de los subfactores para consolidar los resultados.',
            });
            return;
        }

        setIsConfirmStep3ModalOpen(true);
    }, [
        evaluation,
        isStep1And2Locked,
        currentStep,
        relevantFactors.length,
        hasUnsavedSubfactorRatings,
        unsavedSubfactorRatingsCount,
        addToast,
    ]);

    /**
     * Confirma el paso definitivo a la Fase 3, bloqueando la edición de los Pasos 1 y 2.
     */
    const handleConfirmAdvanceToStep3 = useCallback(async () => {
        if (!evaluation) return;

        setIsConfirmStep3ModalOpen(false);
        setIsStep1And2Locked(true);
        setCurrentStep(3);
        localStorage.setItem(STORAGE_KEY_STEP, '3');
        localStorage.setItem(STORAGE_KEY_LOCKED, evaluation.uuid);

        let syncedEvaluation = evaluation;
        try {
            const lockedEvaluation = await publicEvaluationService.lockPhases(evaluation.uuid);
            syncedEvaluation = lockedEvaluation;
            setEvaluation(lockedEvaluation);
        } catch (err: unknown) {
            console.warn('No se pudo persistir el bloqueo de fases en el servidor.', err);
        }

        saveEvaluationToHistory({
            uuid: syncedEvaluation.uuid,
            software_name: syncedEvaluation.software_name,
            software_version: syncedEvaluation.software_version || undefined,
            software_category: syncedEvaluation.software_category || undefined,
            org_name: syncedEvaluation.org_name,
            org_sector: syncedEvaluation.org_sector || undefined,
            created_at: syncedEvaluation.started_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            step: 3,
            status: syncedEvaluation.status === 'completed' ? 'completed' : 'in_progress',
            recommendation: syncedEvaluation.verdict?.recommendation || undefined,
            recommendation_display: syncedEvaluation.verdict?.recommendation_display || undefined,
            factors_count: syncedEvaluation.factors?.length || 0,
            ai_enabled: syncedEvaluation.ai_enabled,
        });
        setSavedEvaluations(getSavedEvaluations());

        addToast({
            type: 'info',
            message: 'Has avanzado a la Fase 3. Los Pasos 1 y 2 quedan en modo de solo lectura (sin modificaciones).',
        });
    }, [evaluation, addToast]);

    /**
     * Controla el cambio de paso desde el StepIndicator superior aplicando las reglas de bloqueo.
     * Cuando isStep1And2Locked es true, permite navegar entre las Fases 1, 2 y 3 para consultar los datos
     * en modo de solo lectura, bloqueando únicamente las modificaciones.
     */
    const handleSelectStep = useCallback(
        (targetStep: number) => {
            if (targetStep === currentStep) return;

            // Si ya pasó a la Fase 3, permite navegar libremente a las Fases 1, 2 o 3 en modo solo lectura
            if (isStep1And2Locked || evaluation?.status === 'completed' || Boolean(evaluation?.verdict)) {
                setCurrentStep(targetStep);
                return;
            }

            // Si intenta ir al Paso 3 desde el Paso 1 o 2 por primera vez, debe pasar por la validación y el modal de confirmación
            if (targetStep === 3) {
                handleRequestAdvanceToStep3();
                return;
            }

            // Si está en el Paso 1 e intenta ir al Paso 2 con cambios de ID sin guardar
            if (currentStep === 1 && targetStep === 2) {
                const hasUnsavedDecisor = Object.values(decisorMap).some((d) => d.is_modified);
                const hasAnySavedDecisor = (evaluation?.factors || []).some(
                    (f) => f.decisor_importance !== null && f.decisor_importance !== undefined
                );
                if (hasUnsavedDecisor || !hasAnySavedDecisor) {
                    addToast({
                        type: 'warning',
                        message: 'Presiona "Continuar a Calificación" para registrar la ponderación del decisor antes de avanzar.',
                    });
                    return;
                }
            }

            setCurrentStep(targetStep);
        },
        [currentStep, isStep1And2Locked, evaluation, decisorMap, handleRequestAdvanceToStep3, addToast]
    );

    const openHelp = useCallback((stepNumber: number) => {
        setHelpStep(stepNumber);
        setIsHelpModalOpen(true);
    }, []);

    const handleSkipAiThinking = useCallback(async () => {
        aiRequestEpochRef.current += 1;
        setAiSuggesting(null);
        setAiLoadingFactors({});
        setAiLoadingSubfactors({});

        const wasSearchingLiterature = evaluation?.ai_status === 'searching' && Boolean(evaluation?.uuid);
        if (wasSearchingLiterature && evaluation) {
            const evaluationUuidToDisable = evaluation.uuid;
            setEvaluation((prev) =>
                prev && prev.uuid === evaluationUuidToDisable
                    ? { ...prev, ai_enabled: false, ai_status: 'pending' }
                    : prev
            );
            try {
                const updated = await publicEvaluationService.disableAi(evaluationUuidToDisable);
                setEvaluation((prev) =>
                    prev && prev.uuid === evaluationUuidToDisable ? updated : prev
                );
                saveEvaluationToHistory({
                    uuid: updated.uuid,
                    software_name: updated.software_name,
                    software_version: updated.software_version || undefined,
                    software_category: updated.software_category || undefined,
                    org_name: updated.org_name,
                    org_sector: updated.org_sector || undefined,
                    created_at: updated.started_at || new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    step: currentStep || 1,
                    status: updated.status === 'completed' ? 'completed' : 'in_progress',
                    recommendation: updated.verdict?.recommendation || undefined,
                    recommendation_display: updated.verdict?.recommendation_display || undefined,
                    factors_count: updated.factors?.length || 0,
                    ai_enabled: false,
                });
                setSavedEvaluations(getSavedEvaluations());
            } catch (err: unknown) {
                console.warn('No se pudo persistir la desactivación de IA en el servidor.', err);
            }
            addToast({
                type: 'info',
                message: 'Continuarás esta evaluación sin asistencia de IA usando los valores base del catálogo.',
            });
            return;
        }

        addToast({
            type: 'info',
            message: 'Se omitió la espera de la sugerencia de IA. Puedes continuar evaluando manualmente.',
        });
    }, [evaluation, currentStep, addToast]);

    return {
        // Estado de evaluación y catálogo
        evaluation,
        catalog,
        currentStep,
        setCurrentStep,
        handleSelectStep,
        loading,
        loadingCatalog,
        isComputing,
        downloadingFormat,

        // Historial en localStorage (RF-PUB-06)
        savedEvaluations,
        clonedDraft,
        handleResumeEvaluation,
        handleCloneEvaluation,
        handleDeleteSavedEvaluation,
        handleClearAllHistory,

        // Modales de ayuda y confirmación de Fase 3
        isHelpModalOpen,
        setIsHelpModalOpen,
        helpStep,
        openHelp,
        isConfirmStep3ModalOpen,
        setIsConfirmStep3ModalOpen,
        isStep1And2Locked,
        handleRequestAdvanceToStep3,
        handleConfirmAdvanceToStep3,

        // Factor activo para calificar
        activeFactorId: resolvedActiveFactorId,
        setActiveFactorId,
        relevantFactors,
        activeSubfactors,

        // Estado reactivo y helpers de cálculo
        decisorMap,
        subfactorRatingsMap,
        getCalculatedIR,
        handleDecisorChange,
        handleScopeChange,
        handleSubfactorRatingChange,
        getFactorLocalPM,
        hasUnsavedSubfactorRatings,
        unsavedSubfactorRatingsCount,

        // Estados de carga IA y telemetría de repositorio
        aiLoadingFactors,
        aiLoadingSubfactors,
        aiSuggesting,
        syncingRepoHealth,

        // Acciones asíncronas
        handleStartEvaluation,
        handleSaveDecisor,
        handleSaveSubfactorRatings,
        handleEmitVerdict,
        handleAISuggestImportance,
        handleAISuggestFactorRatings,
        handleAISuggestRating,
        handleSyncRepoHealth,
        handleDownloadPdf,
        handleDownloadExcel,
        handleResetEvaluation,
        handleShareEvaluation,
        handleSkipAiThinking,
    };
};

export default usePublicEvaluation;
