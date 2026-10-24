import { useEffect } from 'react';
import useEvaluationStore from '../app/useEvaluationStore';

/**
 * Carga la evaluación pública `uuid` (con el token guardado en el navegador) y
 * expone su estado y las acciones de guardado automático.
 */
export const useEvaluation = (uuid: string | undefined) => {
    const store = useEvaluationStore();
    const { load } = store;

    useEffect(() => {
        if (!uuid) return;
        // Si la misma evaluación ya está cargada (p. ej., al pasar de la estación a
        // resultados), no se recarga: el store ya tiene su último estado.
        const { uuid: loaded, loadStatus } = useEvaluationStore.getState();
        if (loaded === uuid && (loadStatus === 'ready' || loadStatus === 'loading')) return;
        load(uuid);
    }, [uuid, load]);

    const readOnly = store.evaluation?.status === 'completed';
    return { ...store, readOnly };
};

export default useEvaluation;
