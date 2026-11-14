/**
 * features/guios/evaluations/hooks/useEvaluationDetail.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación de negocio para la vista detallada de una Evaluación GUIOS.
 * Gestiona la carga de la evaluación, descarga de dossiers y cálculo de métricas derivadas.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import evaluationService, {
    type EvaluationDetail,
    type EvaluationFactorItem,
    type EvaluationSubfactorItem,
    type EvaluationResultItem,
} from '../../../../api/evaluationService';
import useToastStore from '../../../../app/useToastStore';
import { downloadBlob } from '../../../../utils/fileDownloader';
import { getErrorDetail } from '../../../../utils/errorUtils';

export const useEvaluationDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { addToast } = useToastStore();

    const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'excel' | null>(null);
    const [syncingRepoHealth, setSyncingRepoHealth] = useState<boolean>(false);

    // Modal de Fuentes de Literatura
    const [activeFactorSources, setActiveFactorSources] = useState<EvaluationFactorItem | null>(null);
    const [isSourcesModalOpen, setIsSourcesModalOpen] = useState<boolean>(false);

    // Modal de Logs de IA
    const [isAILogsOpen, setIsAILogsOpen] = useState<boolean>(false);

    /**
     * Carga el detalle completo de la evaluación desde el backend.
     */
    const fetchDetail = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const data = await evaluationService.getEvaluationDetail(id);
            setEvaluation(data);
        } catch (err: unknown) {
            const message = getErrorDetail(err, `No se pudo cargar la evaluación #${id}.`);
            setError(message);
            addToast({ type: 'error', message });
        } finally {
            setLoading(false);
        }
    }, [id, addToast]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    /**
     * Descarga del Dossier Oficial en formato PDF.
     */
    const handleDownloadPdf = useCallback(async () => {
        if (!evaluation) return;
        setDownloadingFormat('pdf');
        try {
            const { blob, contentDisposition } = await evaluationService.exportPdf(evaluation.id);
            downloadBlob(blob, `Evaluacion_GUIOS_${evaluation.software_name}.pdf`, contentDisposition);
            addToast({
                type: 'success',
                message: `Dossier PDF de ${evaluation.software_name} descargado con éxito.`,
            });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el dossier PDF.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingFormat(null);
        }
    }, [evaluation, addToast]);

    /**
     * Descarga de la Matriz de Evaluación en formato Excel (.xlsx).
     */
    const handleDownloadExcel = useCallback(async () => {
        if (!evaluation) return;
        setDownloadingFormat('excel');
        try {
            const { blob, contentDisposition } = await evaluationService.exportExcel(evaluation.id);
            downloadBlob(blob, `Matriz_GUIOS_${evaluation.software_name}.xlsx`, contentDisposition);
            addToast({
                type: 'success',
                message: `Matriz Excel de ${evaluation.software_name} descargada con éxito.`,
            });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar la matriz en Excel.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingFormat(null);
        }
    }, [evaluation, addToast]);

    const handleOpenSourcesModal = useCallback((factor: EvaluationFactorItem) => {
        setActiveFactorSources(factor);
        setIsSourcesModalOpen(true);
    }, []);

    const handleCloseSourcesModal = useCallback(() => {
        setActiveFactorSources(null);
        setIsSourcesModalOpen(false);
    }, []);

    const handleOpenAILogs = useCallback(() => {
        setIsAILogsOpen(true);
    }, []);

    const handleCloseAILogs = useCallback(() => {
        setIsAILogsOpen(false);
    }, []);

    const handleBackToList = useCallback(() => {
        navigate('/dashboard/guios/evaluaciones');
    }, [navigate]);

    const handleSyncRepoHealth = useCallback(
        async (customRepoUrl?: string) => {
            if (!evaluation) return;
            setSyncingRepoHealth(true);
            try {
                const updated = await evaluationService.syncRepoHealth(evaluation.id, customRepoUrl);
                setEvaluation(updated);
                if (updated.repo_health_metrics?.status === 'ok') {
                    addToast({
                        type: 'success',
                        message: `Pulso del repositorio sincronizado (${updated.repo_health_metrics.repo_full_name}).`,
                    });
                } else {
                    addToast({
                        type: 'info',
                        message:
                            updated.repo_health_metrics?.error_message ||
                            updated.repo_health_metrics?.message ||
                            'No se obtuvo telemetría de código para la URL ingresada.',
                    });
                }
            } catch (err: unknown) {
                addToast({
                    type: 'error',
                    message: getErrorDetail(err, 'No se pudo consultar el repositorio.'),
                });
            } finally {
                setSyncingRepoHealth(false);
            }
        },
        [evaluation, addToast]
    );

    // ── Métricas y Derivados Metodológicos GUIOS ──
    const metrics = useMemo(() => {
        if (!evaluation) {
            return {
                pmOverall: 0,
                relevantFactorsCount: 0,
                totalFactorsCount: 0,
                ratedSubfactorsCount: 0,
                totalSubfactorsCount: 0,
                fodaCounts: { strength: 0, opportunity: 0, weakness: 0, threat: 0 },
                factorsByDimension: new Map<string, EvaluationFactorItem[]>(),
                subfactorsByFactor: new Map<number, EvaluationSubfactorItem[]>(),
                resultsByFactorId: new Map<number, EvaluationResultItem>(),
            };
        }

        const factors = evaluation.factors || [];
        const subfactors = evaluation.subfactors || [];
        const results = evaluation.results || [];

        // Agrupación de factores por dimensión
        const factorsByDimension = new Map<string, EvaluationFactorItem[]>();
        factors.forEach((f) => {
            const dimName = f.dimension_name || 'Sin Dimensión';
            const current = factorsByDimension.get(dimName) || [];
            current.push(f);
            factorsByDimension.set(dimName, current);
        });

        // Agrupación de subfactores por factor
        const subfactorsByFactor = new Map<number, EvaluationSubfactorItem[]>();
        subfactors.forEach((sf) => {
            const current = subfactorsByFactor.get(sf.factor_id) || [];
            current.push(sf);
            subfactorsByFactor.set(sf.factor_id, current);
        });

        // Mapa de resultados por factor_id
        const resultsByFactorId = new Map<number, EvaluationResultItem>();
        results.forEach((r) => {
            resultsByFactorId.set(r.factor_id, r);
        });

        // Factores relevantes
        const relevantFactors = factors.filter((f) => f.is_relevant !== false);
        const relevantFactorsCount = relevantFactors.length;
        const totalFactorsCount = factors.length;

        // Subfactores calificados
        const ratedSubfactors = subfactors.filter((sf) => sf.rating !== null && sf.rating !== undefined);
        const ratedSubfactorsCount = ratedSubfactors.length;
        const totalSubfactorsCount = subfactors.length;

        // Conteo de FODA
        const fodaCounts = {
            strength: results.filter((r) => r.foda_classification === 'strength').length,
            opportunity: results.filter((r) => r.foda_classification === 'opportunity').length,
            weakness: results.filter((r) => r.foda_classification === 'weakness').length,
            threat: results.filter((r) => r.foda_classification === 'threat').length,
        };

        // Ponderación Media General (promedio ponderado de los resultados calculados)
        let pmOverall = 0;
        if (results.length > 0) {
            const sum = results.reduce((acc, r) => acc + Number(r.weighted_average || 0), 0);
            pmOverall = Math.round((sum / results.length) * 10) / 10;
        }

        return {
            pmOverall,
            relevantFactorsCount,
            totalFactorsCount,
            ratedSubfactorsCount,
            totalSubfactorsCount,
            fodaCounts,
            factorsByDimension,
            subfactorsByFactor,
            resultsByFactorId,
        };
    }, [evaluation]);

    return {
        evaluationId: id,
        evaluation,
        loading,
        error,
        downloadingFormat,
        syncingRepoHealth,
        metrics,
        activeFactorSources,
        isSourcesModalOpen,
        isAILogsOpen,
        handleDownloadPdf,
        handleDownloadExcel,
        handleSyncRepoHealth,
        handleOpenSourcesModal,
        handleCloseSourcesModal,
        handleOpenAILogs,
        handleCloseAILogs,
        handleBackToList,
        refetch: fetchDetail,
    };
};

export default useEvaluationDetail;
