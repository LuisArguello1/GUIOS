/**
 * frontend/src/hooks/useAILogs.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación reactiva para logs de Inteligencia Artificial (GUIOS).
 */
import { useState, useCallback, useEffect } from 'react';
import {
    getAILogs,
    getAILogDetail,
    getEvaluationAILogs,
    type AILogItem,
    type AILogDetail,
    type AILogFilters,
} from '../api/aiLogService';

interface UseAILogsOptions {
    evaluationId?: number | string | null;
    autoFetch?: boolean;
}

export const useAILogs = (options: UseAILogsOptions = {}) => {
    const { evaluationId, autoFetch = true } = options;

    const [logs, setLogs] = useState<AILogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AILogDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [filters, setFiltersState] = useState<AILogFilters>({
        evaluation_id: evaluationId || undefined,
        request_type: '',
        status: '',
        search: '',
        page: 1,
        page_size: 20,
    });

    const fetchLogs = useCallback(
        async (customFilters?: Partial<AILogFilters>) => {
            setLoading(true);
            try {
                const queryFilters: AILogFilters = {
                    ...filters,
                    ...customFilters,
                    evaluation_id: evaluationId || customFilters?.evaluation_id || filters.evaluation_id,
                };

                // Si se especificó una evaluación única, se usa el endpoint específico si no hay paginación
                if (evaluationId && !queryFilters.search && !queryFilters.status && !queryFilters.request_type) {
                    const data = await getEvaluationAILogs(evaluationId);
                    setLogs(data);
                    setTotal(data.length);
                } else {
                    const res = await getAILogs(queryFilters);
                    setLogs(res.results);
                    setTotal(res.count);
                }
            } catch (error) {
                console.error('Error al cargar logs de IA:', error);
                setLogs([]);
                setTotal(0);
            } finally {
                setLoading(false);
            }
        },
        [filters, evaluationId]
    );

    const fetchLogDetail = useCallback(async (id: number | string) => {
        setDetailLoading(true);
        try {
            const detail = await getAILogDetail(id);
            setSelectedLog(detail);
        } catch (error) {
            console.error(`Error al cargar detalle de log #${id}:`, error);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const closeDetail = useCallback(() => {
        setSelectedLog(null);
    }, []);

    const setFilters = useCallback((newFilters: Partial<AILogFilters>) => {
        setFiltersState((prev) => ({
            ...prev,
            ...newFilters,
            page: newFilters.page ?? 1,
        }));
    }, []);

    const resetFilters = useCallback(() => {
        setFiltersState({
            evaluation_id: evaluationId || undefined,
            request_type: '',
            status: '',
            search: '',
            page: 1,
            page_size: 20,
        });
    }, [evaluationId]);

    useEffect(() => {
        if (!autoFetch) return;
        const timer = setTimeout(() => {
            void fetchLogs();
        }, 0);
        return () => clearTimeout(timer);
    }, [autoFetch, fetchLogs]);

    return {
        logs,
        total,
        loading,
        selectedLog,
        detailLoading,
        filters,
        fetchLogs,
        fetchLogDetail,
        closeDetail,
        setFilters,
        resetFilters,
    };
};
