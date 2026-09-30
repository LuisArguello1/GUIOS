import React, { memo } from 'react';
import { clsx } from 'clsx';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
    type?: AlertType;
    title?: string;
    message: string;
    onClose?: () => void;
    className?: string;
}

interface VariantConfig {
    bg: string;
    border: string;
    text: string;
    icon: React.ElementType;
}

const variants: Record<AlertType, VariantConfig> = {
    info: {
        bg:     'bg-[var(--color-info-bg)]',
        border: 'border-[var(--color-info)]/25',
        text:   'text-[var(--color-info-text)]',
        icon:   Info,
    },
    success: {
        bg:     'bg-[var(--color-success-bg)]',
        border: 'border-[var(--color-success)]/25',
        text:   'text-[var(--color-success-text)]',
        icon:   CheckCircle2,
    },
    warning: {
        bg:     'bg-[var(--color-warning-bg)]',
        border: 'border-[var(--color-warning)]/25',
        text:   'text-[var(--color-warning-text)]',
        icon:   AlertTriangle,
    },
    error: {
        bg:     'bg-[var(--color-danger-bg)]',
        border: 'border-[var(--color-danger)]/25',
        text:   'text-[var(--color-danger-text)]',
        icon:   AlertCircle,
    },
};

const Alert: React.FC<AlertProps> = ({
    type      = 'info',
    title,
    message,
    onClose,
    className,
}) => {
    const cfg  = variants[type] ?? variants.info;
    const Icon = cfg.icon;

    return (
        <div
            role="alert"
            className={clsx(
                'flex items-start gap-3 px-3.5 py-3',
                'border rounded-[6px]',
                'transition-all duration-[var(--transition-base)]',
                'animate-in fade-in slide-in-from-top-1 duration-150',
                cfg.bg,
                cfg.border,
                cfg.text,
                className
            )}
        >
            <Icon
                size={16}
                strokeWidth={2.2}
                className="shrink-0 mt-0.5"
                aria-hidden="true"
            />

            <div className="flex-1 min-w-0">
                {title && (
                    <p className="text-[11px] font-bold uppercase tracking-wider leading-none mb-1">
                        {title}
                    </p>
                )}
                <p className="text-xs leading-relaxed font-medium">
                    {message}
                </p>
            </div>

            {onClose && (
                <button
                    onClick={onClose}
                    aria-label="Cerrar alerta"
                    className={clsx(
                        'shrink-0 p-1 rounded-[4px]',
                        'opacity-60 hover:opacity-100',
                        'transition-opacity duration-[var(--transition-fast)]',
                        'focus:outline-none focus-visible:ring-1 focus-visible:ring-current cursor-pointer'
                    )}
                >
                    <X size={14} strokeWidth={2} />
                </button>
            )}
        </div>
    );
};

export default memo(Alert);