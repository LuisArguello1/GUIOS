/**
 * features/publicEvaluation/components/ui/AISuggestionBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Indicador visual distintivo para sugerencias orientativas de IA (RNF-05).
 * Diferencia claramente los valores sugeridos de los modificados manualmente (RN-05).
 */

import React, { useState, memo } from 'react';
import { Sparkles, Info, Sliders } from 'lucide-react';
import { clsx } from 'clsx';

interface AISuggestionBadgeProps {
    suggestedValue?: number;
    justification?: string;
    isModified?: boolean;
    className?: string;
}

export const AISuggestionBadge: React.FC<AISuggestionBadgeProps> = ({
    suggestedValue,
    justification,
    isModified = false,
    className,
}) => {
    const [showPopover, setShowPopover] = useState(false);

    if (!suggestedValue) return null;

    return (
        <div className={clsx('relative inline-flex items-center', className)}>
            <button
                type="button"
                onClick={() => setShowPopover(!showPopover)}
                className={clsx(
                    'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] border transition-all cursor-pointer',
                    isModified
                        ? 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-elevated)]'
                        : 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-[var(--color-primary)]/25 hover:border-[var(--color-primary)]/50'
                )}
                title="Ver justificación técnica de la IA"
            >
                {isModified ? (
                    <>
                        <Sliders size={11} className="opacity-60" />
                        <span>Ajuste manual (IA: {suggestedValue})</span>
                    </>
                ) : (
                    <>
                        <Sparkles size={11} className="animate-pulse" />
                        <span>IA Sugerida: {suggestedValue}</span>
                    </>
                )}
                <Info size={10} className="opacity-50" />
            </button>

            {showPopover && justification && (
                <>
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowPopover(false)}
                    />
                    <div className="absolute left-0 bottom-full mb-1 z-40 w-72 p-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-lg text-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
                        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-border-subtle)]">
                            <span className="font-bold text-[10px] uppercase tracking-wider text-[var(--color-primary)] flex items-center gap-1">
                                <Sparkles size={11} />
                                Justificación del Asistente
                            </span>
                            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                Valor: {suggestedValue}/4
                            </span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                            {justification}
                        </p>
                        {isModified && (
                            <p className="text-[10px] text-[var(--color-warning-text)] bg-[var(--color-warning-bg)] p-1 rounded-[2px] font-medium">
                                Has modificado manualmente este valor. Prevalecerá tu decisión al guardar.
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default memo(AISuggestionBadge);
