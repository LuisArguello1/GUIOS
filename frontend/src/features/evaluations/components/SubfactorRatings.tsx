import { memo } from 'react';
import type { AdminFactorDetail } from '../../../api/guiosAdminService';
import { RATING_OPTIONS } from '../../evaluation/labels';

const ratingText = (value: number | null) =>
    value === null ? 'Sin calificar' : `${value} · ${RATING_OPTIONS.find((o) => o.value === value)?.label ?? ''}`;

/** Calificaciones de cada subfactor de los factores relevantes (texto, no solo color). */
const SubfactorRatings = ({ factors }: { factors: AdminFactorDetail[] }) => {
    const relevant = factors.filter((f) => f.is_relevant);
    return (
        <section aria-labelledby="ratings-title">
            <h2 id="ratings-title" className="mb-3 text-base font-bold text-[var(--color-text-primary)]">Calificación de los subfactores</h2>
            {relevant.length === 0 && <p className="text-sm text-[var(--color-text-tertiary)]">No hay factores relevantes.</p>}
            <div className="space-y-2">
                {relevant.map((factor) => (
                    <details key={factor.factor_id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-3">
                        <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
                            {factor.name}
                            <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
                                PM {factor.weighted_average ?? '—'} · {factor.subfactors.filter((s) => s.rating !== null).length}/{factor.subfactors.length} calificados
                            </span>
                        </summary>
                        <ol className="mt-2 divide-y divide-[var(--color-border-subtle)]">
                            {factor.subfactors.map((sub, index) => (
                                <li key={sub.subfactor_id} className="flex flex-col gap-1 py-2 text-xs sm:flex-row sm:justify-between">
                                    <span className="text-[var(--color-text-primary)]">{index + 1}. {sub.description}</span>
                                    <span className="shrink-0 font-semibold text-[var(--color-text-secondary)]">{ratingText(sub.rating)}</span>
                                </li>
                            ))}
                        </ol>
                    </details>
                ))}
            </div>
        </section>
    );
};

export default memo(SubfactorRatings);
