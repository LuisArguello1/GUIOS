import { memo } from 'react';
import { clsx } from 'clsx';
import type {
    EvaluationFactorState,
    FactorSummary,
    Importance,
    Rating,
    Scope,
} from '../../../api/guiosPublicService';
import { FODA_INFO, IMPORTANCE_OPTIONS, SCOPE_OPTIONS, importanceLabel, scopeLabel } from '../labels';
import ScaleButtons from './ScaleButtons';
import SubfactorRow from './SubfactorRow';

interface FactorCardProps {
    factor: EvaluationFactorState;
    summary?: FactorSummary;
    readOnly: boolean;
    onDecisorImportance: (factorId: number, value: Importance | null) => void;
    onScope: (factorId: number, value: Scope | null) => void;
    onRating: (subfactorId: number, value: Rating | null) => void;
}

const Badge = ({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'primary' | 'warning' | 'success' | 'danger' }) => (
    <span
        className={clsx(
            'inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-bold',
            tone === 'neutral' && 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
            tone === 'primary' && 'bg-[var(--color-primary-soft-bg)] text-[var(--color-tag-text)]',
            tone === 'warning' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
            tone === 'success' && 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
            tone === 'danger' && 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
        )}
    >
        {children}
    </span>
);

/** Un factor en la estación: IS de referencia, ID, ámbito (Soporte) y subfactores. */
const FactorCard = ({ factor, summary, readOnly, onDecisorImportance, onScope, onRating }: FactorCardProps) => {
    const ir = summary?.relative_importance ?? null;
    const relevant = summary?.is_relevant ?? null;
    const rated = factor.subfactors.filter((sub) => sub.rating !== null).length;
    const foda = summary?.foda ?? null;

    return (
        <section
            id={`factor-${factor.factor_id}`}
            aria-labelledby={`factor-title-${factor.factor_id}`}
            className="scroll-mt-24 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 sm:p-5"
        >
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 id={`factor-title-${factor.factor_id}`} className="text-base font-bold text-[var(--color-text-primary)]">
                        {factor.name}
                    </h3>
                    {factor.description && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">{factor.description}</p>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <Badge tone="primary">
                        IS {factor.suggested_importance} · {importanceLabel(factor.suggested_importance)} (referencia)
                    </Badge>
                    <Badge>Ámbito: {scopeLabel(factor.scope_used)}</Badge>
                </div>
            </header>

            <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-[var(--color-text-secondary)]">
                    Importancia para su organización (ID)
                </p>
                <ScaleButtons
                    label={`Importancia del decisor para ${factor.name}`}
                    options={IMPORTANCE_OPTIONS}
                    value={factor.decisor_importance}
                    onChange={(value) => onDecisorImportance(factor.factor_id, value)}
                    disabled={readOnly}
                />
                {factor.decisor_importance !== null && ir !== null && (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        IR = ⌊(IS {factor.suggested_importance} + ID {factor.decisor_importance}) ÷ 2⌋ ={' '}
                        <strong>{ir} · {importanceLabel(ir)}</strong>
                        {relevant
                            ? ' — Relevante: califique sus subfactores.'
                            : ' — Irrelevante: este factor no se califica ni cuenta en el dictamen.'}
                    </p>
                )}
            </div>

            {factor.scope_configurable && relevant !== false && (
                <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold text-[var(--color-text-secondary)]">
                        Ámbito de este factor para su organización
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                        Interno si el soporte lo da su propio personal; externo si lo da un proveedor o la comunidad.
                    </p>
                    <ScaleButtons
                        label={`Ámbito de ${factor.name}`}
                        options={SCOPE_OPTIONS}
                        value={factor.scope_used || null}
                        onChange={(value) => onScope(factor.factor_id, value)}
                        disabled={readOnly}
                        showNumbers={false}
                    />
                </div>
            )}

            {relevant && (
                <div className="mt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[var(--color-text-secondary)]">
                            Subfactores: {rated} de {factor.subfactors.length} calificados
                        </p>
                        {summary?.weighted_average && (
                            <Badge tone={foda ? (FODA_INFO[foda].positive ? 'success' : 'danger') : 'neutral'}>
                                PM {summary.weighted_average}
                                {foda ? ` · ${FODA_INFO[foda].label}` : ' · elija el ámbito'}
                            </Badge>
                        )}
                    </div>
                    <ol className="mt-2">
                        {factor.subfactors.map((subfactor, index) => (
                            <SubfactorRow
                                key={subfactor.subfactor_id}
                                subfactor={subfactor}
                                index={index}
                                readOnly={readOnly}
                                onChange={onRating}
                            />
                        ))}
                    </ol>
                </div>
            )}
        </section>
    );
};

export default memo(FactorCard);
