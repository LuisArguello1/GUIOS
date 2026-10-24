/**
 * hooks/useEvaluations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación de negocio para Evaluaciones GUIOS.
 * Conecta evaluationService con useEvaluationStore y useToastStore.
 */

import { useCallback, useEffect } from 'react';
import evaluationService, {
    type EvaluationDetail,
    type EvaluationCreateInput,
    type EvaluationUpdateInput,
    type DecisorItemInput,
    type AISourceItem,
    type EvaluationQueryParams,
} from '../api/evaluationService';
import useEvaluationStore from '../app/useEvaluationStore';
import useToastStore from '../app/useToastStore';
import { getErrorDetail } from '../utils/errorUtils';

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error === 'object' && error !== null) {
        const response = (error as { response?: { data?: { error?: string; detail?: string } } }).response;
        if (response?.data?.error) {
            return response.data.error;
        }
        if (response?.data?.detail) {
            return response.data.detail;
        }
    }
    return getErrorDetail(error, fallback);
};

export const useEvaluations = () => {
    const {
        evaluations,
        total,
        loading,
        selectedEvaluation,
        isDetailLoading,
        filters,
        setEvaluations,
        setLoading,
        setSelectedEvaluation,
        setIsDetailLoading,
        setFilters,
        resetFilters,
        removeEvaluationFromList,
        updateEvaluationInList,
    } = useEvaluationStore();

    const { addToast } = useToastStore();

    /**
     * Carga el listado de evaluaciones según filtros actuales o custom.
     */
    const fetchEvaluations = useCallback(
        async (customFilters?: EvaluationQueryParams) => {
            setLoading(true);
            try {
                const query = customFilters ?? filters;
                const data = await evaluationService.getEvaluations(query);
                const list = Array.isArray(data) ? data : (data?.results ?? []);
                const totalCount = Array.isArray(data) ? data.length : (data?.count ?? list.length);
                setEvaluations(list, totalCount);
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al cargar las evaluaciones.');
                addToast({ type: 'error', message });
            } finally {
                setLoading(false);
            }
        },
        [filters, setLoading, setEvaluations, addToast]
    );

    /**
     * Carga el detalle completo de una sesión de evaluación.
     */
    const fetchEvaluationDetail = useCallback(
        async (id: number | string): Promise<EvaluationDetail | null> => {
            setIsDetailLoading(true);
            try {
                const detail = await evaluationService.getEvaluationDetail(id);
                setSelectedEvaluation(detail);
                return detail;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, `Error al cargar la evaluación #${id}.`);
                addToast({ type: 'error', message });
                return null;
            } finally {
                setIsDetailLoading(false);
            }
        },
        [setIsDetailLoading, setSelectedEvaluation, addToast]
    );

    /**
     * Inicia una nueva evaluación y refresca el listado.
     */
    const handleCreateEvaluation = useCallback(
        async (data: EvaluationCreateInput): Promise<EvaluationDetail | null> => {
            setLoading(true);
            try {
                const created = await evaluationService.createEvaluation(data);
                addToast({
                    type: 'success',
                    message: `Evaluación iniciada para "${created.software_name}".`,
                });
                await fetchEvaluations();
                return created;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al iniciar la evaluación.');
                addToast({ type: 'error', message });
                return null;
            } finally {
                setLoading(false);
            }
        },
        [setLoading, addToast, fetchEvaluations]
    );

    /**
     * Actualiza metadatos de la evaluación.
     */
    const handleUpdateEvaluation = useCallback(
        async (id: number | string, data: EvaluationUpdateInput): Promise<boolean> => {
            setLoading(true);
            try {
                const updated = await evaluationService.updateEvaluation(id, data);
                updateEvaluationInList(updated);
                if (selectedEvaluation?.id === Number(id)) {
                    setSelectedEvaluation(updated);
                }
                addToast({
                    type: 'success',
                    message: 'Datos de la evaluación actualizados correctamente.',
                });
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al actualizar la evaluación.');
                addToast({ type: 'error', message });
                return false;
            } finally {
                setLoading(false);
            }
        },
        [setLoading, updateEvaluationInList, selectedEvaluation, setSelectedEvaluation, addToast]
    );

    /**
     * Elimina una sesión de evaluación.
     */
    const handleDeleteEvaluation = useCallback(
        async (id: number | string): Promise<boolean> => {
            setLoading(true);
            try {
                await evaluationService.deleteEvaluation(id);
                removeEvaluationFromList(id);
                addToast({
                    type: 'success',
                    message: 'Evaluación eliminada correctamente.',
                });
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al eliminar la evaluación.');
                addToast({ type: 'error', message });
                return false;
            } finally {
                setLoading(false);
            }
        },
        [setLoading, removeEvaluationFromList, addToast]
    );

    /**
     * Fase 3: Ejecuta cálculo de literatura y cuartiles.
     */
    const handleCalculateLiterature = useCallback(
        async (
            id: number | string,
            data?: {
                ai_citations_by_subfactor?: Record<number, number>;
                ai_sources_by_factor?: Record<number, AISourceItem[]>;
            }
        ): Promise<EvaluationDetail | null> => {
            setIsDetailLoading(true);
            try {
                const updated = await evaluationService.calculateLiterature(id, data);
                setSelectedEvaluation(updated);
                updateEvaluationInList(updated);
                addToast({
                    type: 'success',
                    message: 'Métricas de literatura y cuartiles calculadas con éxito.',
                });
                return updated;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al calcular métricas de literatura.');
                addToast({ type: 'error', message });
                return null;
            } finally {
                setIsDetailLoading(false);
            }
        },
        [setIsDetailLoading, setSelectedEvaluation, updateEvaluationInList, addToast]
    );

    /**
     * Fase 4 (Pasos 1 y 2): Aplica ponderaciones del decisor e IR.
     */
    const handleApplyDecisor = useCallback(
        async (id: number | string, factors: DecisorItemInput[]): Promise<EvaluationDetail | null> => {
            setIsDetailLoading(true);
            try {
                const updated = await evaluationService.applyDecisor(id, factors);
                setSelectedEvaluation(updated);
                updateEvaluationInList(updated);
                addToast({
                    type: 'success',
                    message: 'Ponderaciones de importancia del decisor guardadas.',
                });
                return updated;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al guardar ponderaciones del decisor.');
                addToast({ type: 'error', message });
                return null;
            } finally {
                setIsDetailLoading(false);
            }
        },
        [setIsDetailLoading, setSelectedEvaluation, updateEvaluationInList, addToast]
    );

    /**
     * Fase 4 (Pasos 3 y 4): Califica subfactores y genera matriz FODA.
     */
    const handleRateSubfactors = useCallback(
        async (id: number | string, ratings: Record<number | string, number>): Promise<EvaluationDetail | null> => {
            setIsDetailLoading(true);
            try {
                const updated = await evaluationService.rateSubfactors(id, ratings);
                setSelectedEvaluation(updated);
                updateEvaluationInList(updated);
                addToast({
                    type: 'success',
                    message: 'Calificaciones registradas y matriz FODA generada.',
                });
                return updated;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al registrar calificaciones.');
                addToast({ type: 'error', message });
                return null;
            } finally {
                setIsDetailLoading(false);
            }
        },
        [setIsDetailLoading, setSelectedEvaluation, updateEvaluationInList, addToast]
    );

    /**
     * Fase 4 (Paso 6): Genera veredicto institucional final.
     */
    const handleComputeVerdict = useCallback(
        async (
            id: number | string,
            data?: { ai_executive_summary?: string; ai_mitigation_plan?: string }
        ): Promise<EvaluationDetail | null> => {
            setIsDetailLoading(true);
            try {
                const updated = await evaluationService.computeVerdict(id, data);
                setSelectedEvaluation(updated);
                updateEvaluationInList(updated);
                addToast({
                    type: 'success',
                    message: `Dictamen emitido: ${updated.verdict?.recommendation_display || 'Completado'}.`,
                });
                return updated;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al emitir el dictamen final.');
                addToast({ type: 'error', message });
                return null;
            } finally {
                setIsDetailLoading(false);
            }
        },
        [setIsDetailLoading, setSelectedEvaluation, updateEvaluationInList, addToast]
    );

    // Carga inicial y reactiva ante cambios en filtros
    useEffect(() => {
        fetchEvaluations();
    }, [fetchEvaluations]);

    return {
        evaluations,
        total,
        loading,
        selectedEvaluation,
        isDetailLoading,
        filters,
        fetchEvaluations,
        fetchEvaluationDetail,
        handleCreateEvaluation,
        handleUpdateEvaluation,
        handleDeleteEvaluation,
        handleCalculateLiterature,
        handleApplyDecisor,
        handleRateSubfactors,
        handleComputeVerdict,
        setFilters,
        resetFilters,
        setSelectedEvaluation,
    };
};

export default useEvaluations;
