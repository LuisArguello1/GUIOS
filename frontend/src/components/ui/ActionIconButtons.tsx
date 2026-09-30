import React from 'react';
import { clsx } from 'clsx';
import { Edit2, Trash2, Eye, Power, Move, CheckCircle2 } from 'lucide-react';

interface BaseProps {
    title?: string;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

interface ToggleProps extends BaseProps {
    active: boolean;
}

/* Base pill estilo TikTok: esquinas suaves, foco con halo primario y micro-animación activa */
const base =
    'h-8 w-8 rounded-[4px] flex items-center justify-center transition-all duration-[var(--transition-fast)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/50 select-none';

export const DetailActionButton: React.FC<BaseProps> = ({ title = 'Ver detalle', disabled, onClick }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        className={clsx(
            base,
            'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20',
            'hover:brightness-95 active:scale-95 cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
    >
        <Eye size={15} strokeWidth={2} />
    </button>
);

export const EditActionButton: React.FC<BaseProps> = ({ title = 'Editar', disabled, onClick }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        className={clsx(
            base,
            'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20',
            'hover:bg-[var(--color-primary)]/20 active:scale-95 cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
    >
        <Edit2 size={15} strokeWidth={2} />
    </button>
);

export const DeleteActionButton: React.FC<BaseProps> = ({ title = 'Eliminar', disabled, onClick }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        className={clsx(
            base,
            'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger)]/20',
            'hover:bg-[var(--color-danger)] hover:text-white active:scale-95 cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
    >
        <Trash2 size={15} strokeWidth={2} />
    </button>
);

export const ToggleActionButton: React.FC<ToggleProps> = ({ title, disabled, onClick, active }) => (
    <button
        type="button"
        title={title ?? (active ? 'Desactivar' : 'Activar')}
        disabled={disabled}
        onClick={onClick}
        aria-label={title ?? (active ? 'Desactivar' : 'Activar')}
        aria-pressed={active}
        className={clsx(
            base,
            active
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success)]/20 hover:brightness-95'
                : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger)]/20 hover:brightness-95',
            'active:scale-95 cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
    >
        <Power size={15} strokeWidth={2} />
    </button>
);

export const MoveActionButton: React.FC<BaseProps> = ({ title = 'Mover', disabled, onClick }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        className={clsx(
            base,
            'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]',
            'hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] active:scale-95 cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
    >
        <Move size={15} strokeWidth={2} />
    </button>
);

export const SuccessActionButton: React.FC<BaseProps & { icon?: React.ElementType }> = ({ title = 'Confirmar', disabled, onClick, icon: Icon = CheckCircle2 }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        aria-label={title}
        className={clsx(
            base,
            'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success)]/20',
            'hover:brightness-95 active:scale-95 cursor-pointer',
            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        )}
    >
        <Icon size={15} strokeWidth={2.4} />
    </button>
);