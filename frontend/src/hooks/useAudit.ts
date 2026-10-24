import { useCallback, useEffect } from 'react';
import auditService from '../api/auditService';
import useAuditStore from '../app/useAuditStore';
import useToastStore from '../app/useToastStore';

/**
 * useAudit Hook
 * Maneja la visualización de logs de auditoría para administradores.
 */
export const useAudit = () => {
    const { logs, loading, total, filters, setLogs, setLoading, setFilters } = useAuditStore();
    const { addToast } = useToastStore();

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            // CORRECCIÓN: DRF paginado retorna { count, results }
            const data = await auditService.getAll(filters);
            setLogs(data.results, data.count);
        } catch {
            addToast({
                type: 'error',
                message: 'Error al cargar los registros de auditoría.',
            });
        } finally {
            setLoading(false);
        }
    }, [filters, setLoading, setLogs, addToast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getLogDetail = async (id: string | number) => {
        try {
            return await auditService.getById(id);
        } catch {
            addToast({ type: 'error', message: 'No se pudo obtener el detalle del log.' });
            return null;
        }
    };

    const setPage = (page: number) => {
        setFilters({ page });
    };

    /**
     * Asegura que al buscar o filtrar por modelo/usuario volvamos a la página 1.
     */
    const updateFilters = (newFilters: Parameters<typeof setFilters>[0]) => {
        const resetPage = (newFilters.search !== undefined && newFilters.search !== filters.search) || 
                          (newFilters.model_name !== undefined && newFilters.model_name !== filters.model_name) || 
                          (newFilters.user_id !== undefined && newFilters.user_id !== filters.user_id);
        
        setFilters({
            ...newFilters,
            page: resetPage ? 1 : (newFilters.page || filters.page)
        });
    };

    return { 
        logs, 
        loading, 
        total, 
        filters, 
        setFilters: updateFilters, 
        setPage,
        fetchLogs, 
        getLogDetail 
    };
};

export default useAudit;