/**
 * features/publicEvaluation/components/ui/ScoreSlider.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Control deslizante restringido estrictamente al rango [1, 4] (RNF-07)
 * con etiquetas semánticas y retroalimentación cromática inmediata.
 */

import React, { memo } from 'react';
import { clsx } from 'clsx';

export type SliderVariant = 'factor_importance' | 'subfactor_rating';

interface ScoreSliderProps {
    value: number;
    onChange: (newValue: number) => void;
    variant?: SliderVariant;
    disabled?: boolean;
    label?: string;
    showScaleLabels?: boolean;
    className?: string;
}

const FACTOR_LABELS: Record<number, { text: string; colorClass: string; bgClass: string }> = {
    1: { text: 'Irrelevante', colorClass: 'text-[var(--color-text-tertiary)]', bgClass: 'bg-[var(--color-bg-page)]' },
    2: { text: 'Opcional', colorClass: 'text-[var(--color-info-text)]', bgClass: 'bg-[var(--color-info-bg)]' },
    3: { text: 'Importante', colorClass: 'text-[var(--color-primary)]', bgClass: 'bg-[var(--color-primary-soft-bg)]' },
    4: { text: 'Fundamental', colorClass: 'text-[var(--color-warning-text)]', bgClass: 'bg-[var(--color-warning-bg)]' },
};

const SUBFACTOR_LABELS: Record<number, { text: string; colorClass: string; bgClass: string }> = {
    1: { text: 'No cumple', colorClass: 'text-[var(--color-danger-text)]', bgClass: 'bg-[var(--color-danger-bg)]' },
    2: { text: 'Desconozco', colorClass: 'text-[var(--color-text-tertiary)]', bgClass: 'bg-[var(--color-bg-page)]' },
    3: { text: 'Cumple parcialmente', colorClass: 'text-[var(--color-warning-text)]', bgClass: 'bg-[var(--color-warning-bg)]' },
    4: { text: 'Cumple satisfactoriamente', colorClass: 'text-[var(--color-success-text)]', bgClass: 'bg-[var(--color-success-bg)]' },
};

export const ScoreSlider: React.FC<ScoreSliderProps> = ({
    value,
    onChange,
    variant = 'factor_importance',
    disabled = false,
    label,
    showScaleLabels = true,
    className,
}) => {
    const safeValue = Math.max(1, Math.min(4, Math.round(value || 1)));
    const labelsMap = variant === 'factor_importance' ? FACTOR_LABELS : SUBFACTOR_LABELS;
    const currentMeta = labelsMap[safeValue] || labelsMap[1];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const numeric = parseInt(e.target.value, 10);
        if (!isNaN(numeric) && numeric >= 1 && numeric <= 4) {
            onChange(numeric);
        }
    };

    return (
        <div className={clsx('space-y-1.5', className)}>
            {(label || currentMeta) && (
                <div className="flex items-center justify-between text-xs">
                    {label && (
                        <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
                    )}
                    <span
                        className={clsx(
                            'inline-flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-[4px] border border-[var(--color-border-subtle)] transition-colors',
                            currentMeta.bgClass,
                            currentMeta.colorClass
                        )}
                    >
                        <span className="font-extrabold">{safeValue}</span>
                        <span className="opacity-40">/</span>
                        <span>{currentMeta.text}</span>
                    </span>
                </div>
            )}

            <div className="relative py-1">
                <input
                    type="range"
                    min={1}
                    max={4}
                    step={1}
                    value={safeValue}
                    onChange={handleChange}
                    disabled={disabled}
                    className={clsx(
                        'w-full h-2 rounded-[4px] appearance-none cursor-pointer bg-[var(--color-border-subtle)]',
                        'accent-[var(--color-primary)] transition-all',
                        disabled && 'opacity-40 cursor-not-allowed'
                    )}
                />
            </div>

            {showScaleLabels && (
                <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)] font-mono px-0.5">
                    <span>1: {variant === 'factor_importance' ? 'Irrelevante' : 'No cumple'}</span>
                    <span>2: {variant === 'factor_importance' ? 'Opcional' : 'Desconozco'}</span>
                    <span>3: {variant === 'factor_importance' ? 'Importante' : 'Parcial'}</span>
                    <span>4: {variant === 'factor_importance' ? 'Fundamental' : 'Cumple'}</span>
                </div>
            )}
        </div>
    );
};

export default memo(ScoreSlider);
