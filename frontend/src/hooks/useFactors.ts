/**
 * hooks/useFactors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación de negocio para Factores GUIOS.
 * Conecta factorService con useFactorStore y useToastStore.
 */

import { useCallback, useEffect } from 'react';
import factorService, {
    type FactorInput,
    type FactorQueryParams,
} from '../api/factorService';
import useFactorStore from '../app/useFactorStore';
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

export const useFactors = () => {
    const {
        factors,
        total,
        loading,
        selectedFactor,
        filters,
        setFactors,
        setLoading,
        setSelectedFactor,
        setFilters,
        resetFilters,
    } = useFactorStore();

    const { addToast } = useToastStore();

    /**
     * Carga la lista de factores aplicando los filtros activos.
     */
    const fetchFactors = useCallback(
        async (customFilters?: FactorQueryParams) => {
            setLoading(true);
            try {
                const query = customFilters ?? filters;
                const data = await factorService.getAll(query);
                const list = Array.isArray(data) ? data : (data?.results ?? []);
                const totalCount = Array.isArray(data) ? data.length : (data?.count ?? list.length);
                setFactors(list, totalCount);
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al cargar los factores.');
                addToast({ type: 'error', message });
            } finally {
                setLoading(false);
            }
        },
        [filters, setLoading, setFactors, addToast]
    );

    /**
     * Carga el detalle y subfactores asociados de un factor específico.
     */
    const fetchFactorDetail = useCallback(
        async (id: number | string) => {
            try {
                const detail = await factorService.getById(id);
                setSelectedFactor(detail);
                return detail;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al consultar el detalle del factor.');
                addToast({ type: 'error', message });
                return null;
            }
        },
        [setSelectedFactor, addToast]
    );

    /**
     * Registra un nuevo factor.
     */
    const createFactor = useCallback(
        async (data: FactorInput): Promise<boolean> => {
            try {
                await factorService.create(data);
                addToast({ type: 'success', message: 'Factor creado exitosamente.' });
                await fetchFactors();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo crear el factor.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchFactors, addToast]
    );

    /**
     * Actualiza un factor existente.
     */
    const updateFactor = useCallback(
        async (id: number | string, data: Partial<FactorInput>): Promise<boolean> => {
            try {
                await factorService.partialUpdate(id, data);
                addToast({ type: 'success', message: 'Factor actualizado correctamente.' });
                await fetchFactors();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo actualizar el factor.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchFactors, addToast]
    );

    /**
     * Elimina un factor personalizado que no contenga subfactores.
     */
    const deleteFactor = useCallback(
        async (id: number | string): Promise<boolean> => {
            try {
                await factorService.delete(id);
                addToast({ type: 'success', message: 'Factor eliminado correctamente.' });
                await fetchFactors();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo eliminar el factor.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchFactors, addToast]
    );

    // Carga inicial y reactiva ante cambios en los filtros
    useEffect(() => {
        fetchFactors();
    }, [fetchFactors]);

    return {
        factors,
        total,
        loading,
        selectedFactor,
        filters,
        setFilters,
        resetFilters,
        fetchFactors,
        fetchFactorDetail,
        setSelectedFactor,
        createFactor,
        updateFactor,
        deleteFactor,
    };
};

export default useFactors;
