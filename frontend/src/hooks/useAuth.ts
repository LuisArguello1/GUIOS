import { useNavigate } from 'react-router-dom';
import authService from '../api/authService';
import useAuthStore from '../app/useAuthStore';
import useToastStore from '../app/useToastStore';

const getErrorDetail = (error: unknown, fallback: string): string => {
    if (typeof error !== 'object' || error === null) return fallback;

    const response = (error as { response?: unknown }).response;
    if (typeof response !== 'object' || response === null) return fallback;

    const data = (response as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return fallback;

    const detail = (data as { detail?: unknown }).detail;
    return typeof detail === 'string' && detail.trim() ? detail : fallback;
};

/**
 * useAuth Hook
 * Centraliza la lÃ³gica de autenticaciÃ³n y manejo de sesiÃ³n.
 * Integrado con el store global y el sistema de notificaciones.
 */
export const useAuth = () => {
    const navigate = useNavigate();
    const { loginSuccess, logout: logoutStore, isAuthenticated, user } = useAuthStore();
    const { setLoading, addToast } = useToastStore();

    const login = async (email: string, password: string) => {
        setLoading(true);
        try {
            const data = await authService.login(email, password);
            
            // authData esperada del backend segÃºn LoginView
            const { user: userData, groups = [] } = data;
            
            // Si el backend retornara grupos, pasarÃ­amos groups: data.groups
            loginSuccess({ user: userData, groups });
            
            addToast({ 
                type: 'success', 
                message: `Bienvenido de nuevo, ${userData.first_name || userData.username}` 
            });
            
            navigate('/');
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(error, 'Error al iniciar sesiÃ³n. Verifique sus credenciales.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await authService.logout();
            logoutStore();
            addToast({ type: 'info', message: 'SesiÃ³n cerrada correctamente.' });
            navigate('/login');
        } catch {
            // Incluso si falla la red, limpiamos el estado local
            logoutStore();
            navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    return {
        isAuthenticated,
        user,
        login,
        logout,
    };
};

export default useAuth;

