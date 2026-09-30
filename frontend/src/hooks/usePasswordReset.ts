import { useState, useEffect } from 'react';
import authService from '../api/authService';
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
 * usePasswordReset Hook
 * Maneja el flujo de 3 pasos para la recuperación de contraseña.
 *
 * CORRECCIÓN DE SEGURIDAD: el código OTP ya NO se persiste en sessionStorage.
 * Aunque sessionStorage es tab-isolated, cualquier script XSS en la página
 * o extensión de browser puede leerlo. El código vive solo en memoria de React
 * durante la sesión del wizard — si el usuario recarga, vuelve al paso 1
 * (comportamiento esperado ya que el OTP expira en 10 min de todos modos).
 *
 * El email sí se persiste en sessionStorage porque no es sensible y mejora
 * la UX si el usuario recarga accidentalmente el paso 2.
 */
export const usePasswordReset = () => {
    const { setLoading, addToast } = useToastStore();

    const [step, setStep] = useState(1);
    const [email, setEmail] = useState<string>(
        () => sessionStorage.getItem('reset_email') ?? ''
    );
    // CORRECCIÓN: el OTP vive solo en memoria React, nunca en sessionStorage
    const [code, setCode] = useState<string>('');

    // Persistir solo el email (no sensible)
    useEffect(() => {
        if (email) {
            sessionStorage.setItem('reset_email', email);
        } else {
            sessionStorage.removeItem('reset_email');
        }
    }, [email]);

    // Limpiar al desmontar para no dejar el email colgado si el usuario navega lejos
    useEffect(() => {
        return () => {
            // Solo limpiar si el wizard completó o fue cancelado explícitamente
            // (no en re-renders normales). La limpieza real la hace resetWizard().
        };
    }, []);

    /** PASO 1: Solicitar OTP */
    const requestOTP = async (targetEmail: string): Promise<boolean> => {
        setLoading(true);
        try {
            await authService.requestResetOTP(targetEmail);
            setEmail(targetEmail);
            setStep(2);
            addToast({
                type: 'success',
                message: 'Código enviado. Por favor, revisa tu correo electrónico.',
            });
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(
                error,
                'Error al solicitar el código. Inténtalo más tarde.'
            );
            addToast({ type: 'error', message });
            return false;
        } finally {
            setLoading(false);
        }
    };

    /** PASO 2: Verificar OTP — el código se guarda en memoria, nunca en storage */
    const verifyOTP = async (targetCode: string): Promise<boolean> => {
        setLoading(true);
        try {
            await authService.verifyResetOTP(email, targetCode);
            setCode(targetCode);   // Solo en estado React
            setStep(3);
            addToast({
                type: 'success',
                message: 'Código verificado. Ahora puedes cambiar tu contraseña.',
            });
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(error, 'Código inválido o expirado.');
            addToast({ type: 'error', message });
            return false;
        } finally {
            setLoading(false);
        }
    };

    /** PASO 3: Confirmar nueva contraseña */
    const confirmReset = async (passwordData: {
        new_password: string;
        confirm_password: string;
    }): Promise<boolean> => {
        // Guardia: no debería ocurrir, pero protege contra uso directo del hook
        if (!email || !code) {
            addToast({
                type: 'error',
                message: 'Sesión de recuperación inválida. Por favor, comienza de nuevo.',
            });
            resetWizard();
            return false;
        }

        setLoading(true);
        try {
            await authService.confirmPasswordReset(email, code, passwordData);
            addToast({
                type: 'success',
                message: 'Contraseña actualizada correctamente. Redirigiendo al login...',
            });
            resetWizard();
            return true;
        } catch (error: unknown) {
            const message = getErrorDetail(
                error,
                'No se pudo restablecer la contraseña. Verifique los datos e intente de nuevo.'
            );
            addToast({ type: 'error', message });
            return false;
        } finally {
            setLoading(false);
        }
    };

    const resetWizard = () => {
        setStep(1);
        setEmail('');
        setCode('');
        sessionStorage.removeItem('reset_email');
        // No hay reset_code en sessionStorage — no hace falta limpiar
    };

    return {
        step,
        email,
        code,
        requestOTP,
        verifyOTP,
        confirmReset,
        resetWizard,
        setStep,
    };
};

export default usePasswordReset;