/**
 * hooks/useSubfactors.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook de orquestación de negocio para Subfactores GUIOS.
 * Conecta subfactorService con useSubfactorStore y useToastStore.
 */

import { useCallback, useEffect } from 'react';
import subfactorService, {
    type SubfactorInput,
    type SubfactorQueryParams,
} from '../api/subfactorService';
import useSubfactorStore from '../app/useSubfactorStore';
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

export const useSubfactors = () => {
    const {
        subfactors,
        total,
        loading,
        selectedSubfactor,
        filters,
        setSubfactors,
        setLoading,
        setSelectedSubfactor,
        setFilters,
        resetFilters,
    } = useSubfactorStore();

    const { addToast } = useToastStore();

    /**
     * Carga el listado de subfactores aplicando los filtros activos.
     */
    const fetchSubfactors = useCallback(
        async (customFilters?: SubfactorQueryParams) => {
            setLoading(true);
            try {
                const query = customFilters ?? filters;
                const data = await subfactorService.getAll(query);
                const list = Array.isArray(data) ? data : (data?.results ?? []);
                const totalCount = Array.isArray(data) ? data.length : (data?.count ?? list.length);
                setSubfactors(list, totalCount);
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al cargar los subfactores.');
                addToast({ type: 'error', message });
            } finally {
                setLoading(false);
            }
        },
        [filters, setLoading, setSubfactors, addToast]
    );

    /**
     * Carga el detalle de un subfactor específico.
     */
    const fetchSubfactorDetail = useCallback(
        async (id: number | string) => {
            try {
                const detail = await subfactorService.getById(id);
                setSelectedSubfactor(detail);
                return detail;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'Error al consultar el detalle del subfactor.');
                addToast({ type: 'error', message });
                return null;
            }
        },
        [setSelectedSubfactor, addToast]
    );

    /**
     * Registra un nuevo subfactor.
     */
    const createSubfactor = useCallback(
        async (data: SubfactorInput): Promise<boolean> => {
            try {
                await subfactorService.create(data);
                addToast({ type: 'success', message: 'Subfactor creado exitosamente.' });
                await fetchSubfactors();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo crear el subfactor.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchSubfactors, addToast]
    );

    /**
     * Actualiza un subfactor existente.
     */
    const updateSubfactor = useCallback(
        async (id: number | string, data: Partial<SubfactorInput>): Promise<boolean> => {
            try {
                await subfactorService.partialUpdate(id, data);
                addToast({ type: 'success', message: 'Subfactor actualizado correctamente.' });
                await fetchSubfactors();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo actualizar el subfactor.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchSubfactors, addToast]
    );

    /**
     * Elimina un subfactor personalizado.
     */
    const deleteSubfactor = useCallback(
        async (id: number | string): Promise<boolean> => {
            try {
                await subfactorService.delete(id);
                addToast({ type: 'success', message: 'Subfactor eliminado correctamente.' });
                await fetchSubfactors();
                return true;
            } catch (err: unknown) {
                const message = extractErrorMessage(err, 'No se pudo eliminar el subfactor.');
                addToast({ type: 'error', message });
                return false;
            }
        },
        [fetchSubfactors, addToast]
    );

    // Carga inicial y reactiva ante cambios en los filtros
    useEffect(() => {
        fetchSubfactors();
    }, [fetchSubfactors]);

    return {
        subfactors,
        total,
        loading,
        selectedSubfactor,
        filters,
        setFilters,
        resetFilters,
        fetchSubfactors,
        fetchSubfactorDetail,
        setSelectedSubfactor,
        createSubfactor,
        updateSubfactor,
        deleteSubfactor,
    };
};

export default useSubfactors;
