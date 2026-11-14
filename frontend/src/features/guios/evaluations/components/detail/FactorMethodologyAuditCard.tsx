/**
 * features/guios/evaluations/components/detail/FactorMethodologyAuditCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel de Auditoría Metodológica del Factor (GUIOS):
 * Separa claramente dos vistas especializadas según la pestaña:
 * - mode="importance" (Tab Factores y Decisor): Matrices 4x4 IS = M(IE, IL) e IR = M(ID, IS) lado a lado.
 * - mode="pm" (Tab Auditoría de Subfactores): Ponderación Media (PM), tabla interactiva de frecuencias y barra de umbral FODA.
 * - mode="full" (por defecto): Vista combinada PM + Matrices con selector IS/IR.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Filter, Lock } from 'lucide-react';

import type {
    EvaluationFactorItem,
    EvaluationSubfactorItem,
    EvaluationResultItem,
} from '../../../../../api/evaluationService';

import { COMBINATION_MATRIX } from '../../../../../calculations/combinationMatrix';
import { getFactorCode } from '../../utils/factorCodes';

type AuditCardMode = 'importance' | 'pm' | 'full';

interface FactorMethodologyAuditCardProps {
    factor: EvaluationFactorItem;
    subfactors: EvaluationSubfactorItem[];
    result?: EvaluationResultItem;
    activeRatingFilter: number | null;
    onSelectRatingFilter: (rating: number | null) => void;
    mode?: AuditCardMode;
}

const IMPORTANCE_LABELS: Record<number, string> = {
    1: 'Irrelevante',
    2: 'Opcional',
    3: 'Importante',
    4: 'Fundamental',
};

const RATING_META: Record<number, { name: string; dotClass: string }> = {
    4: { name: 'Satisfactorio', dotClass: 'bg-emerald-600 dark:bg-emerald-400' },
    3: { name: 'Parcial', dotClass: 'bg-amber-500 dark:bg-amber-400' },
    2: { name: 'Desconozco', dotClass: 'bg-slate-500 dark:bg-slate-400' },
    1: { name: 'No Cumple', dotClass: 'bg-rose-600 dark:bg-rose-400' },
};

interface MatrixGridProps {
    cornerLabel: string;
    rowTitle: string;
    colTitle: string;
    resultTitle: string;
    activeRow: number;
    activeCol: number;
    resultValue: number;
    resultLabel: string;
    formulaText: string;
    metricsStrip: Array<{ label: string; value: string | number; highlightClass?: string }>;
}

const ImportanceMatrixGrid: React.FC<MatrixGridProps> = ({
    cornerLabel,
    rowTitle,
    colTitle,
    resultTitle,
    activeRow,
    activeCol,
    resultValue,
    resultLabel,
    formulaText,
    metricsStrip,
}) => {
    return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/55 p-3 flex flex-col justify-between space-y-2.5">
            <div>
                {/* Título de Matriz + Resultado */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                        {formulaText}
                    </span>
                    <span className="px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-mono text-[11px] font-bold whitespace-nowrap">
                        {resultTitle} = {resultValue} · {resultLabel}
                    </span>
                </div>

                {/* Franja de Parámetros con alto contraste */}
                <div className="grid grid-cols-4 gap-1.5 my-2.5 font-mono text-center">
                    {metricsStrip.map((item) => (
                        <div
                            key={item.label}
                            className="py-1.5 px-1 rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]"
                        >
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] block">
                                {item.label}
                            </span>
                            <span className={`text-xs font-bold block mt-0.5 ${item.highlightClass || 'text-[var(--color-text-primary)]'}`}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Ejes de Coordenadas */}
                <div className="text-[10px] font-mono text-[var(--color-text-secondary)] mb-1.5 flex items-center justify-between">
                    <span>
                        Filas: <strong className="text-[var(--color-text-primary)]">{rowTitle}</strong> = {activeRow}
                    </span>
                    <span>
                        Columnas: <strong className="text-[var(--color-text-primary)]">{colTitle}</strong> = {activeCol}
                    </span>
                </div>

                {/* Matriz 4x4 con celdas delimitadas y resaltado de cruce */}
                <div className="select-none rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] p-2">
                    <div className="grid grid-cols-5 gap-1 font-mono text-center text-xs items-center">
                        <span className="text-[9px] font-bold uppercase text-[var(--color-text-secondary)] py-1">
                            {cornerLabel}
                        </span>
                        {[1, 2, 3, 4].map((col) => {
                            const isTargetCol = col === activeCol;
                            return (
                                <span
                                    key={col}
                                    className={`py-1 rounded-[var(--radius-xs)] text-[11px] font-bold transition-colors ${
                                        isTargetCol
                                            ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] font-black'
                                            : 'text-[var(--color-text-secondary)]'
                                    }`}
                                >
                                    {col}
                                </span>
                            );
                        })}

                        {[4, 3, 2, 1].map((rowVal) => {
                            const isTargetRow = rowVal === activeRow;
                            return (
                                <React.Fragment key={rowVal}>
                                    <span
                                        className={`py-1 rounded-[var(--radius-xs)] text-[11px] font-bold transition-colors ${
                                            isTargetRow
                                                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-strong)] font-black'
                                                : 'text-[var(--color-text-secondary)]'
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
                                                className={`h-7 flex items-center justify-center rounded-[var(--radius-xs)] font-mono text-xs border transition-all ${
                                                    isIntersection
                                                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] font-black shadow-sm'
                                                        : isCrosshair
                                                        ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border-strong)]/70 font-bold'
                                                        : 'bg-[var(--color-bg-secondary)]/45 text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] font-medium'
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

            <div className="pt-1.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                <span>Cruce Fila {activeRow} × Columna {activeCol}</span>
                <span className="text-[var(--color-text-tertiary)]">Tabla 5.3</span>
            </div>
        </div>
    );
};

export const FactorMethodologyAuditCard: React.FC<FactorMethodologyAuditCardProps> = ({
    factor,
    subfactors,
    result,
    activeRatingFilter,
    onSelectRatingFilter,
    mode = 'full',
}) => {
    const [matrixMode, setMatrixMode] = useState<'IS' | 'IR'>('IS');
    const [showMatricesInPmMode, setShowMatricesInPmMode] = useState(false);

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
    const pmPct = Math.max(0, Math.min(100, ((pm - 1) / 3) * 100));
    const thresholdPct = ((3.0 - 1) / 3) * 100;

    const isInternal = factor.scope_used === 'internal';
    const fodaType = isInternal
        ? meetsThreshold
            ? 'Fortaleza'
            : 'Debilidad'
        : meetsThreshold
        ? 'Oportunidad'
        : 'Amenaza';

    const isMatrixProps: MatrixGridProps = {
        cornerLabel: 'IE \\ IL',
        rowTitle: 'IE (Expertos)',
        colTitle: 'IL (Literatura)',
        resultTitle: 'IS',
        activeRow: ie,
        activeCol: il,
        resultValue: is,
        resultLabel: isLabel,
        formulaText: `1. Matriz IS = M(${ie}, ${il})`,
        metricsStrip: [
            { label: 'NS', value: ns },
            { label: 'TC', value: tc },
            { label: 'rᵢ = TC/NS', value: ratio },
            { label: 'IL (Cuartil)', value: il },
        ],
    };

    const irMatrixProps: MatrixGridProps = {
        cornerLabel: 'ID \\ IS',
        rowTitle: 'ID (Decisor)',
        colTitle: 'IS (Sugerida)',
        resultTitle: 'IR',
        activeRow: id,
        activeCol: is,
        resultValue: ir,
        resultLabel: irLabel,
        formulaText: `2. Matriz IR = M(${id}, ${is})`,
        metricsStrip: [
            { label: 'ID (Decisor)', value: id },
            { label: 'IS (Sugerida)', value: is },
            { label: 'IR (Relativa)', value: ir },
            {
                label: 'Impacto',
                value: isCriticalIR ? 'Crítico (≥3)' : 'Moderado (=2)',
                highlightClass: isCriticalIR ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-secondary)]',
            },
        ],
    };

    const pmPanel = (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/55 p-3 flex flex-col justify-between space-y-3">
            <div>
                {/* Cabecera del panel PM */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                    <span className="font-bold text-[11px] text-[var(--color-text-primary)] uppercase tracking-wider font-mono">
                        Ponderación Media (PM)
                    </span>
                    <div className="flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-xs text-[var(--color-text-primary)]">
                            PM = {pm.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-secondary)]">/ 4.0</span>
                        <span
                            className={`px-1.5 py-0.5 rounded-[var(--radius-xs)] text-[10px] font-bold uppercase ${
                                meetsThreshold
                                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
                                    : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]'
                            }`}
                        >
                            {fodaType}
                        </span>
                    </div>
                </div>

                {/* Fracción Matemática en recuadro legible */}
                <div className="my-2.5 py-2.5 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex items-center justify-center font-mono text-xs">
                    <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[var(--color-text-primary)]">PM</span>
                        <span className="text-[var(--color-text-secondary)]">=</span>
                        <div className="inline-flex flex-col items-center">
                            <span className="border-b border-[var(--color-text-primary)] px-2.5 pb-0.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
                                Σ sᵢ ({pointsSum} pts)
                            </span>
                            <span className="pt-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                                n ({ratedCount || totalSubfactors})
                            </span>
                        </div>
                        <span className="text-[var(--color-text-secondary)]">=</span>
                        <span className="text-sm font-black font-mono text-[var(--color-text-primary)]">
                            {pm.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Tabla de Frecuencias de Calificaciones */}
                <div className="rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] overflow-hidden">
                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                        <thead>
                            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/80 text-[10px] text-[var(--color-text-secondary)] uppercase">
                                <th className="py-1.5 px-2.5 font-bold flex items-center gap-1">
                                    <span>Escala (sᵢ)</span>
                                    {mode === 'pm' && (
                                        <span className="text-[9px] font-normal lowercase text-[var(--color-text-tertiary)] inline-flex items-center gap-0.5">
                                            <Filter size={9} /> clic filtra
                                        </span>
                                    )}
                                </th>
                                <th className="py-1.5 px-2 text-center font-bold">Subfactores (fᵢ)</th>
                                <th className="py-1.5 px-2.5 text-right font-bold">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                            {[4, 3, 2, 1].map((val) => {
                                const count = counts[val as keyof typeof counts] || 0;
                                const subtotal = count * val;
                                const isFilterActive = activeRatingFilter === val;
                                const meta = RATING_META[val];

                                return (
                                    <tr
                                        key={val}
                                        onClick={() => mode !== 'importance' && onSelectRatingFilter(isFilterActive ? null : val)}
                                        className={`transition-colors ${mode !== 'importance' ? 'cursor-pointer' : ''} ${
                                            isFilterActive
                                                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] font-bold'
                                                : 'hover:bg-[var(--color-bg-secondary)]/60 text-[var(--color-text-primary)]'
                                        }`}
                                        title={mode !== 'importance' ? `Filtrar subfactores con calificación ${val}` : undefined}
                                    >
                                        <td className="py-1.5 px-2.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotClass}`} />
                                                <span className="font-bold text-[var(--color-text-primary)]">{val}</span>
                                                <span className="text-[var(--color-text-secondary)]">· {meta.name}</span>
                                            </span>
                                        </td>
                                        <td className="py-1.5 px-2 text-center font-bold text-[var(--color-text-primary)]">
                                            {count}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right text-[var(--color-text-secondary)]">
                                            {count} × {val} = <strong className="text-[var(--color-text-primary)]">{subtotal}</strong> pts
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-[var(--color-border-strong)]/40 bg-[var(--color-bg-secondary)]/50 font-bold text-[var(--color-text-primary)]">
                                <td className="py-1.5 px-2.5 text-[10px]">Total evaluado</td>
                                <td className="py-1.5 px-2 text-center text-[10px]">n = {totalSubfactors}</td>
                                <td className="py-1.5 px-2.5 text-right text-[10px]">Σ = {pointsSum} pts</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Regla de Decisión contra Umbral 3.0 */}
            <div className="pt-2 border-t border-[var(--color-border-subtle)] font-mono text-[10px] text-[var(--color-text-secondary)] flex items-center justify-between gap-2">
                <div>
                    <span>Condición: </span>
                    <span className="font-bold text-[var(--color-text-primary)]">
                        {pm.toFixed(1)} {meetsThreshold ? '≥' : '<'} 3.0
                    </span>
                    <span> ⟹ {meetsThreshold ? 'Supera umbral' : 'Bajo umbral'}</span>
                </div>
                <span
                    className={`font-bold uppercase tracking-wider ${
                        meetsThreshold ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger-text)]'
                    }`}
                >
                    {fodaType}
                </span>
            </div>
        </div>
    );

    return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 space-y-3 font-sans text-xs shadow-xs">
            {/* ── Barra Superior con Jerarquía Clara de Parámetros ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] font-mono text-[11px] font-bold text-[var(--color-text-primary)]">
                        {factorCode}
                    </span>
                    <span className="font-bold text-xs text-[var(--color-text-primary)]">
                        {factor.factor_name}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                        ({factor.dimension_name})
                    </span>
                    <span className="inline-flex items-center text-[10px] text-[var(--color-text-secondary)]" title="Catálogo base protegido">
                        <Lock size={11} />
                    </span>
                </div>

                {/* Ruta Metodológica Condensada */}
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-secondary)] flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]">
                        Ámbito: <strong className="text-[var(--color-text-primary)]">{isInternal ? 'Interno' : 'Externo'}</strong>
                    </span>
                    <span>IE: <strong className="text-[var(--color-text-primary)]">{ie}</strong></span>
                    <span>·</span>
                    <span>IL: <strong className="text-[var(--color-text-primary)]">{il}</strong></span>
                    <span>⟹</span>
                    {mode === 'full' ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setMatrixMode('IS')}
                                className={`px-1.5 py-0.5 rounded-[var(--radius-xs)] border transition-colors cursor-pointer ${
                                    matrixMode === 'IS'
                                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] font-bold'
                                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                }`}
                                title="Ver cálculo de IS en la matriz"
                            >
                                IS: {is}
                            </button>
                            <span>⟹</span>
                            <button
                                type="button"
                                onClick={() => setMatrixMode('IR')}
                                className={`px-1.5 py-0.5 rounded-[var(--radius-xs)] border transition-colors cursor-pointer ${
                                    matrixMode === 'IR'
                                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] font-bold'
                                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                }`}
                                title="Ver cálculo de IR en la matriz"
                            >
                                IR: {ir}
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] font-semibold">
                                IS: {is}
                            </span>
                            <span>·</span>
                            <span>ID: <strong className="text-[var(--color-text-primary)]">{id}</strong></span>
                            <span>⟹</span>
                            <span className="px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border-strong)]/60 text-[var(--color-text-primary)] font-bold">
                                IR: {ir}
                            </span>
                        </>
                    )}
                    <span
                        className={`text-[10px] font-bold ${
                            isCriticalIR ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-secondary)]'
                        }`}
                    >
                        ({isCriticalIR ? 'Crítico ≥3' : 'Moderado =2'})
                    </span>
                </div>
            </div>

            {/* ── MODO IMPORTANCIA (Tab Factores y Decisor): Dos matrices lado a lado ── */}
            {mode === 'importance' && (
                <div className="space-y-2.5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-stretch">
                        <ImportanceMatrixGrid {...isMatrixProps} />
                        <ImportanceMatrixGrid {...irMatrixProps} />
                    </div>
                    <div className="px-3 py-2 rounded-[var(--radius-xs)] bg-[var(--color-bg-secondary)]/70 border border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[var(--color-text-secondary)]">
                        <span>
                            Resumen metodológico: Sistémica <strong className="text-[var(--color-text-primary)]">IS = {is} ({isLabel})</strong> combinada con Decisor <strong className="text-[var(--color-text-primary)]">ID = {id}</strong> fija <strong className="text-[var(--color-text-primary)]">IR = {ir} ({irLabel})</strong>.
                        </span>
                        <span className="font-semibold text-[var(--color-text-primary)]">
                            Desempeño actual: PM = {pm.toFixed(2)} ({fodaType})
                        </span>
                    </div>
                </div>
            )}

            {/* ── MODO PM (Tab Auditoría de Subfactores): PM + Umbral FODA sin ruido duplicado ── */}
            {mode === 'pm' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                        <div className="lg:col-span-7 flex flex-col [&>*]:flex-1">
                            {pmPanel}
                        </div>

                        <div className="lg:col-span-5 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/55 p-3 flex flex-col justify-between space-y-3">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                        Clasificación FODA y Umbral
                                    </span>
                                    <span className="font-mono text-[10px] font-semibold text-[var(--color-text-secondary)]">
                                        Meta ≥ 3.00
                                    </span>
                                </div>

                                {/* Barra visual de posición de PM frente al umbral 3.0 */}
                                <div className="p-2.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] space-y-2">
                                    <div className="flex items-center justify-between font-mono text-[10px]">
                                        <span className="text-[var(--color-text-secondary)]">Escala 1.0 – 4.0</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">
                                            PM = {pm.toFixed(2)} ({meetsThreshold ? `+${(pm - 3.0).toFixed(2)}` : (pm - 3.0).toFixed(2)} vs 3.0)
                                        </span>
                                    </div>
                                    <div className="relative h-2.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-tertiary)] overflow-visible">
                                        <div
                                            style={{ width: `${pmPct}%` }}
                                            className={`h-full rounded-[var(--radius-xs)] transition-all ${
                                                meetsThreshold
                                                    ? 'bg-emerald-600 dark:bg-emerald-500'
                                                    : 'bg-rose-600 dark:bg-rose-500'
                                            }`}
                                        />
                                        <div
                                            style={{ left: `${thresholdPct}%` }}
                                            className="absolute -top-1 -bottom-1 w-0.5 bg-[var(--color-text-primary)]"
                                            title="Umbral metodológico 3.0"
                                        />
                                    </div>
                                    <div className="flex justify-between font-mono text-[9px] text-[var(--color-text-secondary)]">
                                        <span>1.0 No cumple</span>
                                        <span className="font-bold text-[var(--color-text-primary)]">3.0 Umbral</span>
                                        <span>4.0 Óptimo</span>
                                    </div>
                                </div>

                                {/* Tarjetas compactas de impacto en dictamen */}
                                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                                    <div className="p-2 rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                                        <span className="text-[9px] uppercase text-[var(--color-text-tertiary)] block">
                                            Cuadrante FODA
                                        </span>
                                        <span
                                            className={`font-bold text-xs block mt-0.5 ${
                                                meetsThreshold ? 'text-[var(--color-success-text)]' : 'text-[var(--color-danger-text)]'
                                            }`}
                                        >
                                            {fodaType}
                                        </span>
                                        <span className="text-[9px] text-[var(--color-text-secondary)] block mt-0.5">
                                            Ámbito {isInternal ? 'Interno' : 'Externo'}
                                        </span>
                                    </div>

                                    <div className="p-2 rounded-[var(--radius-xs)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)]">
                                        <span className="text-[9px] uppercase text-[var(--color-text-tertiary)] block">
                                            Peso en Dictamen
                                        </span>
                                        <span className="font-bold text-xs text-[var(--color-text-primary)] block mt-0.5">
                                            IR = {ir} ({irLabel})
                                        </span>
                                        <span className="text-[9px] text-[var(--color-text-secondary)] block mt-0.5">
                                            IE {ie} · IL {il} · IS {is} · ID {id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowMatricesInPmMode((prev) => !prev)}
                                className="w-full py-1.5 px-2.5 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] hover:border-[var(--color-border-strong)] text-[10px] font-mono font-semibold text-[var(--color-text-primary)] flex items-center justify-between transition-colors cursor-pointer"
                            >
                                <span>{showMatricesInPmMode ? 'Ocultar matrices IS / IR' : 'Consultar matrices de cálculo IS / IR'}</span>
                                {showMatricesInPmMode ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                        </div>
                    </div>

                    {showMatricesInPmMode && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pt-1">
                            <ImportanceMatrixGrid {...isMatrixProps} />
                            <ImportanceMatrixGrid {...irMatrixProps} />
                        </div>
                    )}
                </div>
            )}

            {/* ── MODO FULL (Compatibilidad por defecto) ── */}
            {mode === 'full' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                    {pmPanel}
                    <div className="flex flex-col space-y-2.5">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                            <button
                                type="button"
                                onClick={() => setMatrixMode('IS')}
                                className={`px-2 py-1 rounded-[var(--radius-xs)] border transition-colors cursor-pointer ${
                                    matrixMode === 'IS'
                                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] font-bold'
                                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                }`}
                            >
                                1. Matriz IS = M(IE, IL)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMatrixMode('IR')}
                                className={`px-2 py-1 rounded-[var(--radius-xs)] border transition-colors cursor-pointer ${
                                    matrixMode === 'IR'
                                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] font-bold'
                                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                }`}
                            >
                                2. Matriz IR = M(ID, IS)
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col [&>*]:flex-1">
                            <ImportanceMatrixGrid {...(matrixMode === 'IS' ? isMatrixProps : irMatrixProps)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FactorMethodologyAuditCard;
