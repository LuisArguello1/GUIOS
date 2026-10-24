import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EvaluationStatus } from '../api/guiosPublicService';

/**
 * Evaluaciones públicas guardadas en este navegador (localStorage).
 * El token de cada evaluación solo existe aquí: sin él no se puede retomarla.
 */
export interface SavedEvaluation {
    uuid: string;
    token: string;
    software_name: string;
    org_name: string;
    status: EvaluationStatus;
    saved_at: string;
}

interface SavedEvaluationsState {
    items: SavedEvaluation[];
    add: (item: Omit<SavedEvaluation, 'saved_at'>) => void;
    update: (uuid: string, changes: Partial<Omit<SavedEvaluation, 'uuid' | 'token'>>) => void;
    remove: (uuid: string) => void;
    getToken: (uuid: string) => string | null;
}

const useSavedEvaluationsStore = create<SavedEvaluationsState>()(
    persist(
        (set, get) => ({
            items: [],

            add: (item) => set((state) => ({
                items: [
                    { ...item, saved_at: new Date().toISOString() },
                    ...state.items.filter((saved) => saved.uuid !== item.uuid),
                ],
            })),

            update: (uuid, changes) => set((state) => ({
                items: state.items.map((saved) => (
                    saved.uuid === uuid ? { ...saved, ...changes, saved_at: new Date().toISOString() } : saved
                )),
            })),

            remove: (uuid) => set((state) => ({ items: state.items.filter((saved) => saved.uuid !== uuid) })),

            getToken: (uuid) => get().items.find((saved) => saved.uuid === uuid)?.token ?? null,
        }),
        { name: 'guios-evaluations' },
    ),
);

export default useSavedEvaluationsStore;
