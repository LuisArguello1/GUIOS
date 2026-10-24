/**
 * hooks/useDimensions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación de negocio para Dimensiones GUIOS.
 * Conecta dimensionService con useDimensionStore y useToastStore.
 */

import { useCallback, useEffect } from 'react';
import dimensionService, {
    type DimensionInput,
    type DimensionQueryParams,
} from '../api/dimensionService';
import useDimensionStore from '../app/useDimensionStore';
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

export const useDimensions = () => {
    const {
        dimensions,
        total,
        loading,
        selectedDimension,
        filters,
        setDimensions,
        setLoading,
        setSelectedDimension,
        setFilters,
        resetFilters,
    } = useDimensionStore();

    const { addToast } = useToastStore();

    /**
     * Carga la lista de dimensiones desde el backend aplicando los filtros activos.
     */
    const fetchDimensions = useCallback(
        async (customFilters?: DimensionQueryParams) => {
            setLoading(true);
            try {
                const query = customFilters ?? filters;
                const data = await dimensionService.getAll(query);
                const list = Array.isArray(data) ? data : (data?.results ?? []);
                const totalCount = Array.isArray(data) ? data.length : (data?.count ?? list.length);
                setDimensions(list, totalCount);
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al cargar las dimensiones.');
                addToast({ type: 'error', message });
            } finally {
                setLoading(false);
            }
        },
        [filters, setLoading, setDimensions, addToast]
    );

    /**
     * Carga el detalle y factores asociados de una dimensión específica.
     */
    const fetchDimensionDetail = useCallback(
        async (id: number | string) => {
            try {
                const detail = await dimensionService.getById(id);
                setSelectedDimension(detail);
                return detail;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al consultar el detalle de la dimensión.');
                addToast({ type: 'error', message });
                return null;
            }
        },
        [setSelectedDimension, addToast]
    );

    /**
     * Registra una nueva dimensión.
     */
    const createDimension = useCallback(
        async (data: DimensionInput): Promise<boolean> => {
            try {
                await dimensionService.create(data);
                addToast({ type: 'success', message: 'Dimensión creada exitosamente.' });
                await fetchDimensions();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo crear la dimensión.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchDimensions, addToast]
    );

    /**
     * Actualiza una dimensión existente.
     */
    const updateDimension = useCallback(
        async (id: number | string, data: Partial<DimensionInput>): Promise<boolean> => {
            try {
                await dimensionService.partialUpdate(id, data);
                addToast({ type: 'success', message: 'Dimensión actualizada correctamente.' });
                await fetchDimensions();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo actualizar la dimensión.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchDimensions, addToast]
    );

    /**
     * Elimina una dimensión personalizada (siempre que no contenga factores).
     */
    const deleteDimension = useCallback(
        async (id: number | string): Promise<boolean> => {
            try {
                await dimensionService.delete(id);
                addToast({ type: 'success', message: 'Dimensión eliminada correctamente.' });
                await fetchDimensions();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo eliminar la dimensión.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchDimensions, addToast]
    );

    // Carga inicial reactiva cuando cambian los filtros
    useEffect(() => {
        fetchDimensions();
    }, [fetchDimensions]);

    return {
        dimensions,
        total,
        loading,
        selectedDimension,
        filters,
        setFilters,
        resetFilters,
        fetchDimensions,
        fetchDimensionDetail,
        setSelectedDimension,
        createDimension,
        updateDimension,
        deleteDimension,
    };
};

export default useDimensions;
