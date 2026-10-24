/**
 * frontend/src/hooks/useDashboardStats.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación para el Dashboard Ejecutivo y Reportería de GUIOS.
 * Gestiona estado de carga, errores, sincronización de estadísticas y descarga
 * de reportes en PDF y Excel con feedback visual.
 */

import { useState, useCallback, useEffect } from 'react';
import dashboardService, {
    type DashboardStatisticsResponse,
} from '../api/dashboardService';
import useToastStore from '../app/useToastStore';
import { downloadBlob } from '../utils/fileDownloader';
import { getErrorDetail } from '../utils/errorUtils';

export const useDashboardStats = (autoFetch: boolean = true) => {
    const [stats, setStats] = useState<DashboardStatisticsResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
    const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

    const { addToast } = useToastStore();

    /**
     * Consulta la matriz consolidada de métricas del Dashboard.
     */
    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await dashboardService.getStatistics();
            setStats(data);
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al cargar las métricas del dashboard.');
            setError(message);
            addToast({ type: 'error', message });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    /**
     * Genera y descarga el Reporte Ejecutivo en PDF desde el backend.
     */
    const exportPdf = useCallback(async () => {
        setIsExportingPdf(true);
        try {
            const { blob, contentDisposition } = await dashboardService.exportPdf();
            downloadBlob(blob, 'Reporte_Dashboard_GUIOS.pdf', contentDisposition);
            addToast({ type: 'success', message: 'Reporte ejecutivo PDF generado exitosamente.' });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'No se pudo generar el reporte PDF. Verifique sus permisos.');
            addToast({ type: 'error', message });
        } finally {
            setIsExportingPdf(false);
        }
    }, [addToast]);

    /**
     * Genera y descarga el Libro Analítico en Excel (.xlsx) desde el backend.
     */
    const exportExcel = useCallback(async () => {
        setIsExportingExcel(true);
        try {
            const { blob, contentDisposition } = await dashboardService.exportExcel();
            downloadBlob(blob, 'Reporte_Dashboard_GUIOS.xlsx', contentDisposition);
            addToast({ type: 'success', message: 'Libro analítico Excel generado exitosamente.' });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'No se pudo generar el reporte Excel. Verifique sus permisos.');
            addToast({ type: 'error', message });
        } finally {
            setIsExportingExcel(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (!autoFetch) return;
        const timer = setTimeout(() => {
            void fetchStats();
        }, 0);
        return () => clearTimeout(timer);
    }, [autoFetch, fetchStats]);

    return {
        stats,
        loading,
        error,
        isExportingPdf,
        isExportingExcel,
        fetchStats,
        exportPdf,
        exportExcel,
    };
};

export default useDashboardStats;
