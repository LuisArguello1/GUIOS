import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Smartphone, ArrowRight } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import authService from '../../api/authService';
import useAuthStore from '../../app/useAuthStore';
import { clsx } from 'clsx';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
    const logout = useAuthStore(state => state.logout);
    
    // States
    const [isLoading, setIsLoading] = useState(false);
    const [isChecking2FA, setIsChecking2FA] = useState(true);
    const [has2FA, setHas2FA] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [error, setError] = useState<string | null>(null);

    // Form inputs
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // 2FA OTP state (Array of 6 digits)
    const [otpCode, setOtpCode] = useState<string[]>(Array(6).fill(''));
    const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

    // UI Helpers
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [strength, setStrength] = useState(0);

    // ── Pre-check 2FA ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) {
            const check2FA = async () => {
                setIsChecking2FA(true);
                try {
                    const config = await authService.getTOTPConfig();
                    setHas2FA(config.is_active);
                } catch (err) {
                    console.error("Error al verificar 2FA:", err);
                } finally {
                    setIsChecking2FA(false);
                }
            };
            check2FA();
        } else {
            // Reset state when closing
            const t = setTimeout(() => {
                setStep('form');
                setOldPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setOtpCode(Array(6).fill(''));
                setError(null);
                setStrength(0);
            }, 0);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    // ── OTP Handling Logic ───────────────────────────────────────────────────
    const handleOtpChange = (idx: number, val: string) => {
        if (val.length > 1) {
            const digits = val.replace(/\D/g, '').slice(0, 6).split('');
            if (digits.length === 6) {
                setOtpCode(digits);
                otpInputs.current[5]?.focus();
                return;
            }
        }
        const char = val.slice(-1);
        if (char && !/^\d$/.test(char)) return;
        const next = [...otpCode];
        next[idx] = char;
        setOtpCode(next);
        if (char && idx < 5) otpInputs.current[idx + 1]?.focus();
    };

    const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
            otpInputs.current[idx - 1]?.focus();
        }
        if (e.key === 'ArrowLeft' && idx > 0) otpInputs.current[idx - 1]?.focus();
        if (e.key === 'ArrowRight' && idx < 5) otpInputs.current[idx + 1]?.focus();
    };

    const handleOtpPaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setOtpCode(pasted.split(''));
            otpInputs.current[5]?.focus();
        }
    };

    // ── Password Strength Logic ──────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => {
            if (!newPassword) {
                setStrength(0);
                return;
            }
            let s = 0;
            if (newPassword.length >= 8) s += 1;
            if (/[A-Z]/.test(newPassword)) s += 1;
            if (/[0-9]/.test(newPassword)) s += 1;
            if (/[^A-Za-z0-9]/.test(newPassword)) s += 1;
            setStrength(s);
        }, 0);
        return () => clearTimeout(t);
    }, [newPassword]);

    const getStrengthLabel = () => {
        if (strength === 0) return '';
        if (strength === 1) return 'Muy débil';
        if (strength === 2) return 'Aceptable';
        if (strength === 3) return 'Fuerte';
        return 'Excelente';
    };

    const getStrengthColor = () => {
        if (strength <= 1) return 'bg-rose-500';
        if (strength === 2) return 'bg-amber-500';
        if (strength === 3) return 'bg-emerald-500';
        return 'bg-blue-500';
    };

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError('Las nuevas contraseñas no coinciden.');
            return;
        }

        if (strength < 4) {
            setError('La nueva contraseña debe ser Excelente para ser aceptada.');
            return;
        }

        const otpStr = otpCode.join('');
        if (has2FA && otpStr.length !== 6) {
            setError('Ingresa el código 2FA de 6 dígitos.');
            return;
        }

        setIsLoading(true);
        try {
            await authService.changePassword({
                old_password: oldPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
                otp_code: has2FA ? otpStr : undefined
            });
            setStep('success');
        } catch (err: unknown) {
            const errorResponse = (err as { response?: { data?: { detail?: string | string[]; old_password?: string | string[]; otp_code?: string | string[] } } }).response?.data;
            let detail = errorResponse?.detail 
                || errorResponse?.old_password 
                || errorResponse?.otp_code 
                || 'Error al cambiar la contraseña. Revisa los datos.';
            
            if (Array.isArray(detail)) detail = detail[0];
            setError(detail);
            
            if (has2FA) {
                setOtpCode(Array(6).fill(''));
                otpInputs.current[0]?.focus();
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinalLogout = () => {
        logout();
    };

    // CSS Classes (iOS Settings style compatibles con ProfilePage)
    const inputCls = clsx(
        "w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-[12px]",
        "px-4 py-3 text-[14px] font-medium text-[var(--color-text-primary)] outline-none",
        "focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(43,76,126,0.1)] transition-all",
        "placeholder:text-[var(--color-text-tertiary)]"
    );
    const labelCls = "text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider ml-1";

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={step === 'form' ? "Seguridad: Contraseña" : "¡Éxito!"}
            size="sm"
        >
            <AnimatePresence mode="wait">
                {step === 'form' ? (
                    <motion.form 
                        key="form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onSubmit={handleSubmit}
                        className="space-y-5 py-2"
                    >
                        {/* Info Banner */}
                        <div className="bg-[var(--color-warning-bg)] border border-[#fde68a] dark:border-[var(--color-warning)]/20 rounded-[14px] p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-[var(--color-warning-text)] shrink-0" />
                            <p className="text-[12px] text-[var(--color-warning-text)] leading-relaxed">
                                Por seguridad, tras el cambio se cerrarán **todas** las sesiones activas y deberás iniciar sesión nuevamente.
                            </p>
                        </div>

                        {/* Current Password */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Contraseña Actual</label>
                            <div className="relative">
                                <input 
                                    type={showOld ? "text" : "password"}
                                    value={oldPassword}
                                    onChange={(e) => setOldPassword(e.target.value)}
                                    className={inputCls}
                                    placeholder="Confirmar identidad"
                                    required
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowOld(!showOld)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                    {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div className="space-y-1.5 pt-2 border-t border-[var(--color-border-subtle)]">
                            <label className={labelCls}>Nueva Contraseña</label>
                            <div className="relative">
                                <input 
                                    type={showNew ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className={inputCls}
                                    placeholder="Mínimo 8 caracteres"
                                    required
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>

                            {/* Strength Bar */}
                            {newPassword && (
                                <div className="space-y-1.5 mt-2 px-1">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                        <span className="text-[var(--color-text-tertiary)]">Seguridad:</span>
                                        <span className={strength <= 1 ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}>
                                            {getStrengthLabel()}
                                        </span>
                                    </div>
                                    <div className="flex gap-1.5 h-1">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div 
                                                key={i} 
                                                className={clsx(
                                                    "flex-1 rounded-full transition-all duration-500",
                                                    i <= strength ? getStrengthColor() : 'bg-[var(--color-border-subtle)]'
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm New Password */}
                        <div className="space-y-1.5">
                            <label className={labelCls}>Confirmar Nueva Contraseña</label>
                            <input 
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={inputCls}
                                placeholder="Repetir nueva clave"
                                required
                            />
                        </div>

                        {/* 2FA Section (Conditional) */}
                        {has2FA && (
                            <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="space-y-4 pt-4 border-t border-dashed border-[var(--color-border-subtle)]"
                            >
                                <div className="text-center">
                                    <label className="text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                                        Ingresa el código 2FA generado
                                    </label>
                                    <div
                                        className="flex justify-center gap-2 mt-3"
                                        onPaste={handleOtpPaste}
                                    >
                                        {otpCode.map((digit, idx) => (
                                            <input
                                                key={idx}
                                                ref={el => { otpInputs.current[idx] = el; }}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={6}
                                                value={digit}
                                                onChange={e => handleOtpChange(idx, e.target.value)}
                                                onKeyDown={e => handleOtpKeyDown(idx, e)}
                                                className={clsx(
                                                    'w-10 h-12 text-center text-xl font-extrabold rounded-[10px] border-2 outline-none transition-all',
                                                    'bg-[var(--color-bg-secondary)]',
                                                    digit
                                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-info-bg)]'
                                                        : 'border-[var(--color-border-default)] text-[var(--color-text-primary)]',
                                                    error && error.includes('2FA') && 'border-[var(--color-danger)]'
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-3 italic flex items-center justify-center gap-1">
                                        <Smartphone size={10} /> Usa tu app autenticadora
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] p-3.5 rounded-xl text-[13px] font-medium flex gap-3 items-center border border-[var(--color-danger)]/10"
                            >
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            variant="primary"
                            isLoading={isLoading}
                            disabled={isChecking2FA || strength < 4 || newPassword !== confirmPassword}
                            className="w-full h-11 rounded-xl text-[14px]"
                            icon={ArrowRight}
                            iconPlacement="right"
                        >
                            Actualizar Contraseña
                        </Button>
                    </motion.form>
                ) : (
                    <motion.div 
                        key="success"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="py-6 flex flex-col items-center text-center space-y-6"
                    >
                        <div className="relative">
                            <div className="absolute inset-0 bg-[var(--color-success)] blur-2xl opacity-10 animate-pulse" />
                            <CheckCircle2 className="w-20 h-20 text-[var(--color-success)] relative" />
                        </div>
                        
                        <div className="space-y-2">
                            <h3 className="text-[18px] font-bold text-[var(--color-text-primary)] tracking-tight">Cambio con éxito</h3>
                            <p className="text-[var(--color-text-secondary)] text-[13.5px] leading-relaxed max-w-[280px] mx-auto px-2">
                                Tu seguridad ha sido actualizada. Por favor, inicia sesión de nuevo con tus nuevas credenciales.
                            </p>
                        </div>

                        <Button
                            onClick={handleFinalLogout}
                            className="w-full h-11 rounded-xl"
                            icon={ArrowRight}
                            iconPlacement="right"
                        >
                            Ir al Inicio de Sesión
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </Modal>
    );
};

export default ChangePasswordModal;
