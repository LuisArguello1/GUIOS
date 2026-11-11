/**
 * features/guios/evaluations/components/detail/EvaluationFactorsTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña 2: Mapeo de Factores, Literatura Indexada (r_i, IL) y
 * Calibración de la Importancia del Decisor (ID e IR).
 *
 * Principio:
 * - Diseño editorial, sobrio y sin ruido visual.
 * - Sin saturación de píldoras de colores ni bordes repetitivos.
 */

import React, { useState, useMemo, memo } from 'react';
import { clsx } from 'clsx';
import {
    BookOpen,
    CheckCircle2,
    Search,
    Sparkles,
    XCircle,
    ChevronDown,
    ChevronRight,
} from 'lucide-react';
import Input from '../../../../../components/ui/Input';
import Select, { type SelectOption } from '../../../../../components/ui/Select';
import type {
    EvaluationFactorItem,
    EvaluationSubfactorItem,
    EvaluationResultItem,
} from '../../../../../api/evaluationService';
import FactorMethodologyAuditCard from './FactorMethodologyAuditCard';

interface EvaluationFactorsTabProps {
    factors: EvaluationFactorItem[];
    subfactors?: EvaluationSubfactorItem[];
    results?: EvaluationResultItem[];
    onOpenSources: (factor: EvaluationFactorItem) => void;
}

export const EvaluationFactorsTab: React.FC<EvaluationFactorsTabProps> = ({
    factors,
    subfactors = [],
    results = [],
    onOpenSources,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDimension, setSelectedDimension] = useState<string>('all');
    const [relevanceFilter, setRelevanceFilter] = useState<'all' | 'relevant' | 'discarded'>('all');
    const [expandedFactorId, setExpandedFactorId] = useState<number | null>(null);
    const [expandedJustificationIds, setExpandedJustificationIds] = useState<Set<number>>(new Set());

    const toggleJustification = (factorId: number) => {
        setExpandedJustificationIds((prev) => {
            const next = new Set(prev);
            if (next.has(factorId)) {
                next.delete(factorId);
            } else {
                next.add(factorId);
            }
            return next;
        });
    };

    // Mapeo de subfactores y resultados por factor_id
    const subfactorsByFactor = useMemo(() => {
        const map = new Map<number, EvaluationSubfactorItem[]>();
        subfactors.forEach((sf) => {
            const list = map.get(sf.factor_id) || [];
            list.push(sf);
            map.set(sf.factor_id, list);
        });
        return map;
    }, [subfactors]);

    const resultMap = useMemo(() => {
        const map = new Map<number, EvaluationResultItem>();
        results.forEach((r) => map.set(r.factor_id, r));
        return map;
    }, [results]);

    // Dimensiones disponibles para el selector
    const dimensionOptions: SelectOption[] = useMemo(() => {
        const uniqueDims = Array.from(new Set(factors.map((f) => f.dimension_name))).filter(Boolean);
        return [
            { value: 'all', label: 'Todas las dimensiones' },
            ...uniqueDims.map((dim) => ({ value: dim, label: dim })),
        ];
    }, [factors]);

    // Filtrado de factores
    const filteredFactors = useMemo(() => {
        return factors.filter((factor) => {
            const matchesText =
                !searchTerm.trim() ||
                factor.factor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                factor.dimension_name.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDimension =
                selectedDimension === 'all' || factor.dimension_name === selectedDimension;

            const matchesRelevance =
                relevanceFilter === 'all' ||
                (relevanceFilter === 'relevant' && factor.is_relevant !== false) ||
                (relevanceFilter === 'discarded' && factor.is_relevant === false);

            return matchesText && matchesDimension && matchesRelevance;
        });
    }, [factors, searchTerm, selectedDimension, relevanceFilter]);

    return (
        <div className="space-y-3">
            {/* ── Barra de Filtros y Búsqueda ── */}
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex flex-1 flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-64">
                        <Input
                            placeholder="Buscar factor o dimensión..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={Search}
                        />
                    </div>

                    <div className="w-full sm:w-56">
                        <Select
                            options={dimensionOptions}
                            value={selectedDimension}
                            onChange={(e) => setSelectedDimension(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filtro de Relevancia */}
                <div className="flex items-center gap-1 text-xs self-end sm:self-center font-mono">
                    <button
                        type="button"
                        onClick={() => setRelevanceFilter('all')}
                        className={`px-2 py-0.5 rounded-[var(--radius-xs)] transition-colors cursor-pointer ${relevanceFilter === 'all'
                                ? 'bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-bold border border-[var(--color-border-subtle)]'
                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                            }`}
                    >
                        Todos ({factors.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setRelevanceFilter('relevant')}
                        className={`px-2 py-0.5 rounded-[var(--radius-xs)] transition-colors cursor-pointer ${relevanceFilter === 'relevant'
                                ? 'bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-bold border border-[var(--color-border-subtle)]'
                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                            }`}
                    >
                        Relevantes ({factors.filter((f) => f.is_relevant !== false).length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setRelevanceFilter('discarded')}
                        className={`px-2 py-0.5 rounded-[var(--radius-xs)] transition-colors cursor-pointer ${relevanceFilter === 'discarded'
                                ? 'bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-bold border border-[var(--color-border-subtle)]'
                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                            }`}
                    >
                        Descartados ({factors.filter((f) => f.is_relevant === false).length})
                    </button>
                </div>
            </div>

            {/* ── Tabla de Factores Evaluados ── */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] overflow-x-auto shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/40 text-[var(--color-text-tertiary)] font-mono text-[10px] uppercase tracking-wider">
                            <th className="w-12 px-3 py-2 font-semibold text-center">#</th>
                            <th className="w-[36%] min-w-[260px] max-w-[380px] px-3 py-2 font-semibold">Factor y Dimensión</th>
                            <th className="w-32 px-3 py-2 font-semibold text-center whitespace-nowrap">Imp. Sistémica (IS)</th>
                            <th className="w-36 px-3 py-2 font-semibold text-center whitespace-nowrap">Literatura (r_i / IL)</th>
                            <th className="w-28 px-3 py-2 font-semibold text-center whitespace-nowrap">Decisor (ID)</th>
                            <th className="w-32 px-3 py-2 font-semibold text-center whitespace-nowrap">Imp. Relativa (IR)</th>
                            <th className="w-24 px-3 py-2 font-semibold text-center whitespace-nowrap">Ámbito</th>
                            <th className="w-28 px-3 py-2 font-semibold text-center whitespace-nowrap">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]/60">
                        {filteredFactors.map((factor, idx) => {
                            const isRelevant = factor.is_relevant !== false;
                            const sourcesCount = factor.ai_literature_sources?.length || 0;
                            const ir = factor.relative_importance ?? 3;
                            const isCriticalIR = ir >= 3;
                            const isJustificationExpanded = expandedJustificationIds.has(factor.factor_id);

                            return (
                                <React.Fragment key={factor.id || factor.factor_id}>
                                    <tr
                                        className={`hover:bg-[var(--color-bg-page)]/40 transition-colors ${!isRelevant ? 'opacity-60 bg-[var(--color-bg-page)]/20' : ''
                                            }`}
                                    >
                                        <td className="px-3 py-2.5 font-mono text-[10px] text-[var(--color-text-tertiary)] text-center align-top">
                                            {idx + 1}
                                        </td>

                                        {/* Factor & Dimensión */}
                                        <td className="px-3 py-2.5 max-w-[380px] align-top">
                                            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5 flex-wrap">
                                                <span>{factor.factor_name}</span>
                                                {factor.ai_suggested_id !== null && factor.ai_suggested_id !== undefined && factor.decisor_importance === factor.ai_suggested_id && (
                                                    <span title="Sugerencia de IA aplicada" className="inline-flex shrink-0">
                                                        <Sparkles size={11} className="text-amber-400" />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-[var(--color-text-tertiary)] flex items-center gap-1.5 mt-0.5">
                                                <span>{factor.dimension_name}</span>
                                                <span>•</span>
                                                <span className="font-mono text-[10px]">
                                                    {factor.subfactors_count_snapshot} subfactores
                                                </span>
                                            </div>
                                            {factor.ai_id_justification && (
                                                <div className="mt-1.5 max-w-[360px]">
                                                    <p className={clsx(
                                                        'text-[11px] leading-relaxed break-words',
                                                        !isJustificationExpanded && 'line-clamp-2'
                                                    )}>
                                                        <Sparkles size={11} className="inline mr-1 text-amber-400 shrink-0" />
                                                        <span className="ai-platinum-text">
                                                            Sugerencia IA{factor.ai_suggested_id ? ` (${factor.ai_suggested_id}/4)` : ''}:{' '}
                                                            {factor.ai_id_justification}
                                                        </span>
                                                    </p>
                                                    {factor.ai_id_justification.length > 90 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleJustification(factor.factor_id)}
                                                            className="text-[10px] font-mono text-[var(--color-primary)] hover:underline mt-0.5 inline-flex items-center gap-0.5 cursor-pointer select-none"
                                                        >
                                                            {isJustificationExpanded ? '▲ Ver menos' : '▼ Ver justificación'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* IS */}
                                        <td className="px-3 py-2.5 text-center font-mono align-top whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpandedFactorId(
                                                        expandedFactorId === factor.factor_id ? null : factor.factor_id
                                                    )
                                                }
                                                className="inline-flex flex-col items-center group cursor-pointer"
                                                title="Ver cálculo de IS y PM"
                                            >
                                                <span className="font-bold text-[var(--color-text-primary)] group-hover:underline">
                                                    IS {factor.systemic_importance_snapshot ?? '—'}
                                                </span>
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-0.5">
                                                    <span>M(IE, IL)</span>
                                                    {expandedFactorId === factor.factor_id ? (
                                                        <ChevronDown size={10} />
                                                    ) : (
                                                        <ChevronRight size={10} />
                                                    )}
                                                </span>
                                            </button>
                                        </td>

                                        {/* Literatura r_i / IL */}
                                        <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                                            <div className="font-mono text-xs">
                                                <span className="font-semibold text-[var(--color-text-primary)]">
                                                    rᵢ={Number(factor.citation_ratio || 0).toFixed(2)}
                                                </span>
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] ml-1">
                                                    (IL {factor.literature_importance_calculated})
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onOpenSources(factor)}
                                                className="inline-flex items-center gap-1 text-[10px] font-mono mt-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] cursor-pointer transition-colors"
                                                title="Ver literatura científica indexada"
                                            >
                                                <BookOpen size={9} />
                                                <span>{factor.citations_count} citas</span>
                                                {sourcesCount > 0 && <span className="opacity-70">({sourcesCount} DOIs)</span>}
                                            </button>
                                        </td>

                                        {/* Decisor ID */}
                                        <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                                            <div className="font-mono font-bold text-xs text-[var(--color-text-primary)]">
                                                {factor.decisor_importance !== null ? factor.decisor_importance : '—'} / 4
                                            </div>
                                            {factor.ai_suggested_id !== null && factor.ai_suggested_id !== undefined && (
                                                <div
                                                    className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--color-text-tertiary)] mt-0.5"
                                                    title={`El asistente de IA sugirió ID = ${factor.ai_suggested_id}${factor.decisor_importance === factor.ai_suggested_id ? ' (Aplicado)' : ''}`}
                                                >
                                                    <Sparkles
                                                        size={10}
                                                        className={factor.decisor_importance === factor.ai_suggested_id ? 'text-amber-400' : 'opacity-40'}
                                                    />
                                                    <span>IA: {factor.ai_suggested_id}</span>
                                                </div>
                                            )}
                                        </td>

                                        {/* IR */}
                                        <td className="px-3 py-2.5 text-center font-mono align-top whitespace-nowrap">
                                            <span
                                                className={`font-bold text-xs ${isCriticalIR
                                                        ? 'text-amber-600 dark:text-amber-400'
                                                        : 'text-[var(--color-text-secondary)]'
                                                    }`}
                                            >
                                                IR = {factor.relative_importance ?? '—'}
                                            </span>
                                            <div className="text-[9px] text-[var(--color-text-tertiary)]">
                                                {isCriticalIR ? 'Crítico (≥3)' : 'Moderado (=2)'}
                                            </div>
                                        </td>

                                        {/* Ámbito */}
                                        <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                                            <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
                                                {factor.scope_used === 'internal' ? 'Interno' : 'Externo'}
                                            </span>
                                        </td>

                                        {/* Relevancia */}
                                        <td className="px-3 py-2.5 text-center align-top whitespace-nowrap">
                                            {isRelevant ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                                                    <CheckCircle2 size={11} className="text-emerald-500" /> Relevante
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)]">
                                                    <XCircle size={11} /> Descartado
                                                </span>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Fila Desplegable con Tarjeta Metodológica */}
                                    {expandedFactorId === factor.factor_id && (
                                        <tr>
                                            <td colSpan={8} className="p-3 bg-[var(--color-bg-page)]/40 border-b border-[var(--color-border-subtle)]">
                                                <FactorMethodologyAuditCard
                                                    factor={factor}
                                                    subfactors={subfactorsByFactor.get(factor.factor_id) || []}
                                                    result={resultMap.get(factor.factor_id)}
                                                    activeRatingFilter={null}
                                                    onSelectRatingFilter={() => { }}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {filteredFactors.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-xs text-[var(--color-text-tertiary)] italic">
                                    No se encontraron factores que coincidan con los filtros aplicados.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default memo(EvaluationFactorsTab);
