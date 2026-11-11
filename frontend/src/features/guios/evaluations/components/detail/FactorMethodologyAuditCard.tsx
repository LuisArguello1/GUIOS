/**
 * features/guios/evaluations/components/detail/FactorMethodologyAuditCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de Auditoría Metodológica del Factor (GUIOS):
 * Presentación formal y matemática de:
 * 1. Ponderación Media (PM): Fracción matemática, tabla de frecuencias y criterio de umbral.
 * 2. Importancia Sistémica (IS): Parámetros (NS, TC, r_i, IL, IE) y Matriz de Combinación 4x4 (Tabla 5.3).
 * 3. Importancia Relativa (IR): Combinación vinculante IR = M(ID, IS) que rige el dictamen final.
 *
 * Principio de diseño:
 * - Rigor matemático sin ruido visual ni contenedores innecesarios.
 * - Celda activa en la matriz con alto contraste limpio y legible en ambos temas.
 * - Sin cajas anidadas dentro de cajas.
 */

import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';

import type {
    EvaluationFactorItem,
    EvaluationSubfactorItem,
    EvaluationResultItem,
} from '../../../../../api/evaluationService';

import { COMBINATION_MATRIX } from '../../../../../calculations/combinationMatrix';
import { getFactorCode } from '../../utils/factorCodes';

interface FactorMethodologyAuditCardProps {
    factor: EvaluationFactorItem;
    subfactors: EvaluationSubfactorItem[];
    result?: EvaluationResultItem;
    activeRatingFilter: number | null;
    onSelectRatingFilter: (rating: number | null) => void;
}

const IMPORTANCE_LABELS: Record<number, string> = {
    1: 'Irrelevante',
    2: 'Opcional',
    3: 'Importante',
    4: 'Fundamental',
};

const RATING_NAMES: Record<number, string> = {
    4: 'Satisfactorio',
    3: 'Parcial',
    2: 'Desconozco',
    1: 'No Cumple',
};

export const FactorMethodologyAuditCard: React.FC<FactorMethodologyAuditCardProps> = ({
    factor,
    subfactors,
    result,
    activeRatingFilter,
    onSelectRatingFilter,
}) => {
    const [matrixMode, setMatrixMode] = useState<'IS' | 'IR'>('IS');

    const factorCode = useMemo(
        () => getFactorCode(factor.factor_name, factor.dimension_name),
        [factor.factor_name, factor.dimension_name]
    );

    // ── 1. Parámetros de la Importancia Sistémica (IS) ──
    const ns = factor.subfactors_count_snapshot || subfactors.length || 1;
    const tc = factor.citations_count || 0;
    const ratio = Number(factor.citation_ratio || (tc / ns)).toFixed(2);
    const ie = Math.max(1, Math.min(4, factor.expert_importance_snapshot || 3));
    const il = Math.max(1, Math.min(4, factor.literature_importance_calculated || 1));
    const is = factor.systemic_importance_snapshot || COMBINATION_MATRIX[ie]?.[il] || 3;
    const isLabel = IMPORTANCE_LABELS[is] || 'Importante';

    // ── 2. Parámetros de la Importancia Relativa (IR) ──
    const id = Math.max(1, Math.min(4, factor.decisor_importance ?? factor.ai_suggested_id ?? 3));
    const ir = factor.relative_importance ?? COMBINATION_MATRIX[id]?.[is] ?? 3;
    const irLabel = IMPORTANCE_LABELS[ir] || 'Importante';
    const isCriticalIR = ir >= 3;

    // ── 3. Parámetros y Cálculo de la Ponderación Media (PM) ──
    const counts = useMemo(() => {
        const c = { 4: 0, 3: 0, 2: 0, 1: 0, unrated: 0 };
        subfactors.forEach((sf) => {
            if (sf.rating === 4) c[4]++;
            else if (sf.rating === 3) c[3]++;
            else if (sf.rating === 2) c[2]++;
            else if (sf.rating === 1) c[1]++;
            else c.unrated++;
        });
        return c;
    }, [subfactors]);

    const totalSubfactors = subfactors.length || ns;
    const ratedCount = totalSubfactors - counts.unrated;
    const pointsSum = counts[4] * 4 + counts[3] * 3 + counts[2] * 2 + counts[1] * 1;
    const dynamicAverage = ratedCount > 0 ? pointsSum / ratedCount : 0;
    const pm = result?.weighted_average ? Number(result.weighted_average) : Math.round(dynamicAverage * 10) / 10;
    const meetsThreshold = pm >= 3.0;

    const isInternal = factor.scope_used === 'internal';
    const fodaType = isInternal
        ? meetsThreshold
            ? 'Fortaleza'
            : 'Debilidad'
        : meetsThreshold
        ? 'Oportunidad'
        : 'Amenaza';

    // Variables dinámicas según el modo de la matriz (IS vs IR)
    const activeRow = matrixMode === 'IS' ? ie : id;
    const activeCol = matrixMode === 'IS' ? il : is;
    const rowTitle = matrixMode === 'IS' ? 'IE (Expertos)' : 'ID (Decisor)';
    const colTitle = matrixMode === 'IS' ? 'IL (Literatura)' : 'IS (Sistémica)';
    const resultTitle = matrixMode === 'IS' ? 'IS' : 'IR';

    return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 space-y-3 font-sans text-xs">
            {/* ── Barra Superior Limpia y Despejada ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                        {factorCode}
                    </span>
                    <span className="text-[var(--color-text-tertiary)]">•</span>
                    <span className="font-bold text-xs text-[var(--color-text-primary)]">
                        {factor.factor_name}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                        ({factor.dimension_name})
                    </span>
                    <span className="inline-flex items-center text-[10px] text-[var(--color-text-tertiary)]" title="Catálogo base protegido">
                        <Lock size={10} />
                    </span>
                </div>

                {/* Parámetros Metodológicos en línea limpia sin ruido */}
                <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    <span>Ámbito: <strong className="text-[var(--color-text-primary)]">{isInternal ? 'Interno' : 'Externo'}</strong></span>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <span>IE: <strong className="text-[var(--color-text-primary)]">{ie}</strong></span>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <span>IL: <strong className="text-[var(--color-text-primary)]">{il}</strong></span>
                    <span className="text-[var(--color-text-tertiary)]">·</span>
                    <button
                        type="button"
                        onClick={() => setMatrixMode('IS')}
                        className={`transition-colors cursor-pointer ${
                            matrixMode === 'IS'
                                ? 'text-[var(--color-primary)] font-bold underline underline-offset-2'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }`}
                        title="Ver cálculo de IS en la matriz"
                    >
                        IS: {is}
                    </button>
                    <span className="text-[var(--color-text-tertiary)]">⟹</span>
                    <button
                        type="button"
                        onClick={() => setMatrixMode('IR')}
                        className={`transition-colors cursor-pointer ${
                            matrixMode === 'IR'
                                ? 'text-[var(--color-primary)] font-bold underline underline-offset-2'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                        }`}
                        title="Ver cálculo de IR en la matriz"
                    >
                        IR: {ir}
                    </button>
                    <span className={`text-[10px] font-semibold ${
                        isCriticalIR
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[var(--color-text-tertiary)]'
                    }`}>
                        ({isCriticalIR ? 'Crítico ≥3' : 'Moderado =2'})
                    </span>
                </div>
            </div>

            {/* ── Cuerpo Principal: 2 Columnas Limpias ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                {/* ── Columna 1: Ponderación Media (PM) ── */}
                <div className="flex flex-col justify-between space-y-2.5">
                    <div>
                        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-border-subtle)]">
                            <span className="font-bold text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider font-mono">
                                Ponderación Media (PM)
                            </span>
                            <div className="flex items-center gap-1.5 font-mono">
                                <span className="font-bold text-xs text-[var(--color-text-primary)]">
                                    PM = {pm.toFixed(1)}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-tertiary)]">/ 4.0</span>
                                <span className={`text-[10px] font-semibold ${
                                    meetsThreshold
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                    • {fodaType}
                                </span>
                            </div>
                        </div>

                        {/* Fracción Matemática Limpia */}
                        <div className="my-2 py-2 flex items-center justify-center font-mono text-xs">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-[var(--color-text-primary)]">PM</span>
                                <span className="text-[var(--color-text-tertiary)]">=</span>
                                <div className="inline-flex flex-col items-center">
                                    <span className="border-b border-[var(--color-text-primary)] px-2 pb-0.5 text-[11px] font-medium text-[var(--color-text-primary)]">
                                        Σ sᵢ ({pointsSum} pts)
                                    </span>
                                    <span className="pt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                                        n ({ratedCount || totalSubfactors})
                                    </span>
                                </div>
                                <span className="text-[var(--color-text-tertiary)]">=</span>
                                <span className="text-sm font-bold font-mono text-[var(--color-text-primary)]">
                                    {pm.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Tabla de Frecuencias de Calificaciones */}
                        <table className="w-full text-left font-mono text-[11px] border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-tertiary)] uppercase">
                                    <th className="py-1 font-semibold">Escala (sᵢ)</th>
                                    <th className="py-1 text-center font-semibold">Subfactores (fᵢ)</th>
                                    <th className="py-1 text-right font-semibold">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]/40">
                                {[4, 3, 2, 1].map((val) => {
                                    const count = counts[val as keyof typeof counts] || 0;
                                    const subtotal = count * val;
                                    const isFilterActive = activeRatingFilter === val;

                                    return (
                                        <tr
                                            key={val}
                                            onClick={() => onSelectRatingFilter(isFilterActive ? null : val)}
                                            className={`transition-colors cursor-pointer ${
                                                isFilterActive
                                                    ? 'bg-[var(--color-bg-page)] font-bold text-[var(--color-primary)]'
                                                    : 'hover:bg-[var(--color-bg-page)]/40 text-[var(--color-text-secondary)]'
                                            }`}
                                            title={`Filtrar subfactores con calificación ${val}`}
                                        >
                                            <td className="py-1">
                                                <span className="font-bold text-[var(--color-text-primary)]">{val}</span> · {RATING_NAMES[val]}
                                            </td>
                                            <td className="py-1 text-center font-bold text-[var(--color-text-primary)]">
                                                {count}
                                            </td>
                                            <td className="py-1 text-right text-[var(--color-text-secondary)]">
                                                {count} × {val} = <strong className="text-[var(--color-text-primary)]">{subtotal}</strong> pts
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t border-[var(--color-border-subtle)] font-bold text-[var(--color-text-primary)]">
                                    <td className="pt-1 text-[10px]">Total</td>
                                    <td className="pt-1 text-center text-[10px]">n = {totalSubfactors}</td>
                                    <td className="pt-1 text-right text-[10px]">Σ = {pointsSum} pts</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Regla de Decisión contra Umbral 3.0 */}
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between">
                        <div>
                            <span>Condición: </span>
                            <span className="font-bold text-[var(--color-text-primary)]">
                                {pm.toFixed(1)} {meetsThreshold ? '≥' : '<'} 3.0
                            </span>
                            <span> ⟹ {meetsThreshold ? 'Supera umbral' : 'Bajo umbral'}</span>
                        </div>
                        <span className="font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                            {fodaType}
                        </span>
                    </div>
                </div>

                {/* ── Columna 2: Importancia Metodológica (IS / IR) - Matriz 4x4 ── */}
                <div className="flex flex-col justify-between space-y-2.5">
                    <div>
                        {/* Selector de Modo: IS vs IR */}
                        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-border-subtle)]">
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => setMatrixMode('IS')}
                                    className={`transition-colors cursor-pointer ${
                                        matrixMode === 'IS'
                                            ? 'text-[var(--color-text-primary)] font-bold underline underline-offset-4 decoration-2'
                                            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                                    }`}
                                >
                                    1. Matriz IS = M(IE, IL)
                                </button>
                                <span className="text-[var(--color-text-tertiary)]">|</span>
                                <button
                                    type="button"
                                    onClick={() => setMatrixMode('IR')}
                                    className={`transition-colors cursor-pointer ${
                                        matrixMode === 'IR'
                                            ? 'text-[var(--color-text-primary)] font-bold underline underline-offset-4 decoration-2'
                                            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                                    }`}
                                >
                                    2. Matriz IR = M(ID, IS)
                                </button>
                            </div>

                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                {matrixMode === 'IS'
                                    ? `IS = M(${ie}, ${il}) = ${is}`
                                    : `IR = M(${id}, ${is}) = ${ir}`}
                            </span>
                        </div>

                        {/* Parámetros de Entrada en Franja Plana (Sin 4 cajas anidadas) */}
                        <div className="grid grid-cols-4 gap-1 my-2 font-mono text-center text-[10px] py-1 border-b border-[var(--color-border-subtle)]">
                            {matrixMode === 'IS' ? (
                                <>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">NS</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{ns}</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">TC</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{tc}</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">rᵢ = TC/NS</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{ratio}</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">IL (Cuartil)</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{il}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">ID (Decisor)</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{id}</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">IS (Sistémica)</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{is}</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">IR (Relativa)</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">{ir}</span>
                                    </div>
                                    <div>
                                        <span className="text-[var(--color-text-tertiary)] block text-[9px]">Impacto</span>
                                        <span className={`font-bold ${isCriticalIR ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text-secondary)]'}`}>
                                            {isCriticalIR ? 'Crítico (≥3)' : 'Moderado'}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Matriz 4x4 Metodológica (Tabla 5.3) — Alta Legibilidad */}
                        <div className="select-none py-1">
                            <div className="text-[9px] font-mono text-[var(--color-text-tertiary)] mb-1.5 flex items-center justify-between">
                                <span>Filas: <strong className="text-[var(--color-text-secondary)]">{rowTitle}</strong> = {activeRow}</span>
                                <span>Columnas: <strong className="text-[var(--color-text-secondary)]">{colTitle}</strong> = {activeCol}</span>
                            </div>

                            <div className="grid grid-cols-5 gap-1 font-mono text-center text-xs items-center">
                                {/* Encabezado de columnas: 1 2 3 4 */}
                                <span className="text-[9px] text-[var(--color-text-tertiary)] font-bold">
                                    {matrixMode === 'IS' ? 'IE \\ IL' : 'ID \\ IS'}
                                </span>
                                {[1, 2, 3, 4].map((col) => {
                                    const isTargetCol = col === activeCol;
                                    return (
                                        <span
                                            key={col}
                                            className={`py-0.5 font-bold transition-colors ${
                                                isTargetCol
                                                    ? 'text-[var(--color-text-primary)] underline decoration-2'
                                                    : 'text-[var(--color-text-tertiary)]'
                                            }`}
                                        >
                                            {col}
                                        </span>
                                    );
                                })}

                                {/* Filas 4, 3, 2, 1 */}
                                {[4, 3, 2, 1].map((rowVal) => {
                                    const isTargetRow = rowVal === activeRow;
                                    return (
                                        <React.Fragment key={rowVal}>
                                            <span
                                                className={`font-bold py-0.5 transition-colors ${
                                                    isTargetRow
                                                        ? 'text-[var(--color-text-primary)] underline decoration-2'
                                                        : 'text-[var(--color-text-tertiary)]'
                                                }`}
                                            >
                                                {rowVal}
                                            </span>
                                            {[1, 2, 3, 4].map((colVal) => {
                                                const cellVal = COMBINATION_MATRIX[rowVal]?.[colVal] ?? 1;
                                                const isIntersection = rowVal === activeRow && colVal === activeCol;
                                                const isCrosshair = rowVal === activeRow || colVal === activeCol;

                                                return (
                                                    <span
                                                        key={colVal}
                                                        className={`h-6 flex items-center justify-center font-mono text-xs transition-all ${
                                                            isIntersection
                                                                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-black rounded-[var(--radius-xs)] shadow-sm'
                                                                : isCrosshair
                                                                ? 'text-[var(--color-text-primary)] font-semibold bg-[var(--color-bg-page)]/70'
                                                                : 'text-[var(--color-text-tertiary)] opacity-60'
                                                        }`}
                                                        title={`${rowTitle} = ${rowVal}, ${colTitle} = ${colVal} ⟹ ${resultTitle} = ${cellVal}`}
                                                    >
                                                        {cellVal}
                                                    </span>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Conclusión Metodológica Integrada (IS ⟹ IR) */}
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] font-mono text-[10px] space-y-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                                1. Sistémica: M(IE {ie}, IL {il}) = <strong className="text-[var(--color-text-primary)]">IS {is}</strong> ({isLabel})
                            </span>
                            <span className="text-[9px] text-[var(--color-text-tertiary)]">
                                Tabla 5.3
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[var(--color-text-secondary)]">
                                2. Vinculante: M(ID {id}, IS {is}) = <strong className="text-[var(--color-text-primary)]">IR {ir}</strong> ({irLabel})
                            </span>
                            <span className={`font-semibold text-[9px] ${
                                isCriticalIR ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text-tertiary)]'
                            }`}>
                                {isCriticalIR ? 'Crítico (≥3)' : 'Moderado (=2)'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FactorMethodologyAuditCard;
