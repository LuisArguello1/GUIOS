/**
 * features/guios/evaluations/components/detail/EvaluationQuantitativeTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña 4: Análisis Cuantitativo y Desempeño Metodológico de la Evaluación.
 *
 * Principio de diseño:
 * - Sobriedad ejecutiva y rigor estadístico ("Menos es más").
 * - Sin "cajas dentro de cajas", sin bordes duplicados ni ruido visual.
 * - Superficies integradas con divisores hairline y tipografía clara.
 * - Sin colores estridentes ni azules (paleta Platino/Titanio oficial).
 */

import React, { useMemo, useState, memo } from 'react';
import {
    BarChart3,
    Layers,
    CheckCircle2,
    Target,
    Search,
    ShieldAlert,
} from 'lucide-react';
import type {
    EvaluationDetail,
    EvaluationFactorItem,
    EvaluationSubfactorItem,
    EvaluationResultItem,
} from '../../../../../api/evaluationService';
import { getFactorCode } from '../../utils/factorCodes';

interface EvaluationQuantitativeTabProps {
    evaluation: EvaluationDetail;
    factors: EvaluationFactorItem[];
    subfactors: EvaluationSubfactorItem[];
    results: EvaluationResultItem[];
}

export const EvaluationQuantitativeTab: React.FC<EvaluationQuantitativeTabProps> = ({
    factors,
    subfactors,
    results,
}) => {
    const [filterQuery, setFilterQuery] = useState('');
    const [selectedDimensionFilter, setSelectedDimensionFilter] = useState<string>('all');

    // ── 1. Métricas Globales de Ponderación Media y Masa de Subfactores ──
    const globalMetrics = useMemo(() => {
        const pmValues = results.map((r) => Number(r.weighted_average || 0));
        const totalFactors = results.length;
        const passingFactors = results.filter((r) => Number(r.weighted_average) >= 3.0);
        const failingFactors = results.filter((r) => Number(r.weighted_average) < 3.0);

        const pmSum = pmValues.reduce((acc, val) => acc + val, 0);
        const avgGlobalPm = totalFactors > 0 ? Math.round((pmSum / totalFactors) * 100) / 100 : 0;
        const deltaGlobal = Math.round((avgGlobalPm - 3.0) * 100) / 100;
        const passingRate = totalFactors > 0 ? Math.round((passingFactors.length / totalFactors) * 100) : 0;

        return {
            totalFactors,
            passingCount: passingFactors.length,
            failingCount: failingFactors.length,
            passingRate,
            avgGlobalPm,
            deltaGlobal,
            isGlobalPassing: avgGlobalPm >= 3.0,
        };
    }, [results]);

    // ── 2. Distribución de Calificaciones de Subfactores (Escala 1 a 4) ──
    const ratingDistribution = useMemo(() => {
        const counts = { 4: 0, 3: 0, 2: 0, 1: 0, unrated: 0 };
        subfactors.forEach((sf) => {
            if (sf.rating === 4) counts[4]++;
            else if (sf.rating === 3) counts[3]++;
            else if (sf.rating === 2) counts[2]++;
            else if (sf.rating === 1) counts[1]++;
            else counts.unrated++;
        });

        const totalRated = counts[4] + counts[3] + counts[2] + counts[1];
        const pointsTotal = counts[4] * 4 + counts[3] * 3 + counts[2] * 2 + counts[1] * 1;

        return {
            ...counts,
            totalRated,
            pointsTotal,
            pct4: totalRated > 0 ? Math.round((counts[4] / totalRated) * 100) : 0,
            pct3: totalRated > 0 ? Math.round((counts[3] / totalRated) * 100) : 0,
            pct2: totalRated > 0 ? Math.round((counts[2] / totalRated) * 100) : 0,
            pct1: totalRated > 0 ? Math.round((counts[1] / totalRated) * 100) : 0,
        };
    }, [subfactors]);

    // ── 3. Agrupación y Dispersión por Dimensión ──
    const dimensionsAnalysis = useMemo(() => {
        const dimMap = new Map<
            string,
            { name: string; factorsCount: number; results: EvaluationResultItem[] }
        >();

        factors.forEach((f) => {
            const dimName = f.dimension_name || 'Sin Dimensión';
            const cur = dimMap.get(dimName) || { name: dimName, factorsCount: 0, results: [] };
            cur.factorsCount++;
            const r = results.find((res) => res.factor_id === f.factor_id);
            if (r) cur.results.push(r);
            dimMap.set(dimName, cur);
        });

        return Array.from(dimMap.values()).map((dim) => {
            const pmValues = dim.results.map((r) => Number(r.weighted_average || 0));
            const pmSum = pmValues.reduce((acc, val) => acc + val, 0);
            const avgPm = dim.results.length > 0 ? Math.round((pmSum / dim.results.length) * 10) / 10 : 0;
            const passingCount = dim.results.filter((r) => Number(r.weighted_average) >= 3.0).length;
            const totalCount = dim.results.length;
            const passingRate = totalCount > 0 ? Math.round((passingCount / totalCount) * 100) : 0;

            const minPm = pmValues.length > 0 ? Math.min(...pmValues) : 0;
            const maxPm = pmValues.length > 0 ? Math.max(...pmValues) : 0;

            const lowestFactor = dim.results.reduce(
                (min, r) => (Number(r.weighted_average) < Number(min.weighted_average || 0) ? r : min),
                dim.results[0]
            );

            return {
                name: dim.name,
                factorsCount: dim.factorsCount,
                avgPm,
                delta: Math.round((avgPm - 3.0) * 10) / 10,
                passingCount,
                totalCount,
                passingRate,
                minPm,
                maxPm,
                isPassing: avgPm >= 3.0,
                lowestFactor,
            };
        });
    }, [factors, results]);

    const dimensionNames = useMemo(() => {
        return Array.from(new Set(factors.map((f) => f.dimension_name || 'Sin Dimensión')));
    }, [factors]);

    // ── 4. Factores Clasificados en Aptos (PM >= 3.0) y Brechas (PM < 3.0) ──
    const classifiedFactors = useMemo(() => {
        const enriched = results.map((r) => {
            const f = factors.find((fac) => fac.factor_id === r.factor_id);
            const dimensionName = f?.dimension_name || 'Sin Dimensión';
            const factorCode = getFactorCode(r.factor_name, dimensionName);
            const pm = Number(r.weighted_average || 0);
            const isPassing = pm >= 3.0;
            const delta = Math.round((pm - 3.0) * 100) / 100;
            const ir = f?.relative_importance ?? 3;
            const isCriticalIR = ir >= 3;
            const scope = f?.scope_used || 'external';

            return {
                ...r,
                factorCode,
                dimensionName,
                pm,
                isPassing,
                delta,
                ir,
                isCriticalIR,
                scope,
            };
        });

        const filtered = enriched.filter((item) => {
            const matchesQuery =
                filterQuery.trim() === '' ||
                item.factor_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
                item.factorCode.toLowerCase().includes(filterQuery.toLowerCase()) ||
                item.dimensionName.toLowerCase().includes(filterQuery.toLowerCase());

            const matchesDim =
                selectedDimensionFilter === 'all' || item.dimensionName === selectedDimensionFilter;

            return matchesQuery && matchesDim;
        });

        const passing = filtered
            .filter((item) => item.isPassing)
            .sort((a, b) => b.pm - a.pm);

        const failing = filtered
            .filter((item) => !item.isPassing)
            .sort((a, b) => a.pm - b.pm);

        return { passing, failing, allCount: filtered.length };
    }, [results, factors, filterQuery, selectedDimensionFilter]);

    return (
        <div className="space-y-4 text-xs font-sans text-[var(--color-text-primary)]">
            {/* ── SECCIÓN 1: FRANJA EJECUTIVA INTEGRADA (SIN CUADROS AISLADOS) ── */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--color-border-subtle)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 shadow-xs overflow-hidden">
                {/* 1. PM Global */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                        <span className="font-medium flex items-center gap-1.5">
                            <Target size={13} className="text-[var(--color-text-tertiary)]" />
                            Ponderación Media Global
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">Umbral 3.0</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 my-0.5 font-mono">
                        <span className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
                            {globalMetrics.avgGlobalPm.toFixed(2)}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">/ 4.00</span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono flex items-center justify-between">
                        <span className={globalMetrics.isGlobalPassing ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                            {globalMetrics.isGlobalPassing ? 'Apto para Adopción' : 'Bajo Umbral Crítico'}
                        </span>
                        <span className="text-[var(--color-text-tertiary)]">
                            {globalMetrics.deltaGlobal >= 0 ? `+${globalMetrics.deltaGlobal.toFixed(2)}` : globalMetrics.deltaGlobal.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* 2. Factores Aptos */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                        <span className="font-medium flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-[var(--color-text-tertiary)]" />
                            Factores Aptos (PM ≥ 3.0)
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">{globalMetrics.passingRate}%</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 my-0.5 font-mono">
                        <span className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
                            {globalMetrics.passingCount}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">/ {globalMetrics.totalFactors} factores</span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-[var(--color-text-secondary)]">
                        <span>{globalMetrics.failingCount} {globalMetrics.failingCount === 1 ? 'factor requiere' : 'factores requieren'} mitigación</span>
                    </div>
                </div>

                {/* 3. Subfactores Calificados */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                        <span className="font-medium flex items-center gap-1.5">
                            <Layers size={13} className="text-[var(--color-text-tertiary)]" />
                            Subfactores Evaluados
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">Σ {ratingDistribution.pointsTotal} pts</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 my-0.5 font-mono">
                        <span className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
                            {ratingDistribution.totalRated}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)]">/ {subfactors.length} criterios</span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-[var(--color-text-secondary)]">
                        <span>Calificación modal: Nivel {ratingDistribution[4] >= ratingDistribution[3] ? '4' : '3'}</span>
                    </div>
                </div>

                {/* 4. Balance FODA */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                        <span className="font-medium flex items-center gap-1.5">
                            <BarChart3 size={13} className="text-[var(--color-text-tertiary)]" />
                            Balance Metodológico
                        </span>
                        <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">2×2</span>
                    </div>
                    <div className="flex items-baseline gap-1.5 my-0.5 font-mono">
                        <span className="text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
                            {globalMetrics.passingCount} <span className="text-xs text-[var(--color-text-tertiary)] font-normal">Fav /</span> {globalMetrics.failingCount} <span className="text-xs text-[var(--color-text-tertiary)] font-normal">Riesgo</span>
                        </span>
                    </div>
                    <div className="mt-1 text-[10px] font-mono text-[var(--color-text-secondary)]">
                        <span>Relación: {globalMetrics.failingCount > 0 ? (globalMetrics.passingCount / globalMetrics.failingCount).toFixed(1) : '∞'}:1 favorable</span>
                    </div>
                </div>
            </div>

            {/* ── SECCIÓN 2: DISTRIBUCIÓN CONTINUA DE SUBFACTORES (SIN CAJAS ANIDADAS) ── */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between pb-1 border-b border-[var(--color-border-subtle)]">
                    <span className="font-bold font-mono text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Composición Cuantitativa de Criterios (Escala 1 a 4)
                    </span>
                    <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                        {ratingDistribution.totalRated} subfactores activos
                    </span>
                </div>

                {/* Barra continua proporcional */}
                <div className="h-2 w-full rounded-full bg-[var(--color-bg-page)] flex overflow-hidden">
                    <div
                        style={{ width: `${ratingDistribution.pct4}%` }}
                        className="bg-emerald-600 dark:bg-emerald-500 h-full transition-all duration-300"
                        title={`Satisfactorio (4): ${ratingDistribution[4]} subfactores (${ratingDistribution.pct4}%)`}
                    />
                    <div
                        style={{ width: `${ratingDistribution.pct3}%` }}
                        className="bg-zinc-600 dark:bg-zinc-500 h-full transition-all duration-300"
                        title={`Parcial (3): ${ratingDistribution[3]} subfactores (${ratingDistribution.pct3}%)`}
                    />
                    <div
                        style={{ width: `${ratingDistribution.pct2}%` }}
                        className="bg-amber-600 dark:bg-amber-500 h-full transition-all duration-300"
                        title={`Desconozco (2): ${ratingDistribution[2]} subfactores (${ratingDistribution.pct2}%)`}
                    />
                    <div
                        style={{ width: `${ratingDistribution.pct1}%` }}
                        className="bg-rose-600 dark:bg-rose-500 h-full transition-all duration-300"
                        title={`No Cumple (1): ${ratingDistribution[1]} subfactores (${ratingDistribution.pct1}%)`}
                    />
                </div>

                {/* Leyenda limpia sin cajas con bordes */}
                <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-4 pt-1 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>4 • Satisfactorio:</span>
                        <strong className="text-[var(--color-text-primary)]">{ratingDistribution[4]} ({ratingDistribution.pct4}%)</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-zinc-500 shrink-0" />
                        <span>3 • Parcial:</span>
                        <strong className="text-[var(--color-text-primary)]">{ratingDistribution[3]} ({ratingDistribution.pct3}%)</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span>2 • Desconozco:</span>
                        <strong className="text-[var(--color-text-primary)]">{ratingDistribution[2]} ({ratingDistribution.pct2}%)</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <span>1 • No Cumple:</span>
                        <strong className="text-[var(--color-text-primary)]">{ratingDistribution[1]} ({ratingDistribution.pct1}%)</strong>
                    </div>
                </div>
            </div>

            {/* ── SECCIÓN 3: DESEMPEÑO POR DIMENSIÓN (PANEL UNIFICADO) ── */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-border-subtle)]">
                    <span className="font-bold font-mono text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Desempeño y Dispersión Cuantitativa por Dimensión
                    </span>
                    <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                        Rango: [Mínimo — Máximo] vs Umbral 3.00
                    </span>
                </div>

                <div className="divide-y md:divide-y-0 md:divide-x divide-[var(--color-border-subtle)] grid grid-cols-1 md:grid-cols-3">
                    {dimensionsAnalysis.map((dim) => (
                        <div key={dim.name} className="py-2 md:py-0 md:px-4 first:pl-0 last:pr-0 space-y-2">
                            <div className="flex items-baseline justify-between">
                                <span className="font-bold text-xs text-[var(--color-text-primary)]">
                                    {dim.name}
                                </span>
                                <span className={`text-[10px] font-mono font-semibold ${
                                    dim.isPassing ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                    {dim.isPassing ? 'Cumple' : 'En riesgo'}
                                </span>
                            </div>

                            <div className="flex items-baseline justify-between font-mono">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-[var(--color-text-primary)]">
                                        PM {dim.avgPm.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-tertiary)]">/ 4.00</span>
                                </div>
                                <span className={`text-[11px] font-bold ${
                                    dim.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                    {dim.delta >= 0 ? `+${dim.delta.toFixed(1)}` : dim.delta.toFixed(1)} vs 3.0
                                </span>
                            </div>

                            <div className="text-[10px] font-mono space-y-0.5 text-[var(--color-text-secondary)] pt-1 border-t border-[var(--color-border-subtle)]/40">
                                <div className="flex justify-between">
                                    <span>Superados:</span>
                                    <span className="text-[var(--color-text-primary)] font-semibold">{dim.passingCount} de {dim.totalCount} ({dim.passingRate}%)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Rango:</span>
                                    <span className="text-[var(--color-text-primary)] font-semibold">[{dim.minPm.toFixed(1)} - {dim.maxPm.toFixed(1)}]</span>
                                </div>
                                {dim.lowestFactor && (
                                    <div className="flex justify-between truncate">
                                        <span className="text-[var(--color-text-tertiary)]">Punto crítico:</span>
                                        <span className="text-[var(--color-text-primary)] font-medium truncate ml-1" title={dim.lowestFactor.factor_name}>
                                            {dim.lowestFactor.factor_name} ({Number(dim.lowestFactor.weighted_average).toFixed(1)})
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SECCIÓN 4: DISPERSIÓN DE FACTORES (SUPERAVIT VS BRECHAS) ── */}
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 space-y-3 shadow-xs">
                {/* Cabecera con Filtros Limpios */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                    <span className="font-bold font-mono text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider">
                        Factores Clasificados por Desempeño Cuantitativo ({classifiedFactors.allCount})
                    </span>

                    <div className="flex items-center gap-2">
                        <select
                            value={selectedDimensionFilter}
                            onChange={(e) => setSelectedDimensionFilter(e.target.value)}
                            className="px-2 py-0.5 text-[11px] font-mono rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:outline-none cursor-pointer"
                        >
                            <option value="all">Todas las dimensiones</option>
                            {dimensionNames.map((d) => (
                                <option key={d} value={d}>
                                    {d}
                                </option>
                            ))}
                        </select>

                        <div className="relative">
                            <Search size={11} className="absolute left-2 top-2 text-[var(--color-text-tertiary)]" />
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Buscar factor..."
                                className="pl-6 pr-2 py-0.5 text-[11px] rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none w-36"
                            />
                        </div>
                    </div>
                </div>

                {/* Dos Columnas Limpias con Divisores Hairline — Sin Cajas Anidadas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    {/* Superan Umbral */}
                    <div className="space-y-1">
                        <div className="pb-1.5 border-b border-[var(--color-border-subtle)] flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 size={13} />
                                Superan Umbral ({classifiedFactors.passing.length})
                            </span>
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                PM ≥ 3.00
                            </span>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border-subtle)]/40 pr-1">
                            {classifiedFactors.passing.length === 0 ? (
                                <div className="py-4 text-center text-[var(--color-text-tertiary)] text-[11px] font-mono">
                                    No hay factores en este criterio
                                </div>
                            ) : (
                                classifiedFactors.passing.map((item) => (
                                    <div
                                        key={item.factor_id}
                                        className="py-1.5 px-1 flex items-center justify-between gap-2 hover:bg-[var(--color-bg-page)]/50 transition-colors text-xs font-mono"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-[10px] text-[var(--color-text-secondary)]">
                                                    {item.factorCode}
                                                </span>
                                                <span className="font-sans font-medium text-[var(--color-text-primary)] truncate text-xs">
                                                    {item.factor_name}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                                                {item.dimensionName}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0 text-right">
                                            <div>
                                                <span className="font-bold text-xs text-[var(--color-text-primary)] block">
                                                    {item.pm.toFixed(1)}
                                                </span>
                                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 block">
                                                    +{item.delta.toFixed(2)}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono font-medium text-[var(--color-text-secondary)] w-20 text-right">
                                                {item.foda_display || (item.scope === 'internal' ? 'Fortaleza' : 'Oportunidad')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Brechas Cuantitativas */}
                    <div className="space-y-1">
                        <div className="pb-1.5 border-b border-[var(--color-border-subtle)] flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                <ShieldAlert size={13} />
                                Brechas Bajo Umbral ({classifiedFactors.failing.length})
                            </span>
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                PM &lt; 3.00
                            </span>
                        </div>

                        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border-subtle)]/40 pr-1">
                            {classifiedFactors.failing.length === 0 ? (
                                <div className="py-4 text-center text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
                                    ✓ No existen brechas bajo el umbral de 3.00
                                </div>
                            ) : (
                                classifiedFactors.failing.map((item) => (
                                    <div
                                        key={item.factor_id}
                                        className="py-1.5 px-1 flex items-center justify-between gap-2 hover:bg-[var(--color-bg-page)]/50 transition-colors text-xs font-mono"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-[10px] text-[var(--color-text-secondary)]">
                                                    {item.factorCode}
                                                </span>
                                                <span className="font-sans font-medium text-[var(--color-text-primary)] truncate text-xs">
                                                    {item.factor_name}
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-[var(--color-text-tertiary)]">
                                                <span>{item.dimensionName}</span>
                                                <span className="mx-1">•</span>
                                                <span className={item.isCriticalIR ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                                                    IR={item.ir}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 shrink-0 text-right">
                                            <div>
                                                <span className="font-bold text-xs text-[var(--color-text-primary)] block">
                                                    {item.pm.toFixed(1)}
                                                </span>
                                                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block">
                                                    {item.delta.toFixed(2)}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-mono font-medium text-rose-600 dark:text-rose-400 w-20 text-right">
                                                {item.foda_display || (item.scope === 'internal' ? 'Debilidad' : 'Amenaza')}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(EvaluationQuantitativeTab);
