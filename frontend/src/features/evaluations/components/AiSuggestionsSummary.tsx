import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import type { AdminFactorDetail } from '../../../api/guiosAdminService';
import { IMPORTANCE_OPTIONS, RATING_OPTIONS } from '../../evaluation/labels';

const label = (options: { value: number; label: string }[], value: number | null) =>
    value === null ? 'Sin calificar' : `${value} · ${options.find((o) => o.value === value)?.label ?? ''}`;

interface Row {
    key: string;
    subject: string;
    suggested: string;
    chosen: string;
    accepted: boolean;
    justification: string;
}

/** Qué sugirió la IA, qué eligió el evaluador y qué se aceptó sin cambios (RF-IA-02, RF-IA-03). */
const AiSuggestionsSummary = ({ factors }: { factors: AdminFactorDetail[] }) => {
    const rows: Row[] = factors.flatMap((factor) => [
        ...(factor.ai_suggested_id === null ? [] : [{
            key: `f${factor.factor_id}`,
            subject: `${factor.name} · importancia (ID)`,
            suggested: label(IMPORTANCE_OPTIONS, factor.ai_suggested_id),
            chosen: label(IMPORTANCE_OPTIONS, factor.decisor_importance),
            accepted: factor.id_was_ai_accepted,
            justification: factor.ai_id_justification,
        }]),
        ...factor.subfactors.filter((sub) => sub.ai_suggested_rating !== null).map((sub) => ({
            key: `s${sub.subfactor_id}`,
            subject: `${factor.name} · ${sub.description}`,
            suggested: label(RATING_OPTIONS, sub.ai_suggested_rating),
            chosen: label(RATING_OPTIONS, sub.rating),
            accepted: sub.rating_was_ai_accepted,
            justification: sub.ai_rating_justification,
        })),
    ]);
    if (rows.length === 0) return null;
    const accepted = rows.filter((row) => row.accepted).length;

    return (
        <section aria-labelledby="ai-suggestions-title">
            <h2 id="ai-suggestions-title" className="mb-1 flex items-center gap-1.5 text-base font-bold text-[var(--color-text-primary)]">
                <Sparkles size={16} className="text-[var(--color-info-text)]" aria-hidden /> Asistencia de IA
            </h2>
            <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
                {accepted} de {rows.length} sugerencias aceptadas sin cambios. Los valores que cuentan son los que eligió el evaluador.
            </p>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border-subtle)]">
                <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                        <tr>
                            <th scope="col" className="px-3 py-2">Elemento</th>
                            <th scope="col" className="px-3 py-2">Sugerencia de la IA</th>
                            <th scope="col" className="px-3 py-2">Valor elegido</th>
                            <th scope="col" className="px-3 py-2">¿Aceptada?</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {rows.map((row) => (
                            <tr key={row.key}>
                                <td className="px-3 py-2 text-[var(--color-text-primary)]">
                                    {row.subject}
                                    {row.justification && <p className="mt-0.5 text-[var(--color-text-tertiary)]">{row.justification}</p>}
                                </td>
                                <td className="px-3 py-2">{row.suggested}</td>
                                <td className="px-3 py-2">{row.chosen}</td>
                                <td className="px-3 py-2 font-semibold">{row.accepted ? 'Sí' : 'No'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default memo(AiSuggestionsSummary);
