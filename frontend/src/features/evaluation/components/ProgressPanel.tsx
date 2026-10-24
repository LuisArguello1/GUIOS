import { memo } from 'react';
import type { EvaluationFactorState, MissingItem, Summary } from '../../../api/guiosPublicService';

interface ProgressPanelProps {
    factors: EvaluationFactorState[];
    summary: Summary | null;
    onGoTo: (factorId: number) => void;
}

const MISSING_TEXT: Record<MissingItem['kind'], string> = {
    decisor_importance: 'Falta la importancia para su organización (ID)',
    scope: 'Falta elegir el ámbito (interno o externo)',
    subfactor_rating: 'Faltan subfactores por calificar',
};

/** Progreso y lista de pendientes; cada pendiente lleva a su factor. */
const ProgressPanel = ({ factors, summary, onGoTo }: ProgressPanelProps) => {
    const withId = factors.filter((factor) => factor.decisor_importance !== null).length;
    const relevant = summary?.factors.filter((factor) => factor.is_relevant) ?? [];
    const required = relevant.reduce((total, factor) => total + factor.subfactors_total, 0);
    const rated = relevant.reduce((total, factor) => total + factor.subfactors_rated, 0);
    const missing = summary?.missing ?? [];

    // Agrupa los pendientes por factor y tipo (los subfactores se cuentan).
    const grouped = new Map<string, { item: MissingItem; count: number }>();
    missing.forEach((item) => {
        const key = `${item.factor_id}:${item.kind}`;
        const current = grouped.get(key);
        grouped.set(key, { item, count: (current?.count ?? 0) + 1 });
    });

    return (
        <aside aria-label="Progreso de la evaluación" className="space-y-4 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4">
            <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Progreso</h2>
                <dl className="mt-2 space-y-1 text-xs text-[var(--color-text-secondary)]">
                    <div className="flex justify-between"><dt>Factores con ID</dt><dd className="font-semibold">{withId} / {factors.length}</dd></div>
                    <div className="flex justify-between"><dt>Factores relevantes</dt><dd className="font-semibold">{relevant.length}</dd></div>
                    <div className="flex justify-between"><dt>Subfactores calificados</dt><dd className="font-semibold">{rated} / {required}</dd></div>
                </dl>
                <div
                    role="progressbar"
                    aria-label="Avance de la evaluación"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={factors.length + required === 0 ? 0 : Math.round(((withId + rated) / (factors.length + required)) * 100)}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]"
                >
                    <div
                        className="h-full bg-[var(--color-primary)] transition-all"
                        style={{ width: `${factors.length + required === 0 ? 0 : ((withId + rated) / (factors.length + required)) * 100}%` }}
                    />
                </div>
            </div>

            <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {missing.length === 0 ? 'No falta nada: puede generar el dictamen' : `Pendientes (${missing.length})`}
                </h2>
                {grouped.size > 0 && (
                    <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto pr-1">
                        {[...grouped.values()].map(({ item, count }) => (
                            <li key={`${item.factor_id}:${item.kind}`}>
                                <button
                                    type="button"
                                    onClick={() => onGoTo(item.factor_id)}
                                    className="w-full rounded-[4px] px-2 py-1.5 text-left text-xs hover:bg-[var(--color-bg-secondary)]"
                                >
                                    <span className="font-semibold text-[var(--color-text-primary)]">{item.factor_name}</span>
                                    <span className="block text-[var(--color-text-secondary)]">
                                        {MISSING_TEXT[item.kind]}{item.kind === 'subfactor_rating' ? ` (${count})` : ''}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
};

export default memo(ProgressPanel);
