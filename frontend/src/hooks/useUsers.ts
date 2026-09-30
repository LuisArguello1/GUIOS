import { useCallback, useEffect } from 'react';
import userService from '../api/userService';
import useUserStore from '../app/useUserStore';
import useToastStore from '../app/useToastStore';

const getErrorDetail = (error: unknown, fallback: string): string => {
    if (typeof error !== 'object' || error === null) return fallback;

    const response = (error as { response?: unknown }).response;
    if (typeof response !== 'object' || response === null) return fallback;

    const data = (response as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return fallback;

    const detail = (data as { detail?: unknown }).detail;
    return typeof detail === 'string' && detail.trim() ? detail : fallback;
};

/**
 * useUsers Hook
 * Centraliza la lógica de gestión de usuarios para el panel administrativo.
 */
export const useUsers = () => {
    const { users, loading, total, filters, setUsers, setLoading, setFilters } = useUserStore();
    const { setLoading: setGlobalLoading, addToast } = useToastStore();

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            // CORRECCIÓN: DRF con paginación retorna { count, results },
            // no un array directo. Antes data?.length era siempre undefined
            // y users quedaba en [] aunque hubiera datos.
            const data = await userService.getAll(filters);
            setUsers(data.results, data.count);
        } catch {
            addToast({ type: 'error', message: 'Error al cargar la lista de usuarios.' });
        } finally {
            setLoading(false);
        }
    }, [filters, setLoading, setUsers, addToast]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const createUser = async (userData: Parameters<typeof userService.create>[0]) => {
        setGlobalLoading(true);
        try {
            await userService.create(userData);
            addToast({ type: 'success', message: 'Usuario creado correctamente.' });
            await fetchUsers();
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(error, 'Error al crear el usuario.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setGlobalLoading(false);
        }
    };

    const updateUser = async (
        id: string | number,
        userData: Parameters<typeof userService.update>[1]
    ) => {
        setGlobalLoading(true);
        try {
            await userService.update(id, userData);
            addToast({ type: 'success', message: 'Usuario actualizado correctamente.' });
            await fetchUsers();
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(error, 'Error al actualizar el usuario.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setGlobalLoading(false);
        }
    };

    const deleteUser = async (id: string | number) => {
        setGlobalLoading(true);
        try {
            const result = await userService.delete(id);
            addToast({
                type: result.action === 'HARD_DELETE' ? 'success' : 'info',
                message: result.message || 'Operación de borrado completada.',
            });
            await fetchUsers();
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(error, 'Error al eliminar el usuario.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setGlobalLoading(false);
        }
    };

    const toggleActive = async (id: string | number) => {
        setGlobalLoading(true);
        try {
            const result = await userService.toggleActive(id);
            addToast({ type: 'success', message: result.detail || 'Estado actualizado.' });
            await fetchUsers();
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(error, 'Error al cambiar estado de actividad.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setGlobalLoading(false);
        }
    };

    const setPage = (page: number) => {
        setFilters({ page });
    };

    /**
     * Sobrecarga de setFilters para asegurar que al buscar 
     * siempre volvamos a la página 1.
     */
    const updateFilters = (newFilters: Parameters<typeof setFilters>[0]) => {
        const resetPage = newFilters.search !== undefined || newFilters.show_inactive !== undefined;
        setFilters({
            ...newFilters,
            page: resetPage ? 1 : (newFilters.page || filters.page)
        });
    };

    return {
        users,
        loading,
        total,
        filters,
        setFilters: updateFilters,
        setPage,
        fetchUsers,
        createUser,
        updateUser,
        deleteUser,
        toggleActive,
    };
};

export default useUsers;