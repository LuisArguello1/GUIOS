import { useState, useCallback, useEffect, useRef, memo } from 'react';
import {
    Shield, ShieldAlert, Smartphone,
    CheckCircle, Lock,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import authService from '../../api/authService';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Toggle from '../../components/ui/Toggle';
import { clsx } from 'clsx';

// ─── Constantes ────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;

// ─── Tipos ─────────────────────────────────────────────────────────────────────
type TOTPConfig = { uri: string | null; is_active: boolean };
type ModalState = 'closed' | 'setup' | 'success' | 'deactivate' | 'recovery';

// ─── ActivationStep ────────────────────────────────────────────────────────────
interface ActivationStepProps {
    uri: string;
    onActivate: (code: string) => Promise<boolean>;
    isLoading: boolean;
    error: string | null;
    attemptsLeft: number;
}

const ActivationStep = ({ uri, onActivate, isLoading, error, attemptsLeft }: ActivationStepProps) => {
    const [code, setCode] = useState<string[]>(Array(6).fill(''));
    const inputs = useRef<(HTMLInputElement | null)[]>([]);

    // Foco automático al recibir un error
    useEffect(() => {
        if (error) {
            inputs.current[0]?.focus();
        }
    }, [error]);

    const handleChange = (idx: number, val: string) => {
        // Soporte para paste de 6 dígitos
        if (val.length > 1) {
            const digits = val.replace(/\D/g, '').slice(0, 6).split('');
            if (digits.length === 6) {
                setCode(digits);
                inputs.current[5]?.focus();
                return;
            }
        }
        const char = val.slice(-1);
        if (char && !/^\d$/.test(char)) return;
        const next = [...code];
        next[idx] = char;
        setCode(next);
        if (char && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[idx] && idx > 0) {
            inputs.current[idx - 1]?.focus();
        }
        if (e.key === 'ArrowLeft' && idx > 0) inputs.current[idx - 1]?.focus();
        if (e.key === 'ArrowRight' && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setCode(pasted.split(''));
            inputs.current[5]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const codeStr = code.join('');
        if (codeStr.length === 6) {
            const success = await onActivate(codeStr);
            if (!success) {
                setCode(Array(6).fill(''));
                inputs.current[0]?.focus();
            }
        }
    };

    const isFull = code.every(d => d !== '');

    return (
        <div className="flex flex-col items-center gap-5 select-none">
            {/* Encabezado */}
            <div className="text-center">
                <div className="w-10 h-10 rounded-[6px] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center mx-auto mb-2.5">
                    <Smartphone className="size-5 text-[var(--color-primary)]" />
                </div>
                <h4 className="text-[14px] font-bold text-[var(--color-text-primary)] tracking-tight mb-1">
                    Configura tu app autenticadora
                </h4>
                <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed max-w-xs mx-auto font-normal">
                    Escanea el código QR con Google Authenticator, Microsoft Authenticator o cualquier app TOTP.
                </p>
            </div>

            {/* Contenedor del QR con borde y esquinas sutiles */}
            <div className="p-3 bg-white border border-[var(--color-border-subtle)] rounded-[6px] shadow-sm">
                <QRCodeSVG value={uri} size={160} level="H" includeMargin={false} />
            </div>

            {/* Inputs de OTP */}
            <form onSubmit={handleSubmit} className="w-full space-y-4">
                <div className="text-center">
                    <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Ingresa el código de 6 dígitos
                    </label>
                    <div
                        className="flex justify-center gap-1.5 mt-2.5"
                        onPaste={handlePaste}
                    >
                        {code.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={el => { inputs.current[idx] = el; }}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={digit}
                                onChange={e => handleChange(idx, e.target.value)}
                                onKeyDown={e => handleKeyDown(idx, e)}
                                autoFocus={idx === 0}
                                className={clsx(
                                    'w-10 h-11 text-center text-lg font-black rounded-[4px] border outline-none transition-all',
                                    'bg-[var(--color-bg-secondary)] font-mono',
                                    digit
                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                        : 'border-[var(--color-border-subtle)] text-[var(--color-text-primary)]',
                                    'focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]',
                                    error && 'border-[var(--color-danger)] text-[var(--color-danger)]'
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Contador de intentos restantes */}
                {error && attemptsLeft < MAX_ATTEMPTS && (
                    <p className="text-[11px] text-[var(--color-danger-text)] font-semibold text-center">
                        {attemptsLeft > 0
                            ? `Código incorrecto · ${attemptsLeft} intento${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}`
                            : 'Demasiados intentos. Espera unos minutos.'}
                    </p>
                )}

                {error && attemptsLeft >= MAX_ATTEMPTS && (
                    <Alert type="error" message={error} />
                )}

                <Button
                    type="submit"
                    variant="primary"
                    isLoading={isLoading}
                    disabled={!isFull || isLoading}
                    className="w-full py-2.5 rounded-[4px] text-[13px] font-bold mt-1"
                >
                    Activar 2FA
                </Button>
            </form>
        </div>
    );
};

// ─── SuccessStep ───────────────────────────────────────────────────────────────
const SuccessStep = ({ onClose, codes }: { onClose: () => void, codes: string[] }) => {
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

    const handleDownloadTXT = () => {
        const text = `CÓDIGOS DE RECUPERACIÓN - GUIOS\n\nGuarda estos códigos en un lugar seguro. Solo se pueden usar una vez cada uno.\n\n${codes.join('\n')}\n\nFecha de emisión: ${new Date().toLocaleDateString()}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'guios-recovery-codes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = async () => {
        setIsDownloadingPDF(true);
        try {
            const blob = await authService.exportRecoveryCodesPDF(codes);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dvi-recovery-codes.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // Silencioso
        } finally {
            setIsDownloadingPDF(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 py-1 select-none">
            <div className="w-12 h-12 rounded-[6px] bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 flex items-center justify-center">
                <CheckCircle className="size-6 text-[var(--color-success-text)]" />
            </div>
            <div className="text-center">
                <h4 className="text-[15px] font-bold text-[var(--color-text-primary)] mb-1">
                    ¡Cuenta protegida con éxito!
                </h4>
                <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed max-w-[300px] mx-auto mb-2 font-normal">
                    El doble factor ha sido activado. <span className="font-bold text-[var(--color-text-primary)]">Descarga tus códigos de respaldo</span> para poder acceder si extravías tu app autenticadora.
                </p>
            </div>

            {/* Lista de códigos */}
            <div className="w-full grid grid-cols-2 gap-2 p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[6px] font-mono text-[11px] text-[var(--color-text-primary)]">
                {codes.map((c, i) => (
                    <div key={i} className="bg-[var(--color-bg-elevated)] px-2 py-1.5 rounded-[4px] border border-[var(--color-border-subtle)] text-center font-bold">
                        {c}
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-2 w-full mt-2">
                {codes.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="secondary"
                            onClick={handleDownloadTXT}
                            className="w-full py-2 rounded-[4px] text-[12px] font-bold"
                        >
                            Descargar TXT
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleDownloadPDF}
                            isLoading={isDownloadingPDF}
                            className="w-full py-2 rounded-[4px] text-[12px] font-bold"
                        >
                            Descargar PDF
                        </Button>
                    </div>
                )}
                <Button
                    variant="primary"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-[4px] text-[13px] font-bold"
                >
                    He guardado mis códigos
                </Button>
            </div>
        </div>
    );
};

// ─── Componente Principal ──────────────────────────────────────────────────────
const TwoFactorSettings = () => {
    const [isActive, setIsActive] = useState(false);
    const [config, setConfig] = useState<TOTPConfig | null>(null);

    const [modal, setModal] = useState<ModalState>('closed');

    const [activateError, setActivateError]       = useState<string | null>(null);
    const [deactivateError, setDeactivateError]   = useState<string | null>(null);
    const [attemptsLeft, setAttemptsLeft]         = useState<number>(MAX_ATTEMPTS);

    const [isLoading, setIsLoading]               = useState(false);
    const [deactivatePassword, setDeactivatePassword] = useState('');
    const [recoveryCodes, setRecoveryCodes]           = useState<string[]>([]);
    const [showDeactivatePwd, setShowDeactivatePwd]   = useState(false);

    const fetchConfig = useCallback(async () => {
        try {
            const data = await authService.getTOTPConfig();
            setConfig(data);
            setIsActive(data.is_active);
        } catch {
            // Silencioso
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => fetchConfig(), 0);
        return () => clearTimeout(t);
    }, [fetchConfig]);

    const closeModal = useCallback(() => {
        setModal('closed');
        setActivateError(null);
        setDeactivateError(null);
        setDeactivatePassword('');
        setShowDeactivatePwd(false);
        setAttemptsLeft(MAX_ATTEMPTS);
    }, []);

    const handleToggle = useCallback(async () => {
        if (!isActive) {
            if (!config?.uri) {
                setIsLoading(true);
                try {
                    const data = await authService.getTOTPConfig();
                    setConfig(data);
                } catch {
                    return;
                } finally {
                    setIsLoading(false);
                }
            }
            setModal('setup');
        } else {
            setModal('deactivate');
        }
    }, [isActive, config?.uri]);

    const handleActivate = useCallback(async (code: string) => {
        setIsLoading(true);
        setActivateError(null);
        try {
            const response = await authService.activateTOTP(code);
            setIsActive(true);
            setConfig(prev => prev ? { ...prev, uri: null } : null);
            
            if (response.recovery_codes) {
                setRecoveryCodes(response.recovery_codes);
            }
            
            setModal('success');
            return true;
        } catch (err: unknown) {
            const errorData = (err as { response?: { data?: { attempts_left?: number; detail?: string } } }).response?.data;
            const remaining = errorData?.attempts_left;
            if (typeof remaining === 'number') setAttemptsLeft(remaining);
            else setAttemptsLeft(prev => Math.max(0, prev - 1));
            setActivateError(errorData?.detail || 'Código inválido. Revisa tu app.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleDeactivate = useCallback(async () => {
        if (!deactivatePassword.trim()) {
            setDeactivateError('Ingresa tu contraseña para continuar.');
            return;
        }
        setIsLoading(true);
        setDeactivateError(null);
        try {
            await authService.deactivateTOTP(deactivatePassword);
            setIsActive(false);
            const data = await authService.getTOTPConfig();
            setConfig(data);
            closeModal();
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
            setDeactivateError(detail || 'Contraseña incorrecta.');
        } finally {
            setIsLoading(false);
        }
    }, [deactivatePassword, closeModal]);

    const handleRegenerate = useCallback(async () => {
        if (!deactivatePassword.trim()) {
            setDeactivateError('Ingresa tu contraseña para continuar.');
            return;
        }
        setIsLoading(true);
        setDeactivateError(null);
        try {
            const response = await authService.regenerateTOTPCodes(deactivatePassword);
            if (response.recovery_codes) {
                setRecoveryCodes(response.recovery_codes);
                setModal('success');
            }
        } catch (err: unknown) {
            const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
            setDeactivateError(detail || 'Contraseña incorrecta.');
        } finally {
            setIsLoading(false);
        }
    }, [deactivatePassword]);

    return (
        <div className="space-y-4 select-none">
            {/* Card principal */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] overflow-hidden">
                <div className="px-4 py-3 bg-[var(--color-bg-secondary)]/40 border-b border-[var(--color-border-subtle)] flex items-center gap-2">
                    <Shield
                        className={clsx('size-4', isActive ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]')}
                    />
                    <span className="text-[11px] font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                        Seguridad de la cuenta
                    </span>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h3 className="text-[14px] font-bold text-[var(--color-text-primary)]">
                                Autenticación de dos pasos (2FA)
                            </h3>
                            <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                                Protege tu cuenta exigiendo un código temporal de 6 dígitos cada vez que inicies sesión.
                            </p>
                        </div>
                        <Toggle
                            checked={isActive}
                            onChange={handleToggle}
                            disabled={isLoading}
                        />
                    </div>

                    {isActive && (
                        <>
                            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--color-success-bg)] border border-[var(--color-success)]/20 rounded-[6px]">
                                <CheckCircle className="size-4 text-[var(--color-success-text)] shrink-0" />
                                <span className="text-[12px] font-semibold text-[var(--color-success-text)]">
                                    Tu cuenta se encuentra actualmente protegida con 2FA.
                                </span>
                            </div>

                            <div className="pt-4 border-t border-[var(--color-border-subtle)] space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-[13px] font-bold text-[var(--color-text-primary)]">Códigos de respaldo</h4>
                                        <p className="text-[11.5px] text-[var(--color-text-tertiary)]">Si pierdes el acceso a tu app, usa estos códigos de emergencia.</p>
                                    </div>
                                    <Button 
                                        variant="secondary" 
                                        size="sm"
                                        onClick={() => setModal('recovery')}
                                        className="h-8 rounded-[4px] px-3 text-[12px] font-bold"
                                    >
                                        Regenerar
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modal: Activación / Éxito ── */}
            <Modal
                isOpen={modal === 'setup' || modal === 'success'}
                onClose={() => !isLoading && closeModal()}
                title={modal === 'success' ? '¡2FA Activado!' : 'Activar verificación en dos pasos'}
                size="sm"
            >
                {modal === 'success' ? (
                    <SuccessStep onClose={closeModal} codes={recoveryCodes} />
                ) : (
                    config?.uri && (
                        <ActivationStep
                            uri={config.uri}
                            onActivate={handleActivate}
                            isLoading={isLoading}
                            error={activateError}
                            attemptsLeft={attemptsLeft}
                        />
                    )
                )}
            </Modal>

            {/* ── Modal: Desactivar / Regenerar ── */}
            <Modal
                isOpen={modal === 'deactivate' || modal === 'recovery'}
                onClose={() => !isLoading && closeModal()}
                title={modal === 'deactivate' ? "Desactivar 2FA" : "Regenerar códigos"}
                size="sm"
                footer={
                    <div className="flex gap-2 w-full">
                        <Button
                            variant="secondary"
                            className="flex-1 h-9 rounded-[4px]"
                            onClick={closeModal}
                            disabled={isLoading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant={modal === 'deactivate' ? "danger" : "primary"}
                            className="flex-1 h-9 rounded-[4px] font-bold"
                            onClick={modal === 'deactivate' ? handleDeactivate : handleRegenerate}
                            isLoading={isLoading}
                            disabled={!deactivatePassword.trim()}
                        >
                            {modal === 'deactivate' ? "Desactivar" : "Regenerar"}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {/* Aviso */}
                    <div className={clsx(
                        "flex gap-3 p-3 rounded-[6px] border",
                        modal === 'deactivate' 
                            ? "bg-[var(--color-warning-bg)] border-[var(--color-warning)]/25 text-[var(--color-warning-text)]"
                            : "bg-[var(--color-info-bg)] border-[var(--color-info)]/25 text-[var(--color-info-text)]"
                    )}>
                        {modal === 'deactivate' ? (
                             <ShieldAlert className="size-4 text-[var(--color-warning-text)] shrink-0 mt-0.5" />
                        ) : (
                             <Lock className="size-4 text-[var(--color-info-text)] shrink-0 mt-0.5" />
                        )}
                        <div>
                            <p className="text-[12px] font-bold mb-0.5">
                                {modal === 'deactivate' ? "Atención" : "Seguridad"}
                            </p>
                            <p className="text-[11.5px] leading-relaxed opacity-90">
                                {modal === 'deactivate' 
                                    ? "Estás a punto de reducir la seguridad de tu cuenta. Confirma tu contraseña para continuar."
                                    : "Se generarán nuevos códigos de respaldo y los anteriores quedarán invalidados inmediatamente."}
                            </p>
                        </div>
                    </div>

                    {/* Input contraseña */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                            Contraseña actual
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-tertiary)]" />
                            <input
                                type={showDeactivatePwd ? 'text' : 'password'}
                                value={deactivatePassword}
                                onChange={e => {
                                    setDeactivatePassword(e.target.value);
                                    setDeactivateError(null);
                                }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (modal === 'deactivate') {
                                            void handleDeactivate();
                                        } else {
                                            void handleRegenerate();
                                        }
                                    }
                                }}
                                placeholder="Ingresa tu contraseña"
                                autoComplete="current-password"
                                className={clsx(
                                    'w-full pl-9 pr-10 h-10 rounded-[4px] border text-[13px] outline-none transition-colors',
                                    'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
                                    'focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]',
                                    deactivateError ? 'border-[var(--color-danger)]' : 'border-[var(--color-border-subtle)]'
                                )}
                            />
                            {/* Toggle mostrar contraseña */}
                            <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setShowDeactivatePwd(p => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                            >
                                {showDeactivatePwd ? (
                                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                        <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                ) : (
                                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {deactivateError && <Alert type="error" message={deactivateError} />}
                </div>
            </Modal>
        </div>
    );
};

export default memo(TwoFactorSettings);