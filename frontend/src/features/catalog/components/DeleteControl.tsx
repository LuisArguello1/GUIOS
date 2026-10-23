import { memo, useId } from 'react';
import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';

interface DeleteControlProps {
    /** Nombre del elemento (para el nombre accesible del botón). */
    itemLabel: string;
    /** Motivo por el que no se puede eliminar; null si se puede. */
    blockedReason: string | null;
    onDelete: () => void;
}

/**
 * Botón de eliminar. Si no se puede, queda deshabilitado pero enfocable
 * (aria-disabled) y el motivo se ve en pantalla y lo anuncian los lectores de
 * pantalla (aria-describedby).
 */
const DeleteControl = ({ itemLabel, blockedReason, onDelete }: DeleteControlProps) => {
    const reasonId = useId();
    const blocked = blockedReason !== null;
    return (
        <span className="inline-flex items-center gap-1.5">
            <button
                type="button"
                aria-label={`Eliminar ${itemLabel}`}
                aria-disabled={blocked || undefined}
                aria-describedby={blocked ? reasonId : undefined}
                title={blocked ? `No se puede eliminar: ${blockedReason}` : 'Eliminar'}
                onClick={blocked ? undefined : onDelete}
                className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-[4px] border transition',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]/50',
                    blocked
                        ? 'cursor-not-allowed border-[var(--color-border-subtle)] text-[var(--color-text-disabled)]'
                        : 'border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] hover:brightness-95',
                )}
            >
                <Trash2 size={15} aria-hidden />
            </button>
            {blocked && (
                <span id={reasonId} className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
                    {blockedReason}
                </span>
            )}
        </span>
    );
};

export default memo(DeleteControl);
