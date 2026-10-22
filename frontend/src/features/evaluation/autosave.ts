/**
 * Cola de guardado automático por elemento.
 *
 * Los cambios de un mismo elemento (p. ej., la ID de un factor) se envían en
 * orden y nunca a la vez: si llega un valor nuevo mientras otro se guarda, se
 * envía después y los intermedios se descartan (gana el último). Elementos
 * distintos se guardan en paralelo. La promesa de un elemento se rechaza solo
 * si falla su último valor.
 */
export type SaveTask = () => Promise<void>;

export interface KeyedQueue {
    enqueue: (key: string, task: SaveTask) => Promise<void>;
    isBusy: () => boolean;
    /** Espera a que terminen todos los guardados en curso (con o sin error). */
    flush: () => Promise<void>;
}

export const createKeyedQueue = (): KeyedQueue => {
    const running = new Map<string, Promise<void>>();
    const pending = new Map<string, SaveTask>();

    const drain = async (key: string, first: SaveTask) => {
        let task: SaveTask | undefined = first;
        try {
            while (task) {
                try {
                    await task();
                } catch (error) {
                    // Si ya hay un valor más nuevo, ese reemplaza al que falló.
                    if (!pending.has(key)) throw error;
                }
                task = pending.get(key);
                pending.delete(key);
            }
        } finally {
            pending.delete(key);
            running.delete(key);
        }
    };

    return {
        enqueue: (key, task) => {
            const current = running.get(key);
            if (current) {
                pending.set(key, task);
                return current;
            }
            const promise = drain(key, task);
            running.set(key, promise);
            return promise;
        },
        isBusy: () => running.size > 0,
        flush: async () => {
            while (running.size > 0) {
                await Promise.allSettled([...running.values()]);
            }
        },
    };
};
