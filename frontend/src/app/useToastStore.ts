import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sileo } from 'sileo';
import { toast as toastify } from 'react-toastify';
import type { ToastPosition as ToastifyPosition } from 'react-toastify';
import { toast as hotToast } from 'react-hot-toast';

type ToastSystem = 'sileo' | 'toastify' | 'hot-toast' | 'custom';
type ToastType = 'success' | 'error' | 'warning' | 'info';
type ToastPosition =
    | 'top-left' | 'top-center' | 'top-right'
    | 'bottom-left' | 'bottom-center' | 'bottom-right';

interface Toast {
    id: string;   // CORRECCIÓN: string (crypto.randomUUID) en lugar de number (Date.now colisiona)
    type: ToastType;
    message: string;
    duration: number;
}

interface ToastState {
    toastSystem: ToastSystem;
    toastPosition: ToastPosition;
    toastDuration: number;
    toastLimit: number;
    toastFilters: ToastType[];
    customToasts: Toast[];
    isLoading: boolean;

    setToastSystem: (system: ToastSystem | ((prev: ToastSystem) => ToastSystem)) => void;
    setToastPosition: (position: ToastPosition | ((prev: ToastPosition) => ToastPosition)) => void;
    setToastDuration: (duration: number | ((prev: number) => number)) => void;
    setToastLimit: (limit: number | ((prev: number) => number)) => void;
    setToastFilters: (filters: ToastType[] | ((prev: ToastType[]) => ToastType[])) => void;
    resetToastSettings: () => void;
    removeToast: (id: string) => void;
    addToast: (params: { type: ToastType; message: string; duration?: number }) => void;
    setLoading: (val: boolean) => void;
}

/** Genera un ID único para custom toasts usando la Web Crypto API (sin colisiones). */
const generateId = (): string =>
    typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const TOAST_POSITIONS: ToastPosition[] = [
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
];

/** Helper para resolver setters que aceptan valor directo o función updater. */
function resolve<T>(updater: T | ((prev: T) => T), current: T): T {
    return typeof updater === 'function' ? (updater as (prev: T) => T)(current) : updater;
}

const TOAST_DEFAULTS = {
    toastSystem: 'sileo' as ToastSystem,
    toastPosition: 'top-center' as ToastPosition,
    toastDuration: 3000,
    toastLimit: 3,
    toastFilters: ['success', 'error', 'warning', 'info'] as ToastType[],
};

const normalizeToastPosition = (value: string): ToastPosition => {
    const isAllowed = TOAST_POSITIONS.includes(value as ToastPosition);
    return isAllowed ? (value as ToastPosition) : TOAST_DEFAULTS.toastPosition;
};

/**
 * useToastStore — Bridge Pattern
 * Alterna entre Sileo, React-Toastify, Hot-Toast y el sistema custom propio.
 */
const useToastStore = create<ToastState>()(
    persist(
        (set, get) => ({
            ...TOAST_DEFAULTS,
            customToasts: [],
            isLoading: false,

            setToastSystem: (system) => {
                const resolved = resolve(system, get().toastSystem);
                set({ toastSystem: resolved });
            },

            setToastPosition: (position) => {
                const resolved = normalizeToastPosition(resolve(position, get().toastPosition));
                set({ toastPosition: resolved });
            },

            setToastDuration: (duration) => {
                const resolved = resolve(duration, get().toastDuration);
                set({ toastDuration: resolved });
            },

            setToastLimit: (limit) => {
                const resolved = resolve(limit, get().toastLimit);
                set({ toastLimit: resolved });
            },

            setToastFilters: (filters) => {
                const resolved = resolve(filters, get().toastFilters);
                set({ toastFilters: resolved });
            },

            resetToastSettings: () => {
                set(TOAST_DEFAULTS);
            },

            removeToast: (id) => {
                set((state) => ({
                    customToasts: state.customToasts.filter((t) => t.id !== id),
                }));
            },

            addToast: ({ type, message, duration: overrideDuration }) => {
                const {
                    toastSystem: system,
                    toastPosition: position,
                    toastDuration: defaultDuration,
                    toastLimit: limit,
                    toastFilters: filters,
                    customToasts,
                } = get();

                // Filtro de tipo: ignorar si no está habilitado
                if (!filters.includes(type)) return;

                const duration = overrideDuration ?? defaultDuration;

                if (system === 'sileo') {
                    const title =
                        type === 'success' ? 'Operación Exitosa'
                        : type === 'error' ? 'Error de Sistema'
                        : 'Aviso del Sistema';
                    const opts = { title, description: message, duration, position };
                    if (type === 'success') sileo.success(opts);
                    else if (type === 'error') sileo.error(opts);
                    else if (type === 'warning') sileo.warning(opts);
                    else sileo.info(opts);

                } else if (system === 'toastify') {
                    const opts = {
                        position: position as ToastifyPosition,
                        autoClose: duration,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                    };
                    if (type === 'success') toastify.success(message, opts);
                    else if (type === 'error') toastify.error(message, opts);
                    else if (type === 'warning') toastify.warn(message, opts);
                    else toastify.info(message, opts);

                } else if (system === 'hot-toast') {
                    const opts = {
                        position,
                        duration,
                        style: {
                            background: '#171717',
                            color: '#fff',
                            border: '1px solid rgba(212,175,55,0.1)',
                            fontSize: '11px',
                            borderRadius: '2px',
                        },
                    };
                    if (type === 'success') hotToast.success(message, opts);
                    else if (type === 'error') hotToast.error(message, opts);
                    else if (type === 'warning') hotToast(message, { ...opts, icon: '⚠️' });
                    else hotToast(message, { ...opts, icon: 'ℹ️' });

                } else {
                    // CORRECCIÓN: aplicar toastLimit antes de insertar.
                    // Antes el límite se definía pero nunca se usaba — los toasts se acumulaban sin fin.
                    const current = customToasts;
                    const trimmed = current.length >= limit
                        ? current.slice(current.length - limit + 1)
                        : current;

                    const id = generateId();
                    const newToast: Toast = { id, type, message, duration };

                    set({ customToasts: [...trimmed, newToast] });

                    setTimeout(() => {
                        get().removeToast(id);
                    }, duration);
                }
            },

            setLoading: (val) => set({ isLoading: val }),
        }),
        {
            name: 'toast-preferences',
            // CORRECCIÓN: excluir explícitamente customToasts e isLoading del persist.
            // Son estado UI efímero — persistirlos llena localStorage con toasts
            // obsoletos que reaparecen al recargar la página.
            partialize: (state) => ({
                toastSystem: state.toastSystem,
                toastPosition: state.toastPosition,
                toastDuration: state.toastDuration,
                toastLimit: state.toastLimit,
                toastFilters: state.toastFilters,
            }),
        }
    )
);

export default useToastStore;