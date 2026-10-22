import { memo } from 'react';
import { clsx } from 'clsx';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import type { FactorSummary } from '../../../api/guiosPublicService';
import { FODA_INFO, FODA_ORDER, groupByFoda } from '../labels';

/** Matriz FODA en cuadrantes: cada uno con título, ámbito y regla en texto. */
const FodaMatrix = ({ factors }: { factors: FactorSummary[] }) => {
    const groups = groupByFoda(factors);
    return (
        <section aria-labelledby="foda-title">
            <h2 id="foda-title" className="text-base font-bold text-[var(--color-text-primary)]">Matriz FODA</h2>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                Factores relevantes según su ámbito (interno o externo) y su ponderación media (PM, umbral 3).
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {FODA_ORDER.map((foda) => {
                    const info = FODA_INFO[foda];
                    const Icon = info.positive ? ArrowUpCircle : ArrowDownCircle;
                    return (
                        <div
                            key={foda}
                            data-testid={`foda-${foda}`}
                            className={clsx(
                                'rounded-[6px] border p-4',
                                info.positive
                                    ? 'border-[var(--color-success)]/30 bg-[var(--color-success-bg)]'
                                    : 'border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)]',
                            )}
                        >
                            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                                <Icon size={16} aria-hidden />
                                {info.plural} ({groups[foda].length})
                            </h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                                Ámbito {info.scope.toLowerCase()} · {info.rule}
                            </p>
                            {groups[foda].length === 0 ? (
                                <p className="mt-2 text-xs italic text-[var(--color-text-tertiary)]">Ningún factor</p>
                            ) : (
                                <ul className="mt-2 space-y-1">
                                    {groups[foda].map((factor) => (
                                        <li key={factor.factor_id} className="flex justify-between gap-2 text-sm text-[var(--color-text-primary)]">
                                            <span>{factor.name}</span>
                                            <span className="font-mono text-xs text-[var(--color-text-secondary)]">PM {factor.weighted_average}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default memo(FodaMatrix);
