import React, { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import Button from '../../../../components/ui/Button';

export interface AISuggestScopeOption {
    value: string;
    label: string;
    pendingCount?: number;
}

interface AISuggestSelectorProps {
    options: AISuggestScopeOption[];
    selectedScope: string;
    onScopeChange: (scope: string) => void;
    onRun: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    allReadyForScope?: boolean;
    ariaLabel?: string;
    className?: string;
}

/**
 * Selector compacto de alcance de sugerencias IA + botón de ejecución.
 * Permite elegir entre sugerencia individual, por dimensión/factor o global.
 */
export const AISuggestSelector: React.FC<AISuggestSelectorProps> = ({
    options,
    selectedScope,
    onScopeChange,
    onRun,
    isLoading = false,
    disabled = false,
    allReadyForScope = false,
    ariaLabel = 'Modo de sugerencia de IA',
    className,
}) => {
    const activeOption = options.find((opt) => opt.value === selectedScope) || options[0];
    const hasPending = activeOption?.pendingCount === undefined || activeOption.pendingCount > 0;
    const isActionDisabled = disabled || isLoading || allReadyForScope || !hasPending;

    return (
        <div className={clsx('inline-flex items-center gap-1 flex-wrap', className)}>
            <select
                value={selectedScope}
                onChange={(e) => onScopeChange(e.target.value)}
                disabled={disabled || isLoading}
                aria-label={ariaLabel}
                className="h-6.5 sm:h-7 max-w-[185px] px-2 rounded-[5px] text-[10px] font-medium bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.pendingCount !== undefined
                            ? `${opt.label} (${opt.pendingCount} pend.)`
                            : opt.label}
                    </option>
                ))}
            </select>

            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRun}
                disabled={isActionDisabled}
                className="h-6.5 sm:h-7 px-2.5 text-[10px] font-bold ai-gold-btn"
                title={
                    allReadyForScope || !hasPending
                        ? 'Ya existen sugerencias de IA para el alcance seleccionado'
                        : 'Ejecutar sugerencia asistida por IA según el modo elegido'
                }
            >
                <Sparkles size={11} className={clsx('text-amber-400 shrink-0', isLoading ? 'animate-spin' : '')} />
                <span>{allReadyForScope || !hasPending ? 'Sugerencia lista' : 'Sugerir IA'}</span>
            </Button>
        </div>
    );
};

export default memo(AISuggestSelector);
