import { memo } from 'react';
import { Check, Pencil, Sparkles, X } from 'lucide-react';

interface AiSuggestionProps {
    /** Qué se está sugiriendo (para lectores de pantalla), p. ej. "la importancia de Soporte". */
    subject: string;
    /** Valor sugerido con su etiqueta, p. ej. "3 · Importante". */
    valueLabel: string;
    justification: string;
    onAccept: () => void;
    onChange: () => void;
    onIgnore: () => void;
    disabled?: boolean;
}

const action = 'inline-flex min-h-8 items-center gap-1 rounded-[4px] border px-2.5 py-1 text-xs font-semibold transition-colors '
    + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Sugerencia de la IA junto al control (RNF-05): diferenciada (borde punteado,
 * ícono y texto) y sin efecto hasta que el evaluador decide (RN-05).
 */
const AiSuggestion = ({ subject, valueLabel, justification, onAccept, onChange, onIgnore, disabled = false }: AiSuggestionProps) => (
    <div
        role="group"
        aria-label={`Sugerencia de la IA para ${subject}`}
        className="rounded-[6px] border border-dashed border-[var(--color-info)] bg-[var(--color-info-bg)] p-3"
    >
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-info-text)]">
            <Sparkles size={14} aria-hidden />
            <span className="font-bold">Sugerencia de la IA:</span>
            <span className="font-bold">{valueLabel}</span>
            <span className="text-[var(--color-text-tertiary)]">(orientativa, aún sin calificar)</span>
        </p>
        {justification && <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-primary)]">{justification}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" onClick={onAccept} disabled={disabled}
                className={`${action} border-[var(--color-info)] bg-[var(--color-info)] text-white`}>
                <Check size={13} aria-hidden /> Aceptar
            </button>
            <button type="button" onClick={onChange} disabled={disabled}
                className={`${action} border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]`}>
                <Pencil size={13} aria-hidden /> Cambiar
            </button>
            <button type="button" onClick={onIgnore} disabled={disabled}
                className={`${action} border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]`}>
                <X size={13} aria-hidden /> Ignorar
            </button>
        </div>
    </div>
);

/** Rastro de la sugerencia cuando el evaluador ya eligió un valor. */
export const AiSuggestedTag = ({ valueLabel, accepted }: { valueLabel: string; accepted: boolean }) => (
    <p className="inline-flex items-center gap-1 text-[11px] text-[var(--color-info-text)]">
        <Sparkles size={12} aria-hidden />
        IA sugirió {valueLabel}{accepted ? ' · aceptada' : ''}
    </p>
);

export default memo(AiSuggestion);
