import axios, { AxiosError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from './axios';
import publicApi, { getErrorStatus } from './publicAxios';

const unauthorized: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('401', 'ERR_BAD_REQUEST', config, null, {
        status: 401, statusText: 'Unauthorized', data: {}, headers: {}, config,
    });
};

describe('API pública de GUIOS', () => {
    const originalPublicAdapter = publicApi.defaults.adapter;
    const originalAdapter = api.defaults.adapter;

    afterEach(() => {
        publicApi.defaults.adapter = originalPublicAdapter;
        api.defaults.adapter = originalAdapter;
    });

    it('no envía cookies del panel', () => {
        expect(publicApi.defaults.withCredentials).toBe(false);
    });

    it('un 401 de la API pública no intenta refrescar el token ni redirige al login', async () => {
        const refresh = vi.spyOn(axios, 'post');
        const path = window.location.pathname;
        publicApi.defaults.adapter = unauthorized;

        const error = await publicApi.get('/guios/public/evaluations/x/').catch((e: unknown) => e);
        expect(getErrorStatus(error)).toBe(401);
        expect(refresh).not.toHaveBeenCalled();
        expect(window.location.pathname).toBe(path);
    });

    it('el cliente del panel tampoco refresca por rutas /guios/public/', async () => {
        const refresh = vi.spyOn(axios, 'post');
        api.defaults.adapter = unauthorized;
        const error = await api.get('/guios/public/catalog/').catch((e: unknown) => e);
        expect(getErrorStatus(error)).toBe(401);
        expect(refresh).not.toHaveBeenCalled();
    });
});
