import React, { useEffect, useRef, useState, memo } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import useToastStore from '../../app/useToastStore';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface VariantConfig {
    icon:       React.ElementType;
    label:      string;
    accent:     string;
    labelColor: string;
    iconColor:  string;
}

const VARIANTS: Record<ToastType, VariantConfig> = {
    success: {
        icon:       CheckCircle2,
        label:      'Éxito',
        accent:     'var(--color-success)',
        labelColor: 'var(--color-success-text)',
        iconColor:  'var(--color-success)',
    },
    error: {
        icon:       AlertCircle,
        label:      'Error',
        accent:     'var(--color-danger)',
        labelColor: 'var(--color-danger-text)',
        iconColor:  'var(--color-danger)',
    },
    warning: {
        icon:       AlertTriangle,
        label:      'Advertencia',
        accent:     'var(--color-warning)',
        labelColor: 'var(--color-warning-text)',
        iconColor:  'var(--color-warning)',
    },
    info: {
        icon:       Info,
        label:      'Información',
        accent:     'var(--color-info)',
        labelColor: 'var(--color-info-text)',
        iconColor:  'var(--color-info)',
    },
};

export interface CustomToastProps {
    id:          string;
    type?:       ToastType;
    message:     string;
    duration?:   number;
    onClose:     (id: string) => void;
    isPaused?:   boolean;
}

export const CustomToast: React.FC<CustomToastProps> = ({
    id,
    type      = 'info',
    message,
    duration  = 3000,
    onClose,
    isPaused  = false,
}) => {
    const [progress, setProgress] = useState(100);
    const progressRef  = useRef(100);
    const lastTickRef  = useRef<number | null>(null);
    const rafRef       = useRef<number | null>(null);

    useEffect(() => {
        progressRef.current = progress;
    }, [progress]);

    useEffect(() => {
        const tick = (ts: number) => {
            if (isPaused) {
                lastTickRef.current = ts;
                rafRef.current = requestAnimationFrame(tick);
                return;
            }
            if (!lastTickRef.current) lastTickRef.current = ts;
            const delta = ts - lastTickRef.current;
            lastTickRef.current = ts;

            const next = Math.max(0, progressRef.current - (delta / duration) * 100);
            setProgress(next);

            if (next > 0) {
                rafRef.current = requestAnimationFrame(tick);
            } else {
                onClose(id);
            }
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, [duration, id, isPaused, onClose]);

    const cfg  = VARIANTS[type] ?? VARIANTS.info;
    const Icon = cfg.icon;

    return (
        <div
            role="status"
            aria-live="polite"
            className={clsx(
                'relative group flex items-center gap-3 px-3.5 py-3 overflow-hidden select-none',
                'animate-in slide-in-from-right-3 fade-in duration-150',
                'bg-[var(--color-bg-elevated)]',
                'border border-[var(--color-border-subtle)]',
                'rounded-[6px]',
                'shadow-lg',
            )}
            style={{
                width: 'min(calc(100vw - 2rem), 22rem)',
                borderLeft: `3px solid ${cfg.accent}`,
            }}
        >
            {/* Icon */}
            <div
                className="shrink-0"
                style={{ color: cfg.iconColor }}
                aria-hidden="true"
            >
                <Icon size={16} strokeWidth={2.2} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pr-4">
                <p
                    className="text-[10px] font-bold uppercase tracking-wider leading-none mb-1"
                    style={{ color: cfg.labelColor }}
                >
                    {cfg.label}
                </p>
                <p className="text-xs leading-snug text-[var(--color-text-primary)] font-medium">
                    {message}
                </p>
            </div>

            {/* Close */}
            <button
                onClick={() => onClose(id)}
                aria-label="Cerrar notificación"
                className={clsx(
                    'absolute top-2.5 right-2.5',
                    'p-1 rounded-[4px]',
                    'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
                    'opacity-60 hover:opacity-100',
                    'transition-all duration-150',
                    'hover:bg-[var(--color-bg-secondary)]',
                    'focus:outline-none focus-visible:opacity-100 cursor-pointer'
                )}
            >
                <X size={13} strokeWidth={2} />
            </button>

            {/* Progress bar */}
            <div
                className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[var(--color-border-subtle)]"
                aria-hidden="true"
            >
                <div
                    className="h-full opacity-80 transition-none"
                    style={{
                        width:      `${progress}%`,
                        background: cfg.accent,
                    }}
                />
            </div>
        </div>
    );
};

export const CustomToaster = () => {
    const { customToasts, removeToast, toastPosition } = useToastStore();
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    
    const positionClasses = clsx(
        'fixed z-[2147483647] flex flex-col gap-2 pointer-events-none p-4',
        {
            'top-0': toastPosition.includes('top'),
            'bottom-0': toastPosition.includes('bottom'),
            'left-0': toastPosition.includes('left') && !isMobile,
            'right-0': toastPosition.includes('right') && !isMobile,
            'left-1/2 -translate-x-1/2': toastPosition.includes('center') || isMobile,
        }
    );

    return (
        <div className={positionClasses}>
            {customToasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto w-full flex justify-center sm:justify-end">
                    <CustomToast
                        id={toast.id}
                        type={toast.type}
                        message={toast.message}
                        duration={toast.duration}
                        onClose={removeToast}
                    />
                </div>
            ))}
        </div>
    );
};

export default memo(CustomToaster);