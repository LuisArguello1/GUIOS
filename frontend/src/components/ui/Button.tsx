import React, { forwardRef, memo } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost' | 'warning' | 'info';
type ButtonSize    = 'sm' | 'md' | 'lg';
type IconPlacement = 'left' | 'right';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children?: React.ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    loading?: boolean;
    icon?: LucideIcon;
    iconPlacement?: IconPlacement;
    className?: string;
}

const base = [
    'inline-flex items-center justify-center',
    'font-bold tracking-tight',
    'transition-all duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-1',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    'active:scale-[0.99]',
    'select-none whitespace-nowrap cursor-pointer',
].join(' ');

const variants: Record<ButtonVariant, string> = {
    primary: [
        'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]',
        'hover:bg-[var(--color-primary-hover)]',
        'active:bg-[var(--color-primary-active)]',
        'shadow-sm',
    ].join(' '),

    secondary: [
        'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
        'border border-[var(--color-border-subtle)]',
        'hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-strong)]',
    ].join(' '),

    danger: [
        'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
        'border border-[var(--color-danger)]/20',
        'hover:bg-[var(--color-danger)] hover:text-white hover:border-transparent',
    ].join(' '),

    success: [
        'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
        'border border-[var(--color-success)]/20',
        'hover:bg-[var(--color-success)] hover:text-white hover:border-transparent',
    ].join(' '),

    outline: [
        'bg-transparent text-[var(--color-primary)]',
        'border border-[var(--color-primary)]/40',
        'hover:bg-[var(--color-primary)]/10',
    ].join(' '),

    ghost: [
        'bg-transparent text-[var(--color-text-secondary)]',
        'hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
    ].join(' '),

    warning: [
        'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
        'border border-[var(--color-warning)]/20',
        'hover:bg-[var(--color-warning)] hover:text-white',
    ].join(' '),

    info: [
        'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
        'border border-[var(--color-info)]/20',
        'hover:bg-[var(--color-info)] hover:text-white',
    ].join(' '),
};

const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-[4px]',
    md: 'px-4 py-2   text-sm gap-2   rounded-[4px]',
    lg: 'px-5 py-2.5 text-sm gap-2.5 rounded-[4px]',
};

const iconSizes: Record<ButtonSize, number> = {
    sm: 14,
    md: 16,
    lg: 18,
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            children,
            variant = 'primary',
            size = 'md',
            className,
            isLoading = false,
            loading = false,
            icon: Icon,
            iconPlacement = 'left',
            disabled,
            type = 'button',
            ...rest
        },
        ref
    ) => {
        const busy     = isLoading || loading;
        const iconSize = iconSizes[size];

        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || busy}
                aria-busy={busy}
                className={clsx(base, variants[variant], sizes[size], className)}
                {...rest}
            >
                {busy && (
                    <Loader2
                        className="animate-spin shrink-0"
                        size={iconSize}
                        aria-hidden="true"
                    />
                )}

                {!busy && Icon && iconPlacement === 'left' && (
                    <Icon size={iconSize} strokeWidth={2.2} aria-hidden="true" />
                )}

                {children}

                {!busy && Icon && iconPlacement === 'right' && (
                    <Icon size={iconSize} strokeWidth={2.2} aria-hidden="true" />
                )}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default memo(Button);