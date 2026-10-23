import { useCallback, useEffect } from 'react';
import guiosAdminService, {
    getAdminErrorMessage,
    type DimensionPayload,
    type FactorPayload,
    type SubfactorPayload,
} from '../api/guiosAdminService';
import useCatalogAdminStore from '../app/useCatalogAdminStore';
import useToastStore from '../app/useToastStore';

export interface MutationResult { ok: boolean; message?: string }

/**
 * Catálogo del panel: carga el árbol y expone las operaciones del CRUD. Cada
 * operación devuelve el mensaje del backend (400/409) para mostrarlo en el
 * formulario o en el modal, y además lo avisa con un toast.
 */
export const useCatalogAdmin = (enabled = true) => {
    const { tree, isLoading, error, loadTree } = useCatalogAdminStore();
    const addToast = useToastStore((state) => state.addToast);

    useEffect(() => { if (enabled) loadTree(); }, [enabled, loadTree]);

    const run = useCallback(async (operation: () => Promise<unknown>, success: string): Promise<MutationResult> => {
        try {
            await operation();
            addToast({ type: 'success', message: success });
            await loadTree();
            return { ok: true };
        } catch (err) {
            const message = getAdminErrorMessage(err, 'No se pudo guardar el cambio.');
            addToast({ type: 'error', message });
            return { ok: false, message };
        }
    }, [addToast, loadTree]);

    return {
        tree, isLoading, error, reload: loadTree,
        createDimension: (p: DimensionPayload) => run(() => guiosAdminService.createDimension(p), 'Dimensión creada.'),
        updateDimension: (id: number, p: Partial<DimensionPayload>) => run(() => guiosAdminService.updateDimension(id, p), 'Dimensión actualizada.'),
        deleteDimension: (id: number) => run(() => guiosAdminService.deleteDimension(id), 'Dimensión eliminada.'),
        createFactor: (p: FactorPayload) => run(() => guiosAdminService.createFactor(p), 'Factor creado (inactivo hasta que tenga un subfactor activo).'),
        updateFactor: (id: number, p: Partial<FactorPayload>) => run(() => guiosAdminService.updateFactor(id, p), 'Factor actualizado.'),
        deleteFactor: (id: number) => run(() => guiosAdminService.deleteFactor(id), 'Factor eliminado.'),
        createSubfactor: (p: SubfactorPayload) => run(() => guiosAdminService.createSubfactor(p), 'Subfactor creado.'),
        updateSubfactor: (id: number, p: Partial<SubfactorPayload>) => run(() => guiosAdminService.updateSubfactor(id, p), 'Subfactor actualizado.'),
        deleteSubfactor: (id: number) => run(() => guiosAdminService.deleteSubfactor(id), 'Subfactor eliminado.'),
    };
};

export default useCatalogAdmin;
