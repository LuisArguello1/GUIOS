import React, { memo } from 'react';
import { clsx } from 'clsx';

interface SkeletonProps {
    className?: string;
    circle?: boolean;
    width?: string | number;
    height?: string | number;
}

/**
 * Skeleton — Indicador de carga estilo TikTok.
 */
const Skeleton: React.FC<SkeletonProps> = ({
    className,
    circle = false,
    width,
    height,
}) => {
    return (
        <div
            className={clsx(
                'relative overflow-hidden',
                'bg-[var(--color-bg-tertiary)]',
                'animate-pulse',
                circle ? 'rounded-full' : 'rounded-[4px]',
                className
            )}
            style={{ width, height }}
            aria-hidden="true"
        >
            <div
                className={clsx(
                    'absolute inset-0',
                    'bg-gradient-to-r',
                    'from-transparent',
                    'via-[var(--color-bg-secondary)]/50',
                    'to-transparent',
                    '-translate-x-full',
                    'animate-[shimmer_1.8s_ease-in-out_infinite]'
                )}
            />
        </div>
    );
};

export default memo(Skeleton);