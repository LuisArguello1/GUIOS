import React, { useState, useRef, useCallback, memo, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
    Eye, EyeOff, Sun, Moon,
    ChevronLeft, CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';

import authService from '../../api/authService';
import Alert from '../../components/ui/Alert';
import isotipo from '../../assets/img/Isotipo.webp';
import useThemeStore from '../../app/useThemeStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getHttpErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error !== 'object' || error === null) return fallback;
    const response = (error as { response?: unknown }).response;
    if (typeof response !== 'object' || response === null) return fallback;
    const data = (response as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return fallback;
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    const errors = (data as { errors?: { new_password?: unknown } }).errors;
    const newPasswordErrors = errors?.new_password;
    if (Array.isArray(newPasswordErrors) && typeof newPasswordErrors[0] === 'string') {
        return newPasswordErrors[0];
    }
    return fallback;
};

// ─── Animaciones Suaves ───────────────────────────────────────────────────────
const formVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// ─── Componente Principal PasswordRecoveryPage (TikTok UI Style) ──────────────
const PasswordRecoveryPage = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useThemeStore();

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const codeInputs = useRef<(HTMLInputElement | null)[]>([]);

    // Validación de fortaleza de contraseña
    const passwordCriteria = useMemo(() => ({
        length: newPassword.length >= 8,
        hasUpper: /[A-Z]/.test(newPassword),
        hasLower: /[a-z]/.test(newPassword),
        hasNumber: /[0-9]/.test(newPassword),
    }), [newPassword]);

    const isPasswordStrong = useMemo(() => Object.values(passwordCriteria).every(Boolean), [passwordCriteria]);
    const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

    // ── Paso 1: Solicitar código OTP
    const handleRequestCode = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setError(null);
        setIsLoading(true);
        try {
            await authService.requestResetOTP(email.trim());
            setStep(2);
            setSuccessMessage('Código enviado. Revisa tu bandeja de entrada.');
        } catch (err: unknown) {
            setError(getHttpErrorMessage(err, 'El correo no se encuentra registrado.'));
        } finally {
            setIsLoading(false);
        }
    }, [email]);

    // ── Manejo de casillas de código
    const handleCodeChange = useCallback((index: number, value: string) => {
        if (value.length > 1) {
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            if (digits.length === 6) {
                setCode(digits);
                codeInputs.current[5]?.focus();
                return;
            }
        }
        const char = value.slice(-1);
        if (char && !/^\d$/.test(char)) return;
        const newCode = [...code];
        newCode[index] = char;
        setCode(newCode);
        if (char && index < 5) codeInputs.current[index + 1]?.focus();
    }, [code]);

    const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            const newCode = [...code];
            newCode[index - 1] = '';
            setCode(newCode);
            codeInputs.current[index - 1]?.focus();
        }
    }, [code]);

    // ── Paso 2: Verificar código OTP
    const handleVerifyCode = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');
        if (fullCode.length < 6) {
            setError('Ingresa el código completo de 6 dígitos.');
            return;
        }

        setError(null);
        setIsLoading(true);
        try {
            await authService.verifyResetOTP(email.trim(), fullCode);
            setStep(3);
            setSuccessMessage('Código verificado. Ahora define tu nueva contraseña.');
        } catch (err: unknown) {
            setError(getHttpErrorMessage(err, 'Código incorrecto o expirado.'));
        } finally {
            setIsLoading(false);
        }
    }, [email, code]);

    // ── Paso 3: Confirmar nueva contraseña
    const handleFinalReset = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isPasswordStrong) {
            setError('La contraseña debe tener mínimo 8 caracteres, mayúsculas, minúsculas y números.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setError(null);
        setIsLoading(true);
        try {
            await authService.confirmPasswordReset(email.trim(), code.join(''), {
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            setStep(4);
        } catch (err: unknown) {
            setError(getHttpErrorMessage(err, 'Error al actualizar la contraseña.'));
        } finally {
            setIsLoading(false);
        }
    }, [email, code, newPassword, confirmPassword, isPasswordStrong]);

    // Estados de habilitación de botones
    const isStep1Enabled = email.trim().length > 0 && !isLoading;
    const isStep2Enabled = code.join('').length === 6 && !isLoading;
    const isStep3Enabled = isPasswordStrong && passwordsMatch && !isLoading;

    return (
        <div className="min-h-screen w-full flex flex-col justify-between bg-[var(--color-bg-page)] text-[var(--color-text-primary)] transition-colors duration-200">
            {/* ════════════════════════════════════════
                1. HEADER SUPERIOR TIKTOK STYLE
            ════════════════════════════════════════ */}
            <header className="w-full flex items-center justify-between px-6 sm:px-10 py-4 h-16 shrink-0">
                <Link to="/" className="flex items-center gap-2.5 group select-none">
                    <div
                        className="relative inline-flex items-center justify-center shrink-0 select-none"
                        onContextMenu={(e) => e.preventDefault()}
                    >
                        <img
                            src={isotipo}
                            alt="GUIOS Logo"
                            className="h-7 w-7 sm:h-8 sm:w-8 object-contain select-none pointer-events-none transition-transform group-hover:scale-105"
                            draggable={false}
                        />
                        {/* Capa transparente de bloqueo contra click derecho y arrastre */}
                        <div
                            className="absolute inset-0 z-10 bg-transparent select-none cursor-pointer"
                            aria-hidden="true"
                            onContextMenu={(e) => e.preventDefault()}
                            onDragStart={(e) => e.preventDefault()}
                        />
                    </div>
                    <span className="text-[17px] sm:text-[19px] font-black tracking-tight text-[var(--color-text-primary)] select-none">
                        GUIOS
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex items-center justify-center w-8 h-8 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>


                </div>
            </header>

            {/* ════════════════════════════════════════
                2. CONTENIDO PRINCIPAL CENTRADO
            ════════════════════════════════════════ */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 w-full max-w-[400px] mx-auto">
                <AnimatePresence mode="wait">
                    {/* ── PASO 1: SOLICITAR CÓDIGO ── */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full space-y-6"
                        >
                            <div className="text-center space-y-1.5">
                                <h1 className="text-[28px] sm:text-[32px] font-black text-[var(--color-text-primary)] tracking-tight">
                                    Recuperar cuenta
                                </h1>
                                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                                    Ingresa tu correo electrónico registrado para enviarte un código de verificación.
                                </p>
                            </div>

                            {error && (
                                <Alert type="error" message={error} onClose={() => setError(null)} />
                            )}

                            <form onSubmit={handleRequestCode} className="space-y-4" noValidate>
                                <div>
                                    <input
                                        type="email"
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Correo electrónico registrado"
                                        className="w-full h-11 sm:h-12 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xs text-[14px] sm:text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-text-secondary)] transition-colors"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={!isStep1Enabled}
                                    className={clsx(
                                        'w-full h-11 sm:h-12 rounded-xs text-[15px] font-bold transition-all duration-150 flex items-center justify-center select-none',
                                        isStep1Enabled
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] cursor-pointer'
                                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] cursor-not-allowed'
                                    )}
                                >
                                    {isLoading ? 'Enviando código...' : 'Enviar código de verificación'}
                                </button>

                                <div className="text-center pt-2">
                                    <Link
                                        to="/login"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span>Volver al inicio de sesión</span>
                                    </Link>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* ── PASO 2: VERIFICAR CÓDIGO OTP ── */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full space-y-6"
                        >
                            <div className="text-center space-y-1.5">
                                <h1 className="text-[28px] sm:text-[32px] font-black text-[var(--color-text-primary)] tracking-tight">
                                    Ingresa el código
                                </h1>
                                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                                    Enviamos un código de 6 dígitos a <strong className="text-[var(--color-text-primary)]">{email}</strong>
                                </p>
                            </div>

                            {error && (
                                <Alert type="error" message={error} onClose={() => setError(null)} />
                            )}
                            {successMessage && (
                                <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
                            )}

                            <form onSubmit={handleVerifyCode} className="space-y-4">
                                <div className="flex justify-between gap-1.5 my-2">
                                    {code.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            ref={(el) => { codeInputs.current[idx] = el; }}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={digit}
                                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(idx, e)}
                                            autoFocus={idx === 0}
                                            className={clsx(
                                                'flex-1 min-w-0 h-12 text-center text-lg font-bold rounded-xs border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none transition-colors',
                                                digit
                                                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                                    : 'border-[var(--color-border-subtle)] focus:border-[var(--color-text-secondary)]'
                                            )}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    disabled={!isStep2Enabled}
                                    className={clsx(
                                        'w-full h-11 sm:h-12 rounded-xs text-[15px] font-bold transition-all duration-150 flex items-center justify-center select-none',
                                        isStep2Enabled
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] cursor-pointer'
                                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] cursor-not-allowed'
                                    )}
                                >
                                    {isLoading ? 'Verificando...' : 'Verificar código'}
                                </button>

                                <div className="flex items-center justify-between text-xs pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="inline-flex items-center gap-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] font-semibold transition-colors"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span>Cambiar correo</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleRequestCode}
                                        disabled={isLoading}
                                        className="text-[var(--color-primary)] hover:underline font-bold transition-colors"
                                    >
                                        Reenviar código
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* ── PASO 3: NUEVA CONTRASEÑA ── */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full space-y-6"
                        >
                            <div className="text-center space-y-1.5">
                                <h1 className="text-[28px] sm:text-[32px] font-black text-[var(--color-text-primary)] tracking-tight">
                                    Nueva contraseña
                                </h1>
                                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                                    Crea una contraseña segura para proteger tu cuenta.
                                </p>
                            </div>

                            {error && (
                                <Alert type="error" message={error} onClose={() => setError(null)} />
                            )}
                            {successMessage && (
                                <Alert type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
                            )}

                            <form onSubmit={handleFinalReset} className="space-y-3.5" noValidate>
                                <div className="relative flex items-center">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        autoFocus
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Nueva contraseña (mínimo 8 caracteres)"
                                        className="w-full h-11 sm:h-12 pl-3.5 pr-10 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xs text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-text-secondary)] transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                <div className="relative flex items-center">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirmar nueva contraseña"
                                        className="w-full h-11 sm:h-12 pl-3.5 pr-10 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xs text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-text-secondary)] transition-colors"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors p-1"
                                        aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!isStep3Enabled}
                                    className={clsx(
                                        'w-full h-11 sm:h-12 rounded-xs text-[15px] font-bold transition-all duration-150 flex items-center justify-center select-none mt-2',
                                        isStep3Enabled
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] cursor-pointer'
                                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] cursor-not-allowed'
                                    )}
                                >
                                    {isLoading ? 'Actualizando...' : 'Actualizar contraseña'}
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* ── PASO 4: ÉXITO ── */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full text-center space-y-6"
                        >
                            <div className="w-16 h-16 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success)]/20 flex items-center justify-center mx-auto">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>

                            <div className="space-y-1.5">
                                <h1 className="text-[26px] sm:text-[30px] font-black text-[var(--color-text-primary)] tracking-tight">
                                    ¡Contraseña restablecida!
                                </h1>
                                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                                    Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="w-full h-11 sm:h-12 rounded-xs text-[15px] font-bold bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] transition-all cursor-pointer select-none"
                            >
                                Iniciar sesión ahora
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* ════════════════════════════════════════
                3. SECCIÓN INFERIOR & FOOTER
            ════════════════════════════════════════ */}
            <div className="w-full border-t border-[var(--color-border-subtle)]">
                <div className="py-4 text-center text-xs sm:text-sm text-[var(--color-text-secondary)]">
                    <span>¿Recuerdas tu contraseña? </span>
                    <Link
                        to="/login"
                        className="text-[var(--color-primary)] font-bold hover:underline ml-1"
                    >
                        Iniciar sesión
                    </Link>
                </div>

                <footer className="w-full bg-[var(--color-bg-page)] border-t border-[var(--color-border-subtle)] px-6 sm:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-tertiary)]">
                    <div className="font-medium text-center sm:text-right">
                        © {new Date().getFullYear()} GUIOS
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default memo(PasswordRecoveryPage);