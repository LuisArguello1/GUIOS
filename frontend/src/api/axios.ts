import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import useAuthStore from '../app/useAuthStore';

// Tipado para la cola de peticiones fallidas
interface FailedRequest {
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}

// Variable para rastrear si se está refrescando el token
let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const ensureTrailingSlash = (value: string) => (value.endsWith('/') ? value : `${value}/`);

/**
 * Procesa la cola de peticiones fallidas cuando el refresco termina.
 */
const processQueue = (error: Error | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

/**
 * Instancia de Axios configurada para usar HttpOnly Cookies.
 * 
 * IMPORTANTE: withCredentials=true permite que las cookies se envíen
 * automáticamente con cada petición.
 */
const api: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1/',
    timeout: 15000,
    withCredentials: true,  // Enviar cookies con cada petición
});

/**
 * Interceptor de Peticiones
 * Ya no necesita agregar Authorization header - las cookies se envían automáticamente
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => config,
    (error: AxiosError) => Promise.reject(error)
);

/**
 * Interceptor de Respuestas
 * Maneja el refresco silencioso de tokens via cookies.
 */
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const { config, response } = error;
        const originalRequest = config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (!originalRequest) return Promise.reject(error);

        // Evitar bucles en login, logout o refresh
        const authUrls = ['/auth/login', '/auth/logout', '/auth/token/refresh'];
        if (authUrls.some(url => originalRequest.url?.includes(url))) {
            return Promise.reject(error);
        }

        // La API pública de GUIOS nunca refresca el token del panel ni lleva al login
        // (normalmente usa publicAxios; esto protege si alguien usa `api` por error).
        if (originalRequest.url?.includes('/guios/public/')) {
            return Promise.reject(error);
        }

        // Manejo Global de 401 Unauthorized
        if (response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // Si ya se está refrescando, encolar la petición
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => api(originalRequest))
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Intentar refrescar el token via cookies
                // El backend leerá el refresh_token de la cookie y establecerá nuevas cookies
                const refreshBaseUrl = ensureTrailingSlash(api.defaults.baseURL || '/api/v1/');
                await axios.post(
                    `${refreshBaseUrl}auth/token/refresh/`,
                    {},  // Body vacío - el token viene de la cookie
                    { withCredentials: true }
                );

                processQueue(null);
                isRefreshing = false;

                // Reintentar la petición original (las nuevas cookies ya están establecidas)
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as Error);
                isRefreshing = false;

                // Si falla el refresco, logout total
                useAuthStore.getState().logout();
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login?session=expired';
                }
                return Promise.reject(refreshError);
            }
        }

        // Manejo de errores de servidor 500+
        if (response && response.status >= 500) {
            console.error('[API Server Error]', response.data);
        }

        return Promise.reject(error);
    }
);

export default api;
