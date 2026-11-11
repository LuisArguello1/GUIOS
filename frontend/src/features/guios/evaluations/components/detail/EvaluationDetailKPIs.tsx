/**
 * features/guios/evaluations/components/detail/EvaluationDetailKPIs.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Franja ejecutiva unificada de indicadores clave (KPIs) y métricas metodológicas.
 *
 * Principio:
 * - Una sola superficie integrada con divisores hairline, eliminando el ruido
 *   visual de tarjetas separadas y contenedores anidados.
 * - Tipografía de alta densidad, sobria, sin saturación cromática.
 */

import React, { memo } from 'react';
import {
    Activity,
    Filter,
    Layers,
    Sliders,
    BookOpen,
    ArrowRight,
} from 'lucide-react';
import type { EvaluationDetail } from '../../../../../api/evaluationService';

interface EvaluationDetailKPIsProps {
    evaluation: EvaluationDetail;
    metrics: {
        pmOverall: number;
        relevantFactorsCount: number;
        totalFactorsCount: number;
        ratedSubfactorsCount: number;
        totalSubfactorsCount: number;
        fodaCounts: { strength: number; opportunity: number; weakness: number; threat: number };
    };
    onSelectTab?: (tab: 'verdict' | 'factors' | 'subfactors' | 'quantitative' | 'literature') => void;
}

export const EvaluationDetailKPIs: React.FC<EvaluationDetailKPIsProps> = ({
    evaluation,
    metrics,
    onSelectTab,
}) => {
    const isPassing = metrics.pmOverall >= 3.0;
    const relevancePercentage = metrics.totalFactorsCount > 0
        ? Math.round((metrics.relevantFactorsCount / metrics.totalFactorsCount) * 100)
        : 0;

    const auditCompletionPercentage = metrics.totalSubfactorsCount > 0
        ? Math.round((metrics.ratedSubfactorsCount / metrics.totalSubfactorsCount) * 100)
        : 0;

    const q1 = evaluation.q1_threshold !== null ? Number(evaluation.q1_threshold).toFixed(1) : '—';
    const q2 = evaluation.q2_threshold !== null ? Number(evaluation.q2_threshold).toFixed(1) : '—';
    const q3 = evaluation.q3_threshold !== null ? Number(evaluation.q3_threshold).toFixed(1) : '—';

    const favorableCount = metrics.fodaCounts.strength + metrics.fodaCounts.opportunity;
    const unfavorableCount = metrics.fodaCounts.weakness + metrics.fodaCounts.threat;

    return (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border-subtle)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 shadow-xs overflow-hidden">
            {/* ── KPI 1: Ponderación Media Global (PM) ── */}
            <div
                onClick={() => onSelectTab?.('quantitative')}
                className="p-3.5 sm:p-4 hover:bg-[var(--color-bg-page)]/50 transition-colors cursor-pointer group flex flex-col justify-between"
                title="Ver análisis cuantitativo de la Ponderación Media"
            >
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                    <span className="font-medium flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <Activity size={13} className="text-[var(--color-text-tertiary)]" />
                        Ponderación Media
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">PM ≥ 3.0</span>
                </div>
                <div className="flex items-baseline gap-1.5 my-0.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-[var(--color-text-primary)]">
                        {metrics.pmOverall > 0 ? metrics.pmOverall.toFixed(2) : '—'}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)] font-mono">/ 4.0</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span
                        className={`font-semibold font-mono text-[10px] uppercase tracking-wider ${
                            metrics.pmOverall === 0
                                ? 'text-[var(--color-text-tertiary)]'
                                : isPassing
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                        }`}
                    >
                        {metrics.pmOverall === 0
                            ? 'Pendiente'
                            : isPassing
                            ? 'Apto para Adopción'
                            : 'Bajo Umbral Crítico'}
                    </span>
                    <ArrowRight size={10} className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>

            {/* ── KPI 2: Factores Relevantes (Filtro Decisor) ── */}
            <div
                onClick={() => onSelectTab?.('factors')}
                className="p-3.5 sm:p-4 hover:bg-[var(--color-bg-page)]/50 transition-colors cursor-pointer group flex flex-col justify-between"
                title="Ver lista de Factores y Ponderación del Decisor"
            >
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                    <span className="font-medium flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <Filter size={13} className="text-[var(--color-text-tertiary)]" />
                        Factores Relevantes
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{relevancePercentage}%</span>
                </div>
                <div className="flex items-baseline gap-1.5 my-0.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-[var(--color-text-primary)]">
                        {metrics.relevantFactorsCount}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        / {metrics.totalFactorsCount} totales
                    </span>
                </div>
                <div className="mt-1 space-y-1">
                    <div className="w-full bg-[var(--color-bg-page)] rounded-full h-1 overflow-hidden">
                        <div
                            className="bg-[var(--color-primary)] h-full transition-all duration-500 opacity-80"
                            style={{ width: `${relevancePercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── KPI 3: Subfactores Calificados (Auditoría Técnica) ── */}
            <div
                onClick={() => onSelectTab?.('subfactors')}
                className="p-3.5 sm:p-4 hover:bg-[var(--color-bg-page)]/50 transition-colors cursor-pointer group flex flex-col justify-between"
                title="Ver desglose de los 61 subfactores técnicos"
            >
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                    <span className="font-medium flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <Layers size={13} className="text-[var(--color-text-tertiary)]" />
                        Subfactores Auditados
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{auditCompletionPercentage}%</span>
                </div>
                <div className="flex items-baseline gap-1.5 my-0.5">
                    <span className="text-2xl font-black font-mono tracking-tight text-[var(--color-text-primary)]">
                        {metrics.ratedSubfactorsCount}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                        / {metrics.totalSubfactorsCount}
                    </span>
                </div>
                <div className="mt-1 space-y-1">
                    <div className="w-full bg-[var(--color-bg-page)] rounded-full h-1 overflow-hidden">
                        <div
                            className="bg-[var(--color-primary)] h-full transition-all duration-500 opacity-80"
                            style={{ width: `${auditCompletionPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── KPI 4: Cuartiles de Literatura (r_i / IL) ── */}
            <div
                onClick={() => onSelectTab?.('literature')}
                className="p-3.5 sm:p-4 hover:bg-[var(--color-bg-page)]/50 transition-colors cursor-pointer group flex flex-col justify-between"
                title="Ver deducción formal de Literatura Indexada (IL) y Ecuaciones 5.1 / 5.2"
            >
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                    <span className="font-medium flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <BookOpen size={13} className="text-[var(--color-text-tertiary)]" />
                        Literatura Indexada
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">Cap. 5</span>
                </div>
                <div className="flex items-baseline gap-1.5 my-0.5">
                    <span className="text-sm font-bold font-mono tracking-tight text-[var(--color-text-primary)]">
                        Q1:{q1} · Q2:{q2} · Q3:{q3}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-[var(--color-text-tertiary)]">
                    <span>rᵢ = cᵢ / n</span>
                    <span className="text-[var(--color-text-primary)] font-semibold flex items-center gap-0.5 group-hover:underline">
                        Deducción IL <ArrowRight size={10} />
                    </span>
                </div>
            </div>

            {/* ── KPI 5: Balance Matriz FODA (2x2) ── */}
            <div
                onClick={() => onSelectTab?.('verdict')}
                className="p-3.5 sm:p-4 hover:bg-[var(--color-bg-page)]/50 transition-colors cursor-pointer group flex flex-col justify-between"
                title="Ver Matriz FODA 2x2 y Plan de Mitigación"
            >
                <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                    <span className="font-medium flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                        <Sliders size={13} className="text-[var(--color-text-tertiary)]" />
                        Balance FODA
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">2×2</span>
                </div>
                <div className="flex items-baseline gap-1.5 my-0.5">
                    <span className="text-base font-black font-mono tracking-tight text-[var(--color-text-primary)]">
                        {favorableCount} Fav <span className="text-xs font-normal text-[var(--color-text-tertiary)]">/</span> {unfavorableCount} Desfav
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                    <span>F:{metrics.fodaCounts.strength} · O:{metrics.fodaCounts.opportunity} · D:{metrics.fodaCounts.weakness} · A:{metrics.fodaCounts.threat}</span>
                    <ArrowRight size={10} className="text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </div>
        </div>
    );
};

export default memo(EvaluationDetailKPIs);
