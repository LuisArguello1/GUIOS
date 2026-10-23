import React, { memo, useId } from 'react';
import { clsx } from 'clsx';

interface ToggleProps {
    label?: string;
    description?: string;
    checked: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    className?: string;
    /** Si true, renderiza el toggle inline sin card wrapper */
    inline?: boolean;
    /** id de un texto que describe el control (p. ej., el motivo por el que está deshabilitado). */
    describedBy?: string;
}

const Toggle: React.FC<ToggleProps> = ({
    label,
    description,
    checked,
    onChange,
    disabled = false,
    className,
    inline = false,
    describedBy,
}) => {
    const id = useId();

    /* ── Track (el switch físico) ── */
    const track = (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-describedby={describedBy}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={clsx(
                'relative inline-flex h-[20px] w-[34px] shrink-0 items-center',
                'rounded-full cursor-pointer',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-1',
                checked
                    ? 'bg-[var(--color-primary)]'
                    : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)]',
                disabled && 'cursor-not-allowed opacity-40',
            )}
        >
            {/* Thumb */}
            <span
                aria-hidden="true"
                className={clsx(
                    'pointer-events-none absolute left-[2px]',
                    'h-[16px] w-[16px] rounded-full',
                    'bg-white shadow-xs',
                    'transition-transform duration-150 ease-in-out',
                    checked ? 'translate-x-[14px]' : 'translate-x-0',
                )}
            />
        </button>
    );

    /* ── Inline variant ── */
    if (inline) {
        return (
            <div className={clsx('flex items-center gap-2 select-none', className)}>
                {track}
                {label && (
                    <label
                        htmlFor={id}
                        className={clsx(
                            'text-[13px] font-bold text-[var(--color-text-primary)] select-none leading-none',
                            disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
                        )}
                    >
                        {label}
                    </label>
                )}
            </div>
        );
    }

    /* ── Row variant (usado en configuraciones) ── */
    return (
        <div
            className={clsx(
                'flex items-center justify-between gap-4',
                'px-4 py-3 rounded-[6px]',
                'bg-[var(--color-bg-secondary)]/30 border border-[var(--color-border-subtle)]',
                'transition-colors duration-150 select-none',
                disabled && 'opacity-40',
                className,
            )}
        >
            {label && (
                <label
                    htmlFor={id}
                    className={clsx(
                        'flex flex-col gap-0.5 select-none min-w-0 flex-1',
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                    )}
                >
                    <span className="text-[13px] font-bold text-[var(--color-text-primary)] leading-tight truncate">
                        {label}
                    </span>
                    {description && (
                        <span className="text-[11px] text-[var(--color-text-tertiary)] leading-tight font-normal">
                            {description}
                        </span>
                    )}
                </label>
            )}
            {track}
        </div>
    );
};

export default memo(Toggle);