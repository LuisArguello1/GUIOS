/**
 * features/guios/evaluations/components/detail/EvaluationLiteratureTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña Metodológica Oficial de Literatura Indexada (IL):
 * Presentación editorial limpia, sobria y sin ruido visual, basada en el
 * Capítulo 5 (pág. 87 de la Tesis):
 * - Ecuación (5.1): r_i = c_i / n (Razón de citación por subfactor)
 * - Interpolación Lineal (Tipo 7): Cálculo formal paso a paso de los límites Q1, Q2, Q3, Q4
 * - Ecuación (5.2): IL(r_i) = función a trozos con llave matemática
 * - Tabla 5.3 Dinámica: Auditoría por factor e integración con IS = M(IE, IL).
 */

import React, { useMemo, useState, memo } from 'react';
import {
    BookOpen,
    Search,
    ExternalLink,
} from 'lucide-react';
import type { EvaluationDetail, EvaluationFactorItem } from '../../../../../api/evaluationService';
import { getFactorCode } from './FactorMethodologyAuditCard';

interface EvaluationLiteratureTabProps {
    evaluation: EvaluationDetail;
    factors: EvaluationFactorItem[];
    onOpenSources?: (factor: EvaluationFactorItem) => void;
}

const IL_METADATA: Record<number, { name: string; desc: string; textClass: string }> = {
    1: {
        name: 'Irrelevante',
        desc: 'Baja densidad bibliográfica o sin citas indexadas',
        textClass: 'text-[var(--color-text-tertiary)]',
    },
    2: {
        name: 'Opcional',
        desc: 'Densidad bibliográfica moderada-baja',
        textClass: 'text-[var(--color-text-secondary)]',
    },
    3: {
        name: 'Importante',
        desc: 'Alta masa de citas en literatura científica',
        textClass: 'text-amber-600 dark:text-amber-400',
    },
    4: {
        name: 'Fundamental',
        desc: 'Máxima relevancia científica indexada',
        textClass: 'text-emerald-600 dark:text-emerald-400',
    },
};

export const EvaluationLiteratureTab: React.FC<EvaluationLiteratureTabProps> = ({
    evaluation,
    factors,
    onOpenSources,
}) => {
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedILFilter, setSelectedILFilter] = useState<number | null>(null);

    // ── 1. Valores de Cuartiles Registrados en la Evaluación ──
    const q1 = evaluation.q1_threshold !== null ? Number(evaluation.q1_threshold) : 0.0;
    const q2 = evaluation.q2_threshold !== null ? Number(evaluation.q2_threshold) : 0.4;
    const q3 = evaluation.q3_threshold !== null ? Number(evaluation.q3_threshold) : 1.0;
    const q4 = evaluation.q4_threshold !== null ? Number(evaluation.q4_threshold) : 4.0;

    // ── 2. Vector Ordenado R de Razones de Citación ──
    const enrichedFactors = useMemo(() => {
        return factors.map((f) => {
            const n = f.subfactors_count_snapshot || 1;
            const ci = f.citations_count || 0;
            const ri = Number(f.citation_ratio || (ci / n));
            const il = f.literature_importance_calculated || 1;
            const factorCode = getFactorCode(f.factor_name, f.dimension_name);

            let branchCondition = '';
            if (ri <= q1) {
                branchCondition = `rᵢ (${ri.toFixed(2)}) ≤ r_q1 (${q1.toFixed(2)})`;
            } else if (ri <= q2) {
                branchCondition = `r_q1 (${q1.toFixed(2)}) < rᵢ (${ri.toFixed(2)}) ≤ r_q2 (${q2.toFixed(2)})`;
            } else if (ri <= q3) {
                branchCondition = `r_q2 (${q2.toFixed(2)}) < rᵢ (${ri.toFixed(2)}) ≤ r_q3 (${q3.toFixed(2)})`;
            } else {
                branchCondition = `r_q3 (${q3.toFixed(2)}) < rᵢ (${ri.toFixed(2)}) ≤ r_q4 (${q4.toFixed(2)})`;
            }

            return {
                ...f,
                factorCode,
                n,
                ci,
                ri,
                il,
                branchCondition,
            };
        });
    }, [factors, q1, q2, q3, q4]);

    const sortedRatios = useMemo(() => {
        return [...enrichedFactors].map((f) => f.ri).sort((a, b) => a - b);
    }, [enrichedFactors]);

    const N = sortedRatios.length;

    // ── 3. Cálculo Paso a Paso de la Interpolación Lineal (Tipo 7 de R / SciPy) ──
    const interpolationSteps = useMemo(() => {
        if (N === 0) return [];

        const percentiles = [
            { k: 1, p: 0.25, label: 'Q₁ (Percentil 25%)', targetVal: q1 },
            { k: 2, p: 0.50, label: 'Q₂ (Mediana 50%)', targetVal: q2 },
            { k: 3, p: 0.75, label: 'Q₃ (Percentil 75%)', targetVal: q3 },
            { k: 4, p: 1.00, label: 'Q₄ (Máximo 100%)', targetVal: q4 },
        ];

        return percentiles.map(({ k, p, label, targetVal }) => {
            if (k === 4) {
                const maxVal = sortedRatios[N - 1] ?? 0;
                return {
                    k,
                    p,
                    label,
                    posFormula: `pos = N - 1 = ${N} - 1 = ${N - 1}`,
                    calcFormula: `r_q4 = R[${N - 1}] = max(R)`,
                    numericResult: maxVal.toFixed(2),
                    finalThreshold: targetVal.toFixed(2),
                };
            }

            const pos = (N - 1) * p;
            const low = Math.floor(pos);
            const high = Math.min(low + 1, N - 1);
            const w = pos - low;

            const rLow = sortedRatios[low] ?? 0;
            const rHigh = sortedRatios[high] ?? 0;
            const interpolated = (1 - w) * rLow + w * rHigh;

            return {
                k,
                p,
                label,
                posFormula: `pos_${k} = (N - 1) · ${p} = (${N} - 1) · ${p} = ${pos.toFixed(2)}`,
                calcFormula: `(1 - ${w.toFixed(2)})·R[${low}](${rLow.toFixed(2)}) + ${w.toFixed(2)}·R[${high}](${rHigh.toFixed(2)}) = ${interpolated.toFixed(2)}`,
                numericResult: interpolated.toFixed(2),
                finalThreshold: targetVal.toFixed(2),
            };
        });
    }, [sortedRatios, N, q1, q2, q3, q4]);

    const ilCounts = useMemo(() => {
        return {
            1: enrichedFactors.filter((f) => f.il === 1).length,
            2: enrichedFactors.filter((f) => f.il === 2).length,
            3: enrichedFactors.filter((f) => f.il === 3).length,
            4: enrichedFactors.filter((f) => f.il === 4).length,
        };
    }, [enrichedFactors]);

    const filteredFactors = useMemo(() => {
        return enrichedFactors.filter((f) => {
            const matchesSearch =
                searchFilter.trim() === '' ||
                f.factor_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                f.factorCode.toLowerCase().includes(searchFilter.toLowerCase()) ||
                f.dimension_name.toLowerCase().includes(searchFilter.toLowerCase());

            const matchesIL = selectedILFilter === null || f.il === selectedILFilter;

            return matchesSearch && matchesIL;
        });
    }, [enrichedFactors, searchFilter, selectedILFilter]);

    return (
        <div className="space-y-6 text-xs font-sans text-[var(--color-text-primary)]">
            {/* ── SECCIÓN 1: FORMULACIÓN EDITORIAL DE LA TESIS (CAPÍTULO 5, PÁG. 87) ── */}
            <section className="space-y-4">
                <div className="flex items-baseline justify-between border-b border-[var(--color-border-subtle)] pb-2">
                    <div>
                        <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <BookOpen size={13} className="text-[var(--color-text-secondary)]" />
                            Capítulo 5: Formulación Matemática de la Literatura Indexada (IL)
                        </h2>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                            Ecuaciones (5.1) y (5.2) oficiales para la calibración de cuartiles bibliográficos.
                        </p>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                        Muestra: {N} factores evaluados
                    </span>
                </div>

                {/* Pasos a) y b): Definición de razón r_i */}
                <div className="space-y-2 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    <p>
                        <strong className="text-[var(--color-text-primary)] font-mono">a)</strong> Por cada factor{' '}
                        <span className="font-mono font-bold text-[var(--color-text-primary)]">i</span> se obtiene la
                        cantidad de citas (<span className="font-mono font-bold text-[var(--color-text-primary)]">cᵢ</span>)
                        recibidas por sus respectivos subfactores (<span className="font-mono font-bold text-[var(--color-text-primary)]">n</span>)
                        indexadas en bases de datos científicas (IEEE, ACM, Scopus, WOS, OpenAlex).
                    </p>

                    <p>
                        <strong className="text-[var(--color-text-primary)] font-mono">b)</strong> Se divide la cantidad de citas
                        entre el total de subfactores del factor en cuestión:
                    </p>

                    {/* Ecuación 5.1 centrada y limpia */}
                    <div className="py-2.5 px-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded flex items-center justify-between font-mono">
                        <div className="flex items-center gap-3 text-xs sm:text-sm pl-2">
                            <span className="font-bold text-[var(--color-text-primary)]">rᵢ</span>
                            <span className="text-[var(--color-text-tertiary)]">=</span>
                            <div className="inline-flex flex-col items-center">
                                <span className="border-b border-[var(--color-text-primary)] px-2 pb-0.5 font-bold text-[var(--color-text-primary)]">
                                    cᵢ
                                </span>
                                <span className="pt-0.5 font-medium text-[var(--color-text-secondary)]">
                                    n
                                </span>
                            </div>
                            <span className="text-[11px] text-[var(--color-text-tertiary)] hidden md:inline ml-3 font-sans">
                                (Citas totales recibidas por subfactores / Cantidad de subfactores del factor)
                            </span>
                        </div>
                        <span className="text-xs font-bold text-[var(--color-text-tertiary)] pr-1">
                            (5.1)
                        </span>
                    </div>
                </div>

                {/* ── CÁLCULO FORMAL DE INTERPOLACIÓN LINEAL (TIPO 7) ── */}
                <div className="space-y-2 text-[11px]">
                    <div className="flex items-baseline justify-between">
                        <span className="font-mono font-bold text-[var(--color-text-primary)]">
                            Deducción de Límites de Cuartiles por Interpolación Lineal (Tipo 7):
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                            Fórmula general: pos = (N - 1)·p ⟹ r_q = (1 - w)·R[low] + w·R[high]
                        </span>
                    </div>

                    <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded bg-[var(--color-bg-surface)]">
                        <table className="w-full text-left font-mono text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-tertiary)] uppercase bg-[var(--color-bg-page)]/40">
                                    <th className="py-1.5 px-3">Cuartil</th>
                                    <th className="py-1.5 px-3">Percentil (p)</th>
                                    <th className="py-1.5 px-3">Posición en Muestra (pos)</th>
                                    <th className="py-1.5 px-3">Interpolación Aritmética</th>
                                    <th className="py-1.5 px-3 text-right">Límite Calculado (r_qk)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]/50">
                                {interpolationSteps.map((step) => (
                                    <tr key={step.k} className="hover:bg-[var(--color-bg-page)]/50">
                                        <td className="py-1.5 px-3 font-bold text-[var(--color-text-primary)]">
                                            {step.label}
                                        </td>
                                        <td className="py-1.5 px-3 text-[var(--color-text-secondary)]">
                                            p = {step.p}
                                        </td>
                                        <td className="py-1.5 px-3 text-[var(--color-text-secondary)]">
                                            {step.posFormula}
                                        </td>
                                        <td className="py-1.5 px-3 text-[var(--color-text-tertiary)]">
                                            {step.calcFormula}
                                        </td>
                                        <td className="py-1.5 px-3 text-right font-black text-xs text-[var(--color-text-primary)]">
                                            r_q{step.k} = {step.finalThreshold}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Vector ordenado de razones empíricas */}
                    <div className="p-2 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-secondary)] flex flex-wrap items-center gap-1">
                        <span className="font-bold text-[var(--color-text-primary)]">Vector R ({N} razones ordenadas):</span>
                        <span>[</span>
                        {sortedRatios.map((val, idx) => (
                            <span key={idx} className="text-[var(--color-text-primary)] font-medium">
                                {val.toFixed(2)}{idx < N - 1 ? ', ' : ''}
                            </span>
                        ))}
                        <span>]</span>
                    </div>
                </div>

                {/* Paso c: Ecuación 5.2 con Llave Matemática */}
                <div className="space-y-2 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                    <p>
                        <strong className="text-[var(--color-text-primary)] font-mono">c)</strong> Se le asigna un rango
                        de cuartil en función de la posición que ocupa{' '}
                        <span className="font-mono font-bold text-[var(--color-text-primary)]">rᵢ</span> en el conjunto de
                        todas las <span className="font-mono font-bold text-[var(--color-text-primary)]">r</span> calculadas
                        a los factores:
                    </p>

                    {/* Caja Matemática de Ecuación 5.2 */}
                    <div className="py-3 px-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded overflow-x-auto">
                        <div className="flex items-center justify-between min-w-[540px]">
                            <div className="flex items-center gap-2.5">
                                <div className="font-mono text-sm sm:text-base font-bold text-[var(--color-text-primary)] shrink-0">
                                    IL(rᵢ) =
                                </div>

                                {/* Llave matemática SVG vectorial limpia */}
                                <svg
                                    viewBox="0 0 16 96"
                                    className="h-24 w-3.5 text-[var(--color-text-primary)] shrink-0 select-none opacity-80"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                >
                                    <path d="M 13,3 C 7,3 5,14 5,24 L 5,42 C 5,46 1,48 1,48 C 1,48 5,50 5,54 L 5,72 C 5,82 7,93 13,93" />
                                </svg>

                                <div className="grid grid-cols-[auto_auto_auto_auto] items-center gap-x-3 gap-y-1 text-xs font-mono py-0.5">
                                    <span className="font-bold text-sm text-[var(--color-text-primary)]">1</span>
                                    <span className="text-[var(--color-text-primary)]">si rᵢ ≤ r_q1,</span>
                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">[rᵢ ≤ {q1.toFixed(2)}]</span>
                                    <span className={`text-[11px] font-sans ${IL_METADATA[1].textClass}`}>· {IL_METADATA[1].name} ({ilCounts[1]} factores)</span>

                                    <span className="font-bold text-sm text-[var(--color-text-primary)]">2</span>
                                    <span className="text-[var(--color-text-primary)]">si r_q1 &lt; rᵢ ≤ r_q2,</span>
                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">[{q1.toFixed(2)} &lt; rᵢ ≤ {q2.toFixed(2)}]</span>
                                    <span className={`text-[11px] font-sans ${IL_METADATA[2].textClass}`}>· {IL_METADATA[2].name} ({ilCounts[2]} factores)</span>

                                    <span className="font-bold text-sm text-[var(--color-text-primary)]">3</span>
                                    <span className="text-[var(--color-text-primary)]">si r_q2 &lt; rᵢ ≤ r_q3,</span>
                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">[{q2.toFixed(2)} &lt; rᵢ ≤ {q3.toFixed(2)}]</span>
                                    <span className={`text-[11px] font-sans ${IL_METADATA[3].textClass}`}>· {IL_METADATA[3].name} ({ilCounts[3]} factores)</span>

                                    <span className="font-bold text-sm text-[var(--color-text-primary)]">4</span>
                                    <span className="text-[var(--color-text-primary)]">si r_q3 &lt; rᵢ ≤ r_q4</span>
                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">[{q3.toFixed(2)} &lt; rᵢ ≤ {q4.toFixed(2)}]</span>
                                    <span className={`text-[11px] font-sans ${IL_METADATA[4].textClass}`}>· {IL_METADATA[4].name} ({ilCounts[4]} factores)</span>
                                </div>
                            </div>

                            <span className="text-xs font-mono font-bold text-[var(--color-text-tertiary)] pr-1 shrink-0">
                                (5.2)
                            </span>
                        </div>
                    </div>

                    <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed pt-1">
                        De lo anterior se desprende que los factores con <strong className="text-[var(--color-text-primary)] font-mono">IL = 4</strong> son
                        los de mayor masa bibliográfica en la literatura, mientras que <strong className="text-[var(--color-text-primary)] font-mono">IL = 1</strong> agrupa
                        aquellos sin respaldo suficiente. Tanto la importancia del experto (<span className="font-mono">IE</span>) como la de literatura (<span className="font-mono">IL</span>) operan
                        en el mismo rango acotado <span className="font-mono">[1.0, 4.0]</span> para el cruce determinista <span className="font-mono font-semibold">IS = M(IE, IL)</span>.
                    </p>
                </div>
            </section>

            {/* ── SECCIÓN 2: TABLA 5.3 DINÁMICA DE LA EVALUACIÓN ── */}
            <section className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-2">
                    <span className="font-bold font-mono text-xs uppercase tracking-wider text-[var(--color-text-primary)]">
                        Tabla 5.3 Dinámica: Clasificación IL por Factor ({filteredFactors.length} factores)
                    </span>

                    <div className="flex items-center gap-2">
                        {/* Filtro segmentado de IL */}
                        <div className="inline-flex rounded p-0.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[11px] font-mono">
                            <button
                                type="button"
                                onClick={() => setSelectedILFilter(null)}
                                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                    selectedILFilter === null
                                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-bold'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            >
                                Todos
                            </button>
                            {[1, 2, 3, 4].map((lvl) => (
                                <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setSelectedILFilter(selectedILFilter === lvl ? null : lvl)}
                                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                                        selectedILFilter === lvl
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-bold'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                    }`}
                                >
                                    IL={lvl}
                                </button>
                            ))}
                        </div>

                        {/* Buscador */}
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-2 text-[var(--color-text-tertiary)]" />
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                placeholder="Buscar factor..."
                                className="pl-6 pr-2 py-1 text-[11px] rounded bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)] w-36"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded bg-[var(--color-bg-surface)]">
                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-tertiary)] uppercase bg-[var(--color-bg-page)]/40">
                                <th className="py-2 px-3">Código</th>
                                <th className="py-2 px-3">Factor Metodológico</th>
                                <th className="py-2 px-3 text-center">Subfactores (n)</th>
                                <th className="py-2 px-3 text-center">Citas (cᵢ)</th>
                                <th className="py-2 px-3 text-center">Razón rᵢ = cᵢ/n</th>
                                <th className="py-2 px-3">Regla Ecuación (5.2)</th>
                                <th className="py-2 px-3 text-center">IL</th>
                                <th className="py-2 px-3 text-center">IE</th>
                                <th className="py-2 px-3 text-right">IS = M(IE, IL)</th>
                                <th className="py-2 px-2 text-center">Fuentes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]/50">
                            {filteredFactors.map((f) => {
                                const ilInfo = IL_METADATA[f.il];
                                const ie = f.expert_importance_snapshot || 3;
                                const is = f.systemic_importance_snapshot || 3;

                                return (
                                    <tr key={f.factor_id} className="hover:bg-[var(--color-bg-page)]/40 transition-colors">
                                        <td className="py-2 px-3 font-bold text-[var(--color-text-primary)]">
                                            {f.factorCode}
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className="font-sans font-medium text-[var(--color-text-primary)] block truncate max-w-[220px]" title={f.factor_name}>
                                                {f.factor_name}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                                                {f.dimension_name} • {f.scope_used === 'internal' ? 'Interno' : 'Externo'}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-center font-bold text-[var(--color-text-primary)]">
                                            {f.n}
                                        </td>
                                        <td className="py-2 px-3 text-center font-bold text-[var(--color-text-primary)]">
                                            {f.ci}
                                        </td>
                                        <td className="py-2 px-3 text-center font-black text-xs text-[var(--color-text-primary)]">
                                            {f.ri.toFixed(2)}
                                        </td>
                                        <td className="py-2 px-3 text-[10px] text-[var(--color-text-secondary)]">
                                            {f.branchCondition}
                                        </td>
                                        <td className="py-2 px-3 text-center font-bold">
                                            <span className={ilInfo.textClass}>
                                                IL = {f.il}
                                            </span>
                                        </td>
                                        <td className="py-2 px-3 text-center text-[var(--color-text-secondary)]">
                                            {ie}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-[var(--color-text-primary)]">
                                            <span>IS = {is}</span>
                                            <span className="text-[9px] text-[var(--color-text-tertiary)] block font-normal">
                                                M({ie}, {f.il})
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-center">
                                            {onOpenSources && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSources(f)}
                                                    className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                                                    title={`Ver DOIs y citas indexadas de ${f.factor_name}`}
                                                >
                                                    <ExternalLink size={12} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default memo(EvaluationLiteratureTab);
