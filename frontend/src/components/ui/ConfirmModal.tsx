import React, { memo } from 'react';
import Modal from './Modal';
import Button from './Button';
import { clsx } from 'clsx';
import { AlertTriangle, Trash2, Info, AlertCircle, Shield, type LucideIcon } from 'lucide-react';

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'primary';

interface VariantConfig {
    icon: LucideIcon;
    iconBg: string;
    iconText: string;
    accentBg: string;
    accentText: string;
    accentBorder: string;
}

const variantMap: Record<ConfirmVariant, VariantConfig> = {
    danger: {
        icon: Trash2,
        iconBg: 'bg-[var(--color-danger-bg)]',
        iconText: 'text-[var(--color-danger-text)]',
        accentBg: 'bg-[var(--color-danger-bg)]',
        accentText: 'text-[var(--color-danger-text)]',
        accentBorder: 'border-[var(--color-danger)]/20',
    },
    warning: {
        icon: AlertTriangle,
        iconBg: 'bg-[var(--color-warning-bg)]',
        iconText: 'text-[var(--color-warning-text)]',
        accentBg: 'bg-[var(--color-warning-bg)]',
        accentText: 'text-[var(--color-warning-text)]',
        accentBorder: 'border-[var(--color-warning)]/20',
    },
    info: {
        icon: Info,
        iconBg: 'bg-[var(--color-info-bg)]',
        iconText: 'text-[var(--color-info-text)]',
        accentBg: 'bg-[var(--color-info-bg)]',
        accentText: 'text-[var(--color-info-text)]',
        accentBorder: 'border-[var(--color-info)]/20',
    },
    primary: {
        icon: Shield,
        iconBg: 'bg-[var(--color-primary)]/10',
        iconText: 'text-[var(--color-primary)]',
        accentBg: 'bg-[var(--color-primary)]/8',
        accentText: 'text-[var(--color-primary)]',
        accentBorder: 'border-[var(--color-primary)]/20',
    },
};

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    isLoading?: boolean;
    children?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'danger',
    isLoading = false,
    children,
}) => {
    const cfg = variantMap[variant] ?? variantMap.danger;
    const Icon = cfg.icon;

    /* ── Botones del footer ── */
    const footer = (
        <div className="flex gap-2 w-full">
            {/* Cancelar */}
            <Button
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 h-9 rounded-[4px] border-[var(--color-border-subtle)] text-[13px]"
            >
                {cancelText}
            </Button>

            {/* Confirmar */}
            <Button
                variant={variant}
                onClick={onConfirm}
                isLoading={isLoading}
                className="flex-1 h-9 rounded-[4px] border-transparent text-[13px] font-bold"
            >
                {confirmText}
            </Button>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer} size="sm">
            <div className="space-y-4 py-1">
                {/* Ícono + Mensaje */}
                <div className="flex items-start gap-3">
                    <div
                        className={clsx(
                            'w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0 border border-current/10',
                            cfg.iconBg,
                            cfg.iconText,
                        )}
                    >
                        <Icon size={16} strokeWidth={2} aria-hidden="true" />
                    </div>

                    <div className="flex-1 pt-0.5 min-w-0 w-full">
                        {message && (
                            <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed font-medium">
                                {message}
                            </p>
                        )}
                        {children}
                    </div>
                </div>

                {/* Aviso destructivo — solo para danger */}
                {variant === 'danger' && (
                    <div
                        className={clsx(
                            'flex items-center gap-2 px-3 py-2',
                            'rounded-[4px]',
                            'border',
                            cfg.accentBg,
                            cfg.accentBorder,
                        )}
                    >
                        <AlertCircle
                            size={14}
                            className={clsx('shrink-0', cfg.accentText)}
                            aria-hidden="true"
                        />
                        <span
                            className={clsx(
                                'text-[11px] font-semibold leading-snug',
                                cfg.accentText,
                            )}
                        >
                            Esta acción es permanente y no se puede revertir.
                        </span>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default memo(ConfirmModal);