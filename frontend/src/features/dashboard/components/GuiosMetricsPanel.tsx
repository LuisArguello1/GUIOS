import { memo } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import Alert from '../../../components/ui/Alert';
import Skeleton from '../../../components/ui/Skeleton';
import useGuiosMetrics from '../../../hooks/useGuiosMetrics';
import usePermissions from '../../../hooks/usePermissions';
import { RECOMMENDATION_TITLES } from '../../evaluation/labels';
import type { Recommendation } from '../../../api/guiosPublicService';

const LETTERS: Recommendation[] = ['A', 'B', 'C'];
const BAR = {
    A: 'bg-[var(--color-success)]',
    B: 'bg-[var(--color-warning)]',
    C: 'bg-[var(--color-danger)]',
};

const Stat = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
);

const formatDate = (value: string) =>
    new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(new Date(value));

/** Métricas de GUIOS en el tablero: totales, dictámenes A/B/C y recientes. */
const GuiosMetricsPanel = () => {
    const { has } = usePermissions();
    const { metrics, error, isLoading, reload } = useGuiosMetrics(true);
    const canOpen = has('evaluations.view');
    const totalVerdicts = metrics ? LETTERS.reduce((sum, l) => sum + metrics.verdicts[l], 0) : 0;

    return (
        <section aria-labelledby="guios-metrics-title" className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
                <h2 id="guios-metrics-title" className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Evaluaciones GUIOS
                </h2>
                <button type="button" onClick={reload} disabled={isLoading} aria-label="Actualizar métricas de GUIOS"
                    className="rounded p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50">
                    <RefreshCw size={14} className={clsx(isLoading && 'animate-spin')} aria-hidden />
                </button>
            </div>

            {error && <Alert type="error" message={error} className="mt-3" />}
            {!metrics && !error && <Skeleton className="mt-3" height={160} />}

            {metrics && (
                <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                            <Stat label="Total" value={metrics.total} />
                            <Stat label="En progreso" value={metrics.in_progress} />
                            <Stat label="Completadas" value={metrics.completed} />
                        </div>
                        <div>
                            <h3 className="mb-2 text-xs font-bold text-[var(--color-text-primary)]">Dictámenes emitidos ({totalVerdicts})</h3>
                            <ul className="space-y-2">
                                {LETTERS.map((letter) => {
                                    const count = metrics.verdicts[letter];
                                    const percent = totalVerdicts ? Math.round((count / totalVerdicts) * 100) : 0;
                                    return (
                                        <li key={letter} data-testid={`verdict-${letter}`}>
                                            <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                                                <span><strong className="text-[var(--color-text-primary)]">{letter}</strong> · {RECOMMENDATION_TITLES[letter]}</span>
                                                <span className="font-mono">{count} ({percent} %)</span>
                                            </div>
                                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]" aria-hidden>
                                                <div className={clsx('h-full rounded-full', BAR[letter])} style={{ width: `${percent}%` }} />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                    <div>
                        <h3 className="mb-2 text-xs font-bold text-[var(--color-text-primary)]">Evaluaciones recientes</h3>
                        {metrics.recent.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-tertiary)]">Todavía no hay evaluaciones.</p>
                        ) : (
                            <ul className="divide-y divide-[var(--color-border-subtle)]">
                                {metrics.recent.map((item) => {
                                    const label = (
                                        <>
                                            <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{item.software_name}</span>
                                            <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                                                {item.org_name} · {item.status === 'completed' ? `Dictamen ${item.recommendation}` : 'En progreso'} · {formatDate(item.started_at)}
                                            </span>
                                        </>
                                    );
                                    return (
                                        <li key={item.uuid} className="py-2">
                                            {canOpen
                                                ? <Link to={`/dashboard/evaluaciones/${item.uuid}`} className="block rounded hover:bg-[var(--color-bg-secondary)]">{label}</Link>
                                                : label}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default memo(GuiosMetricsPanel);
