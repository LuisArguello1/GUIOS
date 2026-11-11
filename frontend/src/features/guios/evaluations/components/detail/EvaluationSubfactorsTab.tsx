/**
 * features/guios/evaluations/components/detail/EvaluationSubfactorsTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña 3: Auditoría Técnica Individual de Subfactores.
 * Muestra las calificaciones (1 a 4), justificaciones arquitectónicas de IA
 * y el cálculo de Ponderación Media por factor.
 *
 * Principio:
 * - Acordeón limpio, sin ruido visual, sin cajas anidadas dentro de cajas.
 */

import React, { useState, useMemo, memo } from 'react';
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    HelpCircle,
    XCircle,
    Search,
    BookOpen,
    Lock,
    Sparkles,
} from 'lucide-react';
import Input from '../../../../../components/ui/Input';
import type {
    EvaluationFactorItem,
    EvaluationSubfactorItem,
    EvaluationResultItem,
} from '../../../../../api/evaluationService';
import FactorMethodologyAuditCard, {
    getFactorCode,
    getSubfactorCode,
} from './FactorMethodologyAuditCard';

interface EvaluationSubfactorsTabProps {
    factors: EvaluationFactorItem[];
    subfactors: EvaluationSubfactorItem[];
    results: EvaluationResultItem[];
}

const RATING_CONFIG: Record<
    number,
    { label: string; short: string; textClass: string; icon: React.ComponentType<{ size?: number }> }
> = {
    4: {
        label: 'Satisfactorio (4)',
        short: 'Satisfactorio',
        textClass: 'text-emerald-600 dark:text-emerald-400',
        icon: CheckCircle2,
    },
    3: {
        label: 'Parcial (3)',
        short: 'Parcial',
        textClass: 'text-amber-600 dark:text-amber-400',
        icon: AlertTriangle,
    },
    2: {
        label: 'Desconozco (2)',
        short: 'Desconozco',
        textClass: 'text-slate-600 dark:text-slate-400',
        icon: HelpCircle,
    },
    1: {
        label: 'No Cumple (1)',
        short: 'No Cumple',
        textClass: 'text-rose-600 dark:text-rose-400',
        icon: XCircle,
    },
};

export const EvaluationSubfactorsTab: React.FC<EvaluationSubfactorsTabProps> = ({
    factors,
    subfactors,
    results,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedFactors, setExpandedFactors] = useState<Record<number, boolean>>({});
    const [ratingFilters, setRatingFilters] = useState<Record<number, number | null>>({});

    // Mapeo de Ponderación Media por factor_id
    const resultMap = useMemo(() => {
        const map = new Map<number, EvaluationResultItem>();
        results.forEach((r) => map.set(r.factor_id, r));
        return map;
    }, [results]);

    // Agrupación de subfactores por factor_id
    const subfactorsByFactor = useMemo(() => {
        const map = new Map<number, EvaluationSubfactorItem[]>();
        subfactors.forEach((sf) => {
            const current = map.get(sf.factor_id) || [];
            current.push(sf);
            map.set(sf.factor_id, current);
        });
        return map;
    }, [subfactors]);

    // Alternar colapsado de factores
    const toggleFactor = (factorId: number) => {
        setExpandedFactors((prev) => ({
            ...prev,
            [factorId]: prev[factorId] === undefined ? false : !prev[factorId],
        }));
    };

    // Expandir / colapsar todos
    const handleExpandAll = () => {
        const next: Record<number, boolean> = {};
        factors.forEach((f) => {
            next[f.factor_id] = true;
        });
        setExpandedFactors(next);
    };

    const handleCollapseAll = () => {
        const next: Record<number, boolean> = {};
        factors.forEach((f) => {
            next[f.factor_id] = false;
        });
        setExpandedFactors(next);
    };

    // Filtrado de factores según búsqueda en subfactores
    const visibleFactors = useMemo(() => {
        if (!searchTerm.trim()) return factors;
        const lowerSearch = searchTerm.toLowerCase();

        return factors.filter((f) => {
            const factorMatches = f.factor_name.toLowerCase().includes(lowerSearch);
            const sfs = subfactorsByFactor.get(f.factor_id) || [];
            const subfactorMatches = sfs.some(
                (sf) =>
                    sf.description_snapshot.toLowerCase().includes(lowerSearch) ||
                    (sf.ai_rating_justification && sf.ai_rating_justification.toLowerCase().includes(lowerSearch))
            );
            return factorMatches || subfactorMatches;
        });
    }, [factors, subfactorsByFactor, searchTerm]);

    return (
        <div className="space-y-3">
            {/* ── Barra de Búsqueda y Controles de Acordeón ── */}
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="w-full sm:w-80">
                    <Input
                        placeholder="Buscar subfactor o justificación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={Search}
                    />
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                    <button
                        type="button"
                        onClick={handleExpandAll}
                        className="px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] transition-colors cursor-pointer hover:text-[var(--color-text-primary)]"
                    >
                        Expandir Todos
                    </button>
                    <button
                        type="button"
                        onClick={handleCollapseAll}
                        className="px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] transition-colors cursor-pointer hover:text-[var(--color-text-primary)]"
                    >
                        Colapsar Todos
                    </button>
                </div>
            </div>

            {/* ── Acordeón de Factores con sus Subfactores ── */}
            <div className="space-y-2">
                {visibleFactors.map((factor) => {
                    const sfs = subfactorsByFactor.get(factor.factor_id) || [];
                    const isExpanded = expandedFactors[factor.factor_id] ?? true;
                    const res = resultMap.get(factor.factor_id);
                    const pmValue = res?.weighted_average ? Number(res.weighted_average) : null;
                    const isPassing = pmValue !== null && pmValue >= 3.0;

                    const factorCode = getFactorCode(factor.factor_name, factor.dimension_name);
                    const activeRating = ratingFilters[factor.factor_id] ?? null;
                    const displayedSfs =
                        activeRating !== null ? sfs.filter((sf) => sf.rating === activeRating) : sfs;

                    return (
                        <div
                            key={factor.factor_id}
                            className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] overflow-hidden shadow-xs transition-all"
                        >
                            {/* Cabecera del Factor */}
                            <div
                                onClick={() => toggleFactor(factor.factor_id)}
                                className="px-3.5 py-2.5 bg-[var(--color-bg-page)]/40 hover:bg-[var(--color-bg-page)]/70 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-none border-b border-[var(--color-border-default)]"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[var(--color-text-tertiary)]">
                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                            {factorCode}
                                        </span>
                                        <span className="text-[var(--color-text-tertiary)]">•</span>
                                        <span className="font-semibold text-xs text-[var(--color-text-primary)]">
                                            {factor.factor_name}
                                        </span>
                                        {sfs.length > 0 && sfs.some((sf) => sf.ai_suggested_rating && sf.rating === sf.ai_suggested_rating) && (
                                            <span title="Sugerencia de IA aplicada en subfactores" className="inline-flex shrink-0">
                                                <Sparkles size={11} className="text-amber-400" />
                                            </span>
                                        )}
                                        <span className="inline-flex items-center text-[10px] text-[var(--color-text-tertiary)]" title="Factor del catálogo base de GUIOS">
                                            <Lock size={10} />
                                        </span>
                                        <span className="text-[11px] text-[var(--color-text-tertiary)]">
                                            ({factor.dimension_name} · {sfs.length} subfactores)
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 font-mono text-xs flex-wrap">
                                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                                        IS {factor.systemic_importance_snapshot}
                                    </span>

                                    {pmValue !== null ? (
                                        <span className="inline-flex items-center gap-1 font-bold text-xs text-[var(--color-text-primary)]">
                                            <span className={`w-1.5 h-1.5 rounded-full ${isPassing ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            PM {pmValue.toFixed(1)}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-[var(--color-text-tertiary)] italic">
                                            Sin PM
                                        </span>
                                    )}

                                    {res && (
                                        <span
                                            className={`text-[10px] font-semibold uppercase tracking-wider ${
                                                res.meets_threshold
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-rose-600 dark:text-rose-400'
                                            }`}
                                        >
                                            • {res.foda_display}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Contenido Expandido: Tarjeta Metodológica + Subfactores */}
                            {isExpanded && (
                                <div className="p-3 space-y-3 bg-[var(--color-bg-surface)]">
                                    {/* 1. Tarjeta Metodológica */}
                                    <FactorMethodologyAuditCard
                                        factor={factor}
                                        subfactors={sfs}
                                        result={res}
                                        activeRatingFilter={activeRating}
                                        onSelectRatingFilter={(rating) =>
                                            setRatingFilters((prev) => ({
                                                ...prev,
                                                [factor.factor_id]: rating,
                                            }))
                                        }
                                    />

                                    {/* 2. Listado de Subfactores (Plano y Limpio) */}
                                    <div className="space-y-1">
                                        <div className="px-1 py-1 flex items-center justify-between text-xs border-b border-[var(--color-border-default)] pb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                                    Subfactores ({displayedSfs.length} de {sfs.length})
                                                </span>
                                                {activeRating !== null && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--color-primary)]">
                                                        <span>(Filtro: {RATING_CONFIG[activeRating]?.short})</span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setRatingFilters((prev) => ({
                                                                    ...prev,
                                                                    [factor.factor_id]: null,
                                                                }))
                                                            }
                                                            className="hover:text-rose-500 font-bold ml-0.5 cursor-pointer"
                                                            title="Quitar filtro"
                                                        >
                                                            ✕
                                                        </button>
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                                                Paso 3 y 4 • Calificación
                                            </span>
                                        </div>

                                        <div className="divide-y divide-[var(--color-border-subtle)]/40">
                                            {displayedSfs.map((subfactor) => {
                                                const ratingCfg =
                                                    subfactor.rating !== null ? RATING_CONFIG[subfactor.rating] : null;
                                                const sfCode = getSubfactorCode(factorCode, subfactor.order);

                                                return (
                                                    <div
                                                        key={subfactor.id || subfactor.subfactor_id}
                                                        className="py-2.5 px-1 hover:bg-[var(--color-bg-page)]/40 transition-colors text-xs space-y-1"
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] mt-0.5 shrink-0">
                                                                    #{subfactor.order}
                                                                </span>
                                                                <div className="space-y-0.5 min-w-0 flex-1">
                                                                    <p className="text-[var(--color-text-primary)] font-medium leading-relaxed">
                                                                        {subfactor.description_snapshot}
                                                                    </p>
                                                                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                                                        <span>{sfCode}</span>
                                                                        <span>•</span>
                                                                        <span>Base GUIOS</span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Calificación y Citas */}
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {subfactor.ai_citations_count > 0 && (
                                                                    <span
                                                                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--color-text-tertiary)]"
                                                                        title={`${subfactor.ai_citations_count} citas científicas indexadas`}
                                                                    >
                                                                        <BookOpen size={9} />
                                                                        <span>{subfactor.ai_citations_count} citas</span>
                                                                    </span>
                                                                )}
                                                                {ratingCfg ? (
                                                                    <span
                                                                        className={`inline-flex items-center gap-1 text-xs font-semibold ${ratingCfg.textClass}`}
                                                                    >
                                                                        <ratingCfg.icon size={12} />
                                                                        <span>{ratingCfg.label}</span>
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-[var(--color-text-tertiary)] italic">
                                                                        Sin calificar
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Justificación de IA si existe */}
                                                        {subfactor.ai_rating_justification && (
                                                            <p className="pl-5 text-[11px] leading-relaxed">
                                                                <Sparkles size={11} className="inline mr-1 text-amber-400" />
                                                                <span className="ai-platinum-text">
                                                                    Sugerencia IA
                                                                    {subfactor.ai_suggested_rating ? ` (${subfactor.ai_suggested_rating}/4)` : ''}:{' '}
                                                                    {subfactor.ai_rating_justification}
                                                                </span>
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default memo(EvaluationSubfactorsTab);
