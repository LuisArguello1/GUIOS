import React, { memo } from 'react';
import { clsx } from 'clsx';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    headerAction?: React.ReactNode;
    footer?: React.ReactNode;
    noPadding?: boolean;
    glass?: boolean;
}

/**
 * Card — Contenedor de superficie estilo TikTok.
 * Usa var(--color-bg-elevated) con bordes limpios y esquinas suaves.
 */
const Card: React.FC<CardProps> = ({
    children,
    className,
    bodyClassName,
    title,
    subtitle,
    headerAction,
    footer,
    noPadding = false,
    glass = false,
}) => {
    const hasHeader = Boolean(title || headerAction);

    return (
        <div
            className={clsx(
                'flex flex-col overflow-hidden',
                'border border-[var(--color-border-subtle)]',
                'rounded-[8px] bg-[var(--color-bg-elevated)]',
                'shadow-sm transition-colors duration-150',
                glass && 'glass',
                className,
            )}
        >
            {hasHeader && (
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/40 shrink-0">
                    <div className="min-w-0">
                        {title && (
                            <h3 className="text-[13px] sm:text-[14px] font-bold text-[var(--color-text-primary)] truncate tracking-tight">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-[11px] text-[var(--color-text-tertiary)] tracking-normal mt-0.5 truncate">
                                {subtitle}
                            </p>
                        )}
                    </div>
                    {headerAction && (
                        <div className="flex-shrink-0 ml-4">{headerAction}</div>
                    )}
                </div>
            )}

            <div className={clsx('flex-1 min-h-0', !noPadding && 'p-5', bodyClassName)}>
                {children}
            </div>

            {footer && (
                <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/30 shrink-0">
                    {footer}
                </div>
            )}
        </div>
    );
};

export default memo(Card);