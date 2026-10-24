import { describe, expect, it } from 'vitest';
import { createKeyedQueue } from './autosave';

const deferred = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

describe('createKeyedQueue', () => {
    it('envía en orden y solo el último valor pendiente de un mismo elemento', async () => {
        const queue = createKeyedQueue();
        const sent: number[] = [];
        const first = deferred();
        queue.enqueue('factor:1', async () => { sent.push(1); await first.promise; });
        queue.enqueue('factor:1', async () => { sent.push(2); });
        const last = queue.enqueue('factor:1', async () => { sent.push(3); });
        expect(sent).toEqual([1]);           // nunca dos a la vez
        first.resolve();
        await last;
        expect(sent).toEqual([1, 3]);        // el 2 se descarta: gana el último
        expect(queue.isBusy()).toBe(false);
    });

    it('elementos distintos se guardan en paralelo', async () => {
        const queue = createKeyedQueue();
        const sent: string[] = [];
        const slow = deferred();
        const a = queue.enqueue('a', async () => { sent.push('a'); await slow.promise; });
        const b = queue.enqueue('b', async () => { sent.push('b'); });
        await b;
        expect(sent).toEqual(['a', 'b']);
        slow.resolve();
        await a;
    });

    it('si falla un valor pero ya hay uno nuevo, se envía el nuevo', async () => {
        const queue = createKeyedQueue();
        const sent: number[] = [];
        const first = deferred();
        const promise = queue.enqueue('k', async () => { sent.push(1); await first.promise; });
        queue.enqueue('k', async () => { sent.push(2); });
        first.reject(new Error('red'));
        await expect(promise).resolves.toBeUndefined();
        expect(sent).toEqual([1, 2]);
    });

    it('rechaza si falla el último valor y flush espera a todos', async () => {
        const queue = createKeyedQueue();
        const failing = queue.enqueue('k', async () => { throw new Error('red'); });
        await expect(failing).rejects.toThrow('red');
        const slow = deferred();
        let done = false;
        queue.enqueue('x', async () => { await slow.promise; done = true; });
        const flushed = queue.flush();
        slow.resolve();
        await flushed;
        expect(done).toBe(true);
    });
});
