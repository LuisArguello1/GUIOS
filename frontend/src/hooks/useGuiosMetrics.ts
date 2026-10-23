import { useCallback, useEffect, useState } from 'react';
import guiosAdminService, { getAdminErrorMessage, type GuiosMetrics } from '../api/guiosAdminService';

interface MetricsState {
    metrics: GuiosMetrics | null;
    error: string | null;
    isLoading: boolean;
}

/** Métricas de GUIOS para el tablero (RF-ADM-19). */
export const useGuiosMetrics = (enabled: boolean) => {
    const [state, setState] = useState<MetricsState>({ metrics: null, error: null, isLoading: enabled });

    const fetchMetrics = useCallback(() => guiosAdminService.getMetrics()
        .then((metrics) => setState({ metrics, error: null, isLoading: false }))
        .catch((err) => setState((s) => ({
            ...s, isLoading: false, error: getAdminErrorMessage(err, 'No se pudieron cargar las métricas de GUIOS.'),
        }))), []);

    useEffect(() => {
        if (enabled) fetchMetrics();
    }, [enabled, fetchMetrics]);

    const reload = useCallback(() => {
        setState((s) => ({ ...s, isLoading: true, error: null }));
        return fetchMetrics();
    }, [fetchMetrics]);

    return { ...state, reload };
};

export default useGuiosMetrics;
