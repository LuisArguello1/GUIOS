/**
 * features/publicEvaluation/utils/historyStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gestión del historial de evaluaciones públicas guardadas en el navegador (localStorage).
 * Permite al usuario consultar, reanudar o eliminar sus sesiones de evaluación previas (RF-PUB-06).
 */

export interface SavedEvaluationItem {
    uuid: string;
    software_name: string;
    software_version?: string;
    software_category?: string;
    org_name: string;
    org_sector?: string;
    created_at: string;
    updated_at: string;
    step: number; // 1: Factores, 2: Subfactores, 3: Veredicto
    status: 'draft' | 'in_progress' | 'completed';
    recommendation?: 'A' | 'B' | 'C';
    recommendation_display?: string;
    recommendation_percentage?: number;
    factors_count?: number;
    ai_enabled?: boolean;
}

const STORAGE_KEY_HISTORY = 'guios_public_evaluations_history';
const STORAGE_KEY_ACTIVE_UUID = 'guios_public_evaluation_uuid';
const STORAGE_KEY_ACTIVE_STEP = 'guios_public_evaluation_step';

/**
 * Obtiene todas las evaluaciones guardadas en el historial local ordenadas por fecha más reciente.
 */
export const getSavedEvaluations = (): SavedEvaluationItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } catch (e) {
        console.error('Error al leer historial de evaluaciones locales:', e);
        return [];
    }
};

/**
 * Guarda o actualiza una evaluación en el historial de localStorage.
 */
export const saveEvaluationToHistory = (item: SavedEvaluationItem): void => {
    try {
        const currentList = getSavedEvaluations();
        const index = currentList.findIndex((ev) => ev.uuid === item.uuid);
        let updatedList: SavedEvaluationItem[];

        if (index >= 0) {
            updatedList = [
                ...currentList.slice(0, index),
                { ...currentList[index], ...item, updated_at: new Date().toISOString() },
                ...currentList.slice(index + 1),
            ];
        } else {
            updatedList = [
                { ...item, updated_at: item.updated_at || new Date().toISOString() },
                ...currentList,
            ];
        }

        // Limitamos a un máximo de 20 evaluaciones guardadas para no saturar el almacenamiento
        if (updatedList.length > 20) {
            updatedList = updatedList.slice(0, 20);
        }

        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(updatedList));
    } catch (e) {
        console.error('Error al guardar evaluación en historial local:', e);
    }
};

/**
 * Elimina una evaluación específica del historial local.
 */
export const removeEvaluationFromHistory = (uuid: string): void => {
    try {
        const currentList = getSavedEvaluations();
        const filtered = currentList.filter((ev) => ev.uuid !== uuid);
        localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(filtered));

        // Si la evaluación eliminada era la activa, limpiamos los punteros activos
        const activeUuid = localStorage.getItem(STORAGE_KEY_ACTIVE_UUID);
        if (activeUuid === uuid) {
            localStorage.removeItem(STORAGE_KEY_ACTIVE_UUID);
            localStorage.removeItem(STORAGE_KEY_ACTIVE_STEP);
        }
    } catch (e) {
        console.error('Error al eliminar evaluación del historial:', e);
    }
};

/**
 * Limpia todo el historial de evaluaciones locales.
 */
export const clearAllEvaluationHistory = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY_HISTORY);
        localStorage.removeItem(STORAGE_KEY_ACTIVE_UUID);
        localStorage.removeItem(STORAGE_KEY_ACTIVE_STEP);
    } catch (e) {
        console.error('Error al limpiar historial completo:', e);
    }
};
