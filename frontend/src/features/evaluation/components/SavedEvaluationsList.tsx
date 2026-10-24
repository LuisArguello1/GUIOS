import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { SavedEvaluation } from '../../../app/useSavedEvaluationsStore';

interface SavedEvaluationsListProps {
    items: SavedEvaluation[];
    onRemove: (uuid: string) => void;
}

/** Evaluaciones guardadas en este navegador ("Continuar una evaluación"). */
const SavedEvaluationsList = ({ items, onRemove }: SavedEvaluationsListProps) => {
    if (items.length === 0) {
        return <p className="text-sm text-[var(--color-text-tertiary)]">Todavía no hay evaluaciones en este navegador.</p>;
    }
    return (
        <ul className="divide-y divide-[var(--color-border-subtle)]">
            {items.map((item) => {
                const done = item.status === 'completed';
                return (
                    <li key={item.uuid} className="flex items-center justify-between gap-3 py-3">
                        <Link
                            to={done ? `/evaluacion/${item.uuid}/resultados` : `/evaluacion/${item.uuid}`}
                            className="min-w-0 flex-1 rounded-[4px] hover:underline"
                        >
                            <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                {item.software_name}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                                {item.org_name} · {done ? 'Con dictamen' : 'En progreso'} ·{' '}
                                {new Date(item.saved_at).toLocaleDateString('es-EC')}
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => onRemove(item.uuid)}
                            aria-label={`Quitar ${item.software_name} de este navegador`}
                            title="Quitar de este navegador (no borra la evaluación)"
                            className="rounded-[4px] p-2 text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-danger-text)]"
                        >
                            <Trash2 size={16} aria-hidden />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

export default memo(SavedEvaluationsList);
