import { useCallback, useEffect, useState } from 'react';
import guiosAdminService, { getAdminErrorMessage, type EvaluationDetail } from '../api/guiosAdminService';
import useEvaluationsAdminStore from '../app/useEvaluationsAdminStore';
import useToastStore from '../app/useToastStore';
import { filenameFromDisposition, saveBlob } from '../utils/download';

/** Historial (filtros, página, CSV con los filtros aplicados). */
export const useEvaluationsAdmin = (enabled = true) => {
    const store = useEvaluationsAdminStore();
    const { filters, page, load } = store;
    const addToast = useToastStore((state) => state.addToast);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => { if (enabled) load(); }, [enabled, filters, page, load]);

    const exportCsv = useCallback(async () => {
        setIsExporting(true);
        try {
            const { blob, disposition } = await guiosAdminService.exportCsv(filters);
            saveBlob(blob, filenameFromDisposition(disposition, 'evaluaciones-guios.csv'));
        } catch (error) {
            addToast({ type: 'error', message: getAdminErrorMessage(error, 'No se pudo exportar el CSV.') });
        } finally {
            setIsExporting(false);
        }
    }, [filters, addToast]);

    return { ...store, exportCsv, isExporting };
};

/** Detalle de solo lectura de una evaluación y su PDF. */
export const useEvaluationDetail = (uuid: string | undefined) => {
    const addToast = useToastStore((state) => state.addToast);
    // El resultado se guarda junto con su uuid: al cambiar de evaluación no se muestra la anterior.
    const [loaded, setLoaded] = useState<{ uuid: string; detail: EvaluationDetail | null; error: string | null } | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!uuid) return;
        let active = true;
        guiosAdminService.getEvaluation(uuid)
            .then((detail) => { if (active) setLoaded({ uuid, detail, error: null }); })
            .catch((err) => {
                if (active) setLoaded({ uuid, detail: null, error: getAdminErrorMessage(err, 'No se pudo cargar la evaluación.') });
            });
        return () => { active = false; };
    }, [uuid]);

    const current = loaded && loaded.uuid === uuid ? loaded : null;

    const exportPdf = useCallback(async () => {
        if (!uuid) return;
        setIsExporting(true);
        try {
            const { blob, disposition } = await guiosAdminService.exportPdf(uuid);
            saveBlob(blob, filenameFromDisposition(disposition, `evaluacion-guios-${uuid}.pdf`));
        } catch (err) {
            addToast({ type: 'error', message: getAdminErrorMessage(err, 'No se pudo generar el PDF.') });
        } finally {
            setIsExporting(false);
        }
    }, [uuid, addToast]);

    return { detail: current?.detail ?? null, error: current?.error ?? null, exportPdf, isExporting };
};
