import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
    Eye, EyeOff, Sun, Moon,
    ChevronLeft, KeyRound,
} from 'lucide-react';
import { clsx } from 'clsx';

import useAuthStore from '../../app/useAuthStore';
import authService from '../../api/authService';
import Alert from '../../components/ui/Alert';
import isotipo from '../../assets/img/Isotipo.webp';
import useCoreStore from '../../app/useCoreStore';
import useThemeStore from '../../app/useThemeStore';
import ScientificPhysicsLab from './components/ScientificPhysicsLab';

// ─── Animaciones ──────────────────────────────────────────────────────────────
const formVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// ─── Componente Principal LoginPage (TikTok UI Style) ─────────────────────────
const LoginPage = () => {
    const navigate = useNavigate();
    const loginSuccess = useAuthStore((state) => state.loginSuccess);
    const { fetchOrganization, loadingOrg, organizationLoaded } = useCoreStore();
    const { theme, toggleTheme } = useThemeStore();

    // Campos de formulario
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Estado 2FA
    const [step, setStep] = useState<1 | 2>(1);
    const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
    const [code, setCode] = useState<string[]>(Array(6).fill(''));
    const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
    const [useRecoveryCode, setUseRecoveryCode] = useState(false);
    const [recoveryCodeInput, setRecoveryCodeInput] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!organizationLoaded && !loadingOrg) {
            fetchOrganization().catch(() => { });
        }
    }, [organizationLoaded, loadingOrg, fetchOrganization]);

    // ── Paso 1: Enviar credenciales
    const handleLogin = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!email.trim() || !password) return;

        setError(null);
        setIsLoading(true);
        try {
            const data = await authService.login(email.trim(), password);
            if (data.requires_2fa) {
                setPreAuthToken(data.pre_auth_token || null);
                setStep(2);
                setIsLoading(false);
                return;
            }
            const { requires_selection } = loginSuccess(data);
            navigate(requires_selection ? '/select-role' : '/dashboard');
        } catch (err: unknown) {
            let msg = 'Usuario o contraseña incorrectos.';
            if (typeof err === 'object' && err !== null) {
                const e = err as { response?: { data?: { detail?: string; message?: string } }; request?: unknown; message?: string };
                if (e.response) msg = e.response.data?.detail || e.response.data?.message || msg;
                else if (e.request) msg = 'Error de conexión con el servidor.';
            }
            setError(msg);
            setIsLoading(false);
        }
    }, [email, password, loginSuccess, navigate]);

    // ── Paso 2: Verificar TOTP
    const handleVerifyCode = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!preAuthToken) return;

        let otpString = '';
        if (useRecoveryCode) {
            otpString = recoveryCodeInput.trim();
            if (!otpString) {
                setError('Ingresa tu código de recuperación.');
                return;
            }
        } else {
            otpString = code.join('');
            if (otpString.length < 6) {
                setError('Ingresa el código de 6 dígitos.');
                return;
            }
        }

        setError(null);
        setIsLoading(true);
        try {
            const data = await authService.verify2FA(preAuthToken, otpString);
            const { requires_selection } = loginSuccess(data);
            navigate(requires_selection ? '/select-role' : '/dashboard');
        } catch (err: unknown) {
            let msg = 'Código de verificación incorrecto.';
            if (typeof err === 'object' && err !== null) {
                const e = err as { response?: { data?: { detail?: string } } };
                if (e.response?.data?.detail) msg = e.response.data.detail;
            }
            setError(msg);
            setIsLoading(false);
        }
    }, [preAuthToken, code, useRecoveryCode, recoveryCodeInput, loginSuccess, navigate]);

    // ── OTP Handlers
    const handleCodeChange = (idx: number, val: string) => {
        if (val.length > 1) {
            const digits = val.replace(/\D/g, '').slice(0, 6).split('');
            if (digits.length === 6) {
                setCode(digits);
                codeInputs.current[5]?.focus();
                return;
            }
        }
        const char = val.slice(-1);
        if (char && !/^\d$/.test(char)) return;
        const newCode = [...code];
        newCode[idx] = char;
        setCode(newCode);
        if (char && idx < 5) codeInputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[idx] && idx > 0) codeInputs.current[idx - 1]?.focus();
        if (e.key === 'Enter' && (useRecoveryCode || code.every(d => d !== ''))) handleVerifyCode();
    };

    // Determinar si el botón debe estar activo (estilo TikTok)
    const isLoginEnabled = email.trim().length > 0 && password.length > 0 && !isLoading;
    const is2FAEnabled = (useRecoveryCode ? recoveryCodeInput.trim().length > 0 : code.join('').length === 6) && !isLoading;

    return (
        <div className="min-h-screen md:h-screen md:max-h-screen w-full flex flex-col justify-between bg-[var(--color-bg-page)] text-[var(--color-text-primary)] transition-colors duration-200 md:overflow-hidden">
            {/* ════════════════════════════════════════
                1. HEADER SUPERIOR TIKTOK STYLE
            ════════════════════════════════════════ */}
            <header className="w-full flex items-center justify-between px-6 sm:px-10 py-3 sm:py-4 h-14 sm:h-16 shrink-0">
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
                2. CONTENIDO DIVIDIDO: TEXTO TÉCNICO CON FÍSICAS + FORMULARIO
            ════════════════════════════════════════ */}
            <div className="flex-1 flex flex-col md:flex-row items-stretch w-full min-h-0 overflow-hidden">
                <div className="w-full md:w-[54%] lg:w-[58%] flex border-b md:border-b-0 md:border-r border-[var(--color-border-subtle)] min-h-0 overflow-hidden">
                    <ScientificPhysicsLab />
                </div>

                <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 w-full max-w-[400px] mx-auto min-h-0 overflow-y-auto md:overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* ── PASO 1: LOGIN (EMAIL + PASSWORD) ── */}
                    {step === 1 && (
                        <motion.div
                            key="login-step"
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full space-y-6"
                        >
                            {/* Título Principal */}
                            <h1 className="text-[28px] sm:text-[32px] font-black text-center text-[var(--color-text-primary)] tracking-tight">
                                Iniciar sesión
                            </h1>

                            {/* Subcabecera / Selector de tipo */}
                            <div className="flex items-center justify-between text-xs font-semibold border-b border-[var(--color-border-subtle)] pb-2.5">
                                <span className="text-[var(--color-text-primary)] border-b-2 border-[var(--color-text-primary)] pb-2.5 -mb-2.5">
                                    Correo electrónico / Usuario
                                </span>
                                <Link
                                    to="/recuperar-contrasena"
                                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>

                            {/* Alerta de Error */}
                            {error && (
                                <Alert type="error" message={error} onClose={() => setError(null)} />
                            )}

                            {/* Formulario */}
                            <form onSubmit={handleLogin} className="space-y-3" noValidate>
                                {/* Input: Email / Usuario */}
                                <div>
                                    <input
                                        type="text"
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Correo electrónico o nombre de usuario"
                                        className="w-full h-11 sm:h-12 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xs text-[14px] sm:text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-text-secondary)] transition-colors"
                                    />
                                </div>

                                {/* Input: Contraseña */}
                                <div className="relative flex items-center">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Contraseña"
                                        className="w-full h-11 sm:h-12 pl-3.5 pr-10 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xs text-[14px] sm:text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-text-secondary)] transition-colors"
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

                                {/* Botón de Iniciar Sesión (TikTok Style) */}
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={!isLoginEnabled}
                                        className={clsx(
                                            'w-full h-11 sm:h-12 rounded-xs text-[15px] font-bold transition-all duration-150 flex items-center justify-center select-none',
                                            isLoginEnabled
                                                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] cursor-pointer shadow-sm'
                                                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] cursor-not-allowed'
                                        )}
                                    >
                                        {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}

                    {/* ── PASO 2: VERIFICACIÓN 2FA (TIKTOK STYLE) ── */}
                    {step === 2 && (
                        <motion.div
                            key="2fa-step"
                            variants={formVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="w-full space-y-6"
                        >
                            <h1 className="text-[26px] sm:text-[30px] font-black text-center text-[var(--color-text-primary)] tracking-tight">
                                Verificación de 2 pasos
                            </h1>

                            <div className="flex items-center justify-between text-xs font-semibold border-b border-[var(--color-border-subtle)] pb-2.5">
                                <span className="text-[var(--color-text-primary)]">
                                    {useRecoveryCode ? 'Código de recuperación' : 'Ingresa el código de 6 dígitos'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => { setUseRecoveryCode(!useRecoveryCode); setError(null); }}
                                    className="text-[var(--color-primary)] hover:underline font-semibold"
                                >
                                    {useRecoveryCode ? 'Usar App de autenticación' : '¿Problemas con el código?'}
                                </button>
                            </div>

                            {error && (
                                <Alert type="error" message={error} onClose={() => setError(null)} />
                            )}

                            <form onSubmit={handleVerifyCode} className="space-y-4">
                                {!useRecoveryCode ? (
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
                                ) : (
                                    <div className="relative flex items-center">
                                        <KeyRound className="absolute left-3.5 w-4 h-4 text-[var(--color-text-tertiary)] pointer-events-none" />
                                        <input
                                            type="text"
                                            value={recoveryCodeInput}
                                            onChange={(e) => setRecoveryCodeInput(e.target.value)}
                                            placeholder="Ingresa código de respaldo"
                                            autoFocus
                                            className="w-full h-11 sm:h-12 pl-10 pr-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xs text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-text-secondary)] transition-colors"
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={!is2FAEnabled}
                                    className={clsx(
                                        'w-full h-11 sm:h-12 rounded-xs text-[15px] font-bold transition-all duration-150 flex items-center justify-center select-none',
                                        is2FAEnabled
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)] cursor-pointer'
                                            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] cursor-not-allowed'
                                    )}
                                >
                                    {isLoading ? 'Verificando...' : 'Verificar e iniciar sesión'}
                                </button>

                                <div className="text-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span>Volver al inicio de sesión</span>
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
                </main>
            </div>

            {/* ════════════════════════════════════════
                3. SECCIÓN DE ACCESO / RECUPERACIÓN & FOOTER
            ════════════════════════════════════════ */}
            <div className="w-full border-t border-[var(--color-border-subtle)] shrink-0 bg-[var(--color-bg-page)]">
                {/* Fila de Ayuda / Recuperación */}
                <div className="py-3 text-center text-xs sm:text-sm text-[var(--color-text-secondary)]">
                    <span>¿Problemas para acceder a tu cuenta? </span>
                    <Link
                        to="/recuperar-contrasena"
                        className="text-[var(--color-primary)] font-bold hover:underline ml-1"
                    >
                        Recuperar acceso
                    </Link>
                </div>

            </div>
        </div>
    );
};

export default memo(LoginPage);