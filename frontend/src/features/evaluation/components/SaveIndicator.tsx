import { memo } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import type { SaveStatus } from '../../../app/useEvaluationStore';

interface SaveIndicatorProps {
    status: SaveStatus;
    onRetry: () => void;
}

/** Estado del guardado automático (con texto, no solo color). */
const SaveIndicator = ({ status, onRetry }: SaveIndicatorProps) => {
    if (status === 'saving') {
        return (
            <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                <Loader2 size={14} className="animate-spin" aria-hidden /> Guardando…
            </span>
        );
    }
    if (status === 'saved') {
        return (
            <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success-text)]">
                <CheckCircle2 size={14} aria-hidden /> Guardado
            </span>
        );
    }
    if (status === 'error') {
        return (
            <span role="alert" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-danger-text)]">
                <AlertTriangle size={14} aria-hidden /> No se guardó
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--color-danger)]/40 px-2 py-0.5 hover:bg-[var(--color-danger-bg)]"
                >
                    <RotateCcw size={12} aria-hidden /> Reintentar
                </button>
            </span>
        );
    }
    return (
        <span className="text-xs text-[var(--color-text-tertiary)]">Los cambios se guardan automáticamente</span>
    );
};

export default memo(SaveIndicator);
