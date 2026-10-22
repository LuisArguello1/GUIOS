import axios, { AxiosError } from 'axios';
import type { AxiosInstance } from 'axios';

/**
 * Cliente HTTP de la evaluación pública de GUIOS.
 *
 * Es una instancia separada de `api` (axios.ts): no envía las cookies del panel
 * y no tiene el interceptor que refresca el token o redirige al login. Un error
 * de la API pública se muestra en la propia pantalla de la evaluación.
 */
const publicApi: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1/',
    timeout: 15000,
    withCredentials: false,
});

/** Código HTTP de un error de axios (o null si no hubo respuesta). */
export const getErrorStatus = (error: unknown): number | null =>
    error instanceof AxiosError && error.response ? error.response.status : null;

/** Datos de la respuesta de error de axios, si los hay. */
export const getErrorData = <T = Record<string, unknown>>(error: unknown): T | null =>
    error instanceof AxiosError && error.response ? (error.response.data as T) : null;

export default publicApi;
