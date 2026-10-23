import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ delete: vi.fn() }));
vi.mock('./axios', () => ({ default: api }));

import userService, { DEFAULT_DELETE_MESSAGE } from './userService';

describe('userService.delete', () => {
    beforeEach(() => { api.delete.mockReset(); });

    it('usa el JSON del backend (200)', async () => {
        api.delete.mockResolvedValue({ status: 200, data: { action: 'SOFT_DELETE', message: 'Usuario desactivado.', detail: ['evaluaciones'] } });
        await expect(userService.delete(5)).resolves.toEqual({
            action: 'SOFT_DELETE', message: 'Usuario desactivado.', detail: ['evaluaciones'],
        });
        expect(api.delete).toHaveBeenCalledWith('/users/5/');
    });

    it.each([
        ['204 sin cuerpo', ''],
        ['204 con texto', '{"action": "HARD_DEL'],
        ['cuerpo nulo', null],
        ['objeto sin action', { detail: 'ok' }],
    ])('éxito aunque el cuerpo no sirva: %s', async (_name, data) => {
        api.delete.mockResolvedValue({ status: 204, data });
        await expect(userService.delete(5)).resolves.toEqual({
            action: 'HARD_DELETE', message: DEFAULT_DELETE_MESSAGE, detail: [],
        });
    });

    it('un error real se propaga', async () => {
        api.delete.mockRejectedValue(new Error('403'));
        await expect(userService.delete(5)).rejects.toThrow('403');
    });
});
