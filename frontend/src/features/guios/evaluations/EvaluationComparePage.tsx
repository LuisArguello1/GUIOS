/**
 * features/guios/evaluations/EvaluationComparePage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Comparador Ejecutivo Avanzado "Antes y Después" entre dos Evaluaciones GUIOS.
 *
 * Características profesionales:
 * - KPIs Ejecutivos de Variación (Dictamen, PM Global, Mejoras vs Retrocesos, Excluidos).
 * - Inspector de Cambio Activo con desglose de variación e interpretación metodológica.
 * - Barra de navegación interactiva paso a paso (← Cambio X de Y →) y selector rápido de saltos.
 * - Deltas cuantitativos explícitos (+0.16 ▲, -0.50 ▼, transiciones FODA).
 * - Dos modalidades de visualización: "Lado a Lado (Espejo)" y "Matriz Delta Unificada".
 * - Desglose interactivo por subfactores técnicos para explicar el porqué de cada variación de PM.
 * - Soporte para atajos de teclado (← y →).
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowLeftRight,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Building2,
    Columns2,
    Table,
    Award,
    ShieldAlert,
    ShieldCheck,
    Eye,
    EyeOff,
    Printer,
    Layers,
} from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../components/ui/Button';
import Loading from '../../../components/ui/Loading';
import evaluationService, {
    type EvaluationDetail,
    type EvaluationSubfactorItem,
} from '../../../api/evaluationService';
import { getErrorDetail } from '../../../utils/errorUtils';

// Subfactor alineado para comparativa profunda
interface AlignedSubfactorDiff {
    subfactorId: number;
    description: string;
    order: number;
    rating1: number | null;
    rating2: number | null;
    diff: number; // rating2 - rating1
    hasDiff: boolean;
}

// Factor alineado y contrastado con deltas cuantitativos
interface AlignedFactorComparison {
    factorId: number;
    factorName: string;
    dimensionName: string;
    order: number;
    // Evaluación 1 (Antes)
    ir1: number | null;
    pm1: number | null;
    foda1: string;
    isDiscarded1: boolean;
    // Evaluación 2 (Después)
    ir2: number | null;
    pm2: number | null;
    foda2: string;
    isDiscarded2: boolean;
    // Deltas
    deltaIR: number;
    deltaPM: number | null;
    hasDiffIR: boolean;
    hasDiffPM: boolean;
    hasDiffFODA: boolean;
    hasDiff: boolean;
    changeType: 'improved' | 'degraded' | 'discarded' | 'rescued' | 'neutral' | 'unchanged';
    explanation: string;
    subfactors: AlignedSubfactorDiff[];
}

// Formateador de fecha amigable (ej. "30 oct 2026")
const formatDateLabel = (dateStr?: string | null): string => {
    if (!dateStr) return 'Sin fecha';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
};

// Sello circular oficial de Dictamen (Estilo Medalla GUIOS)
const VerdictSeal: React.FC<{
    recommendation?: string | null;
}> = ({ recommendation }) => {
    const rec = (recommendation || '—').toUpperCase();

    const colorConfig = useMemo(() => {
        if (rec === 'A') {
            return {
                border: 'border-emerald-500',
                text: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
                ring: 'ring-emerald-500/30',
            };
        }
        if (rec === 'B') {
            return {
                border: 'border-amber-500',
                text: 'text-amber-500',
                bg: 'bg-amber-500/10',
                ring: 'ring-amber-500/30',
            };
        }
        if (rec === 'C') {
            return {
                border: 'border-rose-500',
                text: 'text-rose-500',
                bg: 'bg-rose-500/10',
                ring: 'ring-rose-500/30',
            };
        }
        return {
            border: 'border-[var(--color-border-strong)]',
            text: 'text-[var(--color-text-tertiary)]',
            bg: 'bg-[var(--color-bg-page)]',
            ring: 'ring-transparent',
        };
    }, [rec]);

    return (
        <div
            className={clsx(
                'w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 p-0.5 flex flex-col items-center justify-center shrink-0 select-none shadow-sm ring-2',
                colorConfig.border,
                colorConfig.bg,
                colorConfig.ring
            )}
            title={`Dictamen Oficial: Recomendación ${rec}`}
        >
            <div
                className={clsx(
                    'w-full h-full rounded-full border border-dashed flex flex-col items-center justify-center',
                    colorConfig.border
                )}
            >
                <span className={clsx('text-xl sm:text-2xl font-black font-mono leading-none', colorConfig.text)}>
                    {rec}
                </span>
                <span
                    className={clsx(
                        'text-[8px] font-black tracking-widest font-mono uppercase mt-0.5',
                        colorConfig.text
                    )}
                >
                    DICTAMEN
                </span>
            </div>
        </div>
    );
};

// Badge de Delta Numérico (+0.16 ▲ / -0.50 ▼)
const DeltaBadge: React.FC<{ delta: number | null }> = ({ delta }) => {
    if (delta == null || Math.abs(delta) < 0.005) {
        return <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono font-medium">—</span>;
    }

    const isPositive = delta > 0;
    const formatted = `${isPositive ? '+' : ''}${delta.toFixed(2)}`;

    return (
        <span
            className={clsx(
                'inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                isPositive
                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
            )}
        >
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span>{formatted}</span>
        </span>
    );
};

// Badge de Estado FODA
const FodaBadge: React.FC<{ foda: string; isDiscarded?: boolean }> = ({ foda, isDiscarded }) => {
    if (isDiscarded || foda.toLowerCase() === 'descartado') {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)] italic">
                Descartado
            </span>
        );
    }

    const lower = foda.toLowerCase();
    if (lower.includes('fortaleza')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Fortaleza
            </span>
        );
    }
    if (lower.includes('oportunidad')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Oportunidad
            </span>
        );
    }
    if (lower.includes('debilidad')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Debilidad
            </span>
        );
    }
    if (lower.includes('amenaza')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Amenaza
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--color-bg-page)] text-[var(--color-text-secondary)]">
            {foda}
        </span>
    );
};

export const EvaluationComparePage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const id1 = searchParams.get('id1');
    const id2 = searchParams.get('id2');

    // Estados de datos
    const [eval1, setEval1] = useState<EvaluationDetail | null>(null);
    const [eval2, setEval2] = useState<EvaluationDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modos de visualización: 'split' (Lado a Lado Espejo) | 'unified' (Matriz Delta Unificada)
    const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
    const [hideDifferences, setHideDifferences] = useState(false);
    const [activeDiffIndex, setActiveDiffIndex] = useState(0);
    const [expandedFactorIds, setExpandedFactorIds] = useState<Set<number>>(new Set());
    const [chipFilter, setChipFilter] = useState<'all' | 'improved' | 'degraded' | 'discarded'>('all');

    // Referencias a filas para scroll interactivo
    const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

    // Cargar las 2 evaluaciones concurrentemente
    useEffect(() => {
        if (!id1 || !id2) {
            setError('Se requieren 2 identificadores de evaluación para realizar la comparación.');
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        Promise.all([
            evaluationService.getEvaluationDetail(id1),
            evaluationService.getEvaluationDetail(id2),
        ])
            .then(([res1, res2]) => {
                if (!isMounted) return;
                setEval1(res1);
                setEval2(res2);
                setLoading(false);
            })
            .catch((err) => {
                if (!isMounted) return;
                setError(getErrorDetail(err, 'No fue posible cargar las evaluaciones solicitadas.'));
                setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [id1, id2]);

    // Invertir el orden (Antes <-> Después)
    const handleSwapEvaluations = useCallback(() => {
        if (!id1 || !id2) return;
        setSearchParams({ id1: id2, id2: id1 });
    }, [id1, id2, setSearchParams]);

    // Toggle expandir subfactores de un factor
    const handleToggleExpand = useCallback((factorId: number) => {
        setExpandedFactorIds((prev) => {
            const next = new Set(prev);
            if (next.has(factorId)) next.delete(factorId);
            else next.add(factorId);
            return next;
        });
    }, []);

    // Alinear y contrastar factores entre Evaluación 1 y Evaluación 2
    const alignedFactors = useMemo<AlignedFactorComparison[]>(() => {
        if (!eval1 || !eval2) return [];

        const subfactorsMap1 = new Map<number, EvaluationSubfactorItem[]>();
        (eval1.subfactors || []).forEach((sf) => {
            const list = subfactorsMap1.get(sf.factor_id) || [];
            list.push(sf);
            subfactorsMap1.set(sf.factor_id, list);
        });

        const subfactorsMap2 = new Map<number, EvaluationSubfactorItem[]>();
        (eval2.subfactors || []).forEach((sf) => {
            const list = subfactorsMap2.get(sf.factor_id) || [];
            list.push(sf);
            subfactorsMap2.set(sf.factor_id, list);
        });

        const factorMap = new Map<number, AlignedFactorComparison>();

        // 1. Procesar factores de Evaluación 1
        (eval1.factors || []).forEach((f) => {
            const resultItem = (eval1.results || []).find((r) => r.factor_id === f.factor_id);
            const ir = f.relative_importance ?? null;
            const isDiscarded = ir === 1;

            let pm: number | null = null;
            let foda = '—';

            if (isDiscarded) {
                pm = null;
                foda = 'Descartado';
            } else if (resultItem) {
                pm =
                    typeof resultItem.weighted_average === 'number'
                        ? resultItem.weighted_average
                        : parseFloat(String(resultItem.weighted_average)) || null;
                foda = resultItem.foda_display || resultItem.foda_classification || '—';
            }

            factorMap.set(f.factor_id, {
                factorId: f.factor_id,
                factorName: f.factor_name,
                dimensionName: f.dimension_name || 'General',
                order: f.order || 0,
                ir1: ir,
                pm1: pm,
                foda1: foda,
                isDiscarded1: isDiscarded,
                ir2: null,
                pm2: null,
                foda2: '—',
                isDiscarded2: false,
                deltaIR: 0,
                deltaPM: null,
                hasDiffIR: false,
                hasDiffPM: false,
                hasDiffFODA: false,
                hasDiff: false,
                changeType: 'unchanged',
                explanation: 'Sin cambios registrados',
                subfactors: [],
            });
        });

        // 2. Procesar factores de Evaluación 2
        (eval2.factors || []).forEach((f) => {
            const resultItem = (eval2.results || []).find((r) => r.factor_id === f.factor_id);
            const ir = f.relative_importance ?? null;
            const isDiscarded = ir === 1;

            let pm: number | null = null;
            let foda = '—';

            if (isDiscarded) {
                pm = null;
                foda = 'Descartado';
            } else if (resultItem) {
                pm =
                    typeof resultItem.weighted_average === 'number'
                        ? resultItem.weighted_average
                        : parseFloat(String(resultItem.weighted_average)) || null;
                foda = resultItem.foda_display || resultItem.foda_classification || '—';
            }

            const existing = factorMap.get(f.factor_id);
            if (existing) {
                existing.ir2 = ir;
                existing.pm2 = pm;
                existing.foda2 = foda;
                existing.isDiscarded2 = isDiscarded;
            } else {
                factorMap.set(f.factor_id, {
                    factorId: f.factor_id,
                    factorName: f.factor_name,
                    dimensionName: f.dimension_name || 'General',
                    order: f.order || 0,
                    ir1: null,
                    pm1: null,
                    foda1: '—',
                    isDiscarded1: false,
                    ir2: ir,
                    pm2: pm,
                    foda2: foda,
                    isDiscarded2: isDiscarded,
                    deltaIR: 0,
                    deltaPM: null,
                    hasDiffIR: false,
                    hasDiffPM: false,
                    hasDiffFODA: false,
                    hasDiff: false,
                    changeType: 'unchanged',
                    explanation: 'Sin cambios registrados',
                    subfactors: [],
                });
            }
        });

        // 3. Contrastar y calcular deltas y alineación de subfactores
        const list = Array.from(factorMap.values());
        list.sort((a, b) => a.order - b.order || a.factorId - b.factorId);

        list.forEach((item) => {
            const diffIR = item.ir1 !== item.ir2;
            const deltaIR = (item.ir2 ?? 0) - (item.ir1 ?? 0);

            // Comparación de PM con tolerancia de redondeo
            const pm1Val = item.pm1 != null ? Number(item.pm1.toFixed(2)) : null;
            const pm2Val = item.pm2 != null ? Number(item.pm2.toFixed(2)) : null;
            const deltaPM = pm1Val != null && pm2Val != null ? Number((pm2Val - pm1Val).toFixed(2)) : null;
            const diffPM = Math.abs(deltaPM ?? 0) > 0.005;

            const diffFODA = item.foda1.trim().toLowerCase() !== item.foda2.trim().toLowerCase();
            const hasDiff = diffIR || diffPM || diffFODA;

            // Comparar subfactores técnicos de este factor
            const sfList1 = subfactorsMap1.get(item.factorId) || [];
            const sfList2 = subfactorsMap2.get(item.factorId) || [];
            const alignedSf: AlignedSubfactorDiff[] = [];

            const allSfIds = Array.from(new Set([...sfList1.map((s) => s.subfactor_id), ...sfList2.map((s) => s.subfactor_id)]));
            allSfIds.forEach((sfId) => {
                const s1 = sfList1.find((s) => s.subfactor_id === sfId);
                const s2 = sfList2.find((s) => s.subfactor_id === sfId);
                const r1 = s1?.rating ?? null;
                const r2 = s2?.rating ?? null;
                const sfDiff = (r2 ?? 0) - (r1 ?? 0);

                alignedSf.push({
                    subfactorId: sfId,
                    description: s2?.description_snapshot || s1?.description_snapshot || `Subfactor #${sfId}`,
                    order: s2?.order || s1?.order || 0,
                    rating1: r1,
                    rating2: r2,
                    diff: sfDiff,
                    hasDiff: r1 !== r2,
                });
            });
            alignedSf.sort((a, b) => a.order - b.order);

            const sfDecreased = alignedSf.filter((s) => s.hasDiff && s.diff < 0);
            const sfIncreased = alignedSf.filter((s) => s.hasDiff && s.diff > 0);
            const biggestDropSf = [...sfDecreased].sort((a, b) => a.diff - b.diff)[0];
            const biggestRiseSf = [...sfIncreased].sort((a, b) => b.diff - a.diff)[0];

            // Determinar tipo de cambio y síntesis explicativa basada en los datos reales
            let changeType: AlignedFactorComparison['changeType'] = 'unchanged';
            let explanation = 'Sin variación entre ambas evaluaciones.';

            if (item.isDiscarded1 && !item.isDiscarded2) {
                changeType = 'rescued';
                explanation = `Factor recuperado en Fase 1: En la evaluación Antes fue excluido (IR=1). En Después se priorizó a IR=${item.ir2} y se evaluaron sus ${alignedSf.length} afirmaciones técnicas alcanzando una PM de ${item.pm2?.toFixed(2) ?? '—'} (${item.foda2}).`;
            } else if (!item.isDiscarded1 && item.isDiscarded2) {
                changeType = 'discarded';
                explanation = `Factor excluido en Fase 1: En Antes contaba con prioridad IR=${item.ir1} y PM=${item.pm1?.toFixed(2) ?? '—'} (${item.foda1}). En la evaluación Después fue descartado con IR=1, omitiéndose la auditoría de sus ${alignedSf.length} afirmaciones.`;
            } else if (hasDiff) {
                const parts: string[] = [];

                if (diffPM && item.pm1 != null && item.pm2 != null) {
                    if (deltaPM! > 0) {
                        changeType = 'improved';
                        let detail = '';
                        if (sfIncreased.length > 0) {
                            detail = ` por calificación superior en ${sfIncreased.length} de sus ${alignedSf.length} afirmación(es)${
                                biggestRiseSf ? ` (p. ej. "${biggestRiseSf.description.slice(0, 40)}…" subió de ${biggestRiseSf.rating1} a ${biggestRiseSf.rating2})` : ''
                            }`;
                        }
                        parts.push(`La Ponderación Media aumentó de ${item.pm1.toFixed(2)} a ${item.pm2.toFixed(2)} (+${deltaPM!.toFixed(2)} pts)${detail}.`);
                    } else if (deltaPM! < 0) {
                        changeType = 'degraded';
                        let detail = '';
                        if (sfDecreased.length > 0) {
                            detail = ` por calificación inferior en ${sfDecreased.length} de sus ${alignedSf.length} afirmación(es)${
                                biggestDropSf ? ` (p. ej. "${biggestDropSf.description.slice(0, 40)}…" bajó de ${biggestDropSf.rating1} a ${biggestDropSf.rating2})` : ''
                            }`;
                        }
                        parts.push(`La Ponderación Media disminuyó de ${item.pm1.toFixed(2)} a ${item.pm2.toFixed(2)} (${deltaPM!.toFixed(2)} pts)${detail}.`);
                    }
                } else if (!diffPM && item.pm1 != null) {
                    parts.push(`La Ponderación Media se mantuvo en ${item.pm1.toFixed(2)} pts.`);
                }

                if (diffIR) {
                    if (deltaIR > 0) {
                        parts.push(`En Fase 1, su Importancia Relativa aumentó de IR: ${item.ir1} a IR: ${item.ir2} (mayor criticidad institucional).`);
                    } else {
                        parts.push(`En Fase 1, su Importancia Relativa se redujo de IR: ${item.ir1} a IR: ${item.ir2} (menor peso en el dictamen).`);
                    }
                }

                if (diffFODA) {
                    parts.push(`Su diagnóstico FODA transitó de ${item.foda1} a ${item.foda2}.`);
                    if (item.foda1.toLowerCase().includes('amenaza') && item.foda2.toLowerCase().includes('oportunidad')) {
                        changeType = 'improved';
                    } else if (item.foda1.toLowerCase().includes('fortaleza') && item.foda2.toLowerCase().includes('debilidad')) {
                        changeType = 'degraded';
                    }
                }

                if (changeType === 'unchanged') {
                    changeType = 'neutral';
                }

                explanation = parts.join(' ');
            }

            item.deltaIR = deltaIR;
            item.deltaPM = deltaPM;
            item.hasDiffIR = diffIR;
            item.hasDiffPM = diffPM;
            item.hasDiffFODA = diffFODA;
            item.hasDiff = hasDiff;
            item.changeType = changeType;
            item.explanation = explanation;
            item.subfactors = alignedSf;
        });

        return list;
    }, [eval1, eval2]);

    // Lista de factores que presentan diferencias
    const diffFactors = useMemo(() => {
        return alignedFactors.filter((f) => f.hasDiff);
    }, [alignedFactors]);

    const totalDiffCount = diffFactors.length;

    // Resumen estadístico de cambios
    const stats = useMemo(() => {
        const improved = diffFactors.filter((f) => f.changeType === 'improved' || f.changeType === 'rescued').length;
        const degraded = diffFactors.filter((f) => f.changeType === 'degraded' || f.changeType === 'discarded').length;
        const discarded = diffFactors.filter((f) => f.isDiscarded2).length;

        // PM Promedio Antes vs Después
        const pmList1 = alignedFactors.filter((f) => f.pm1 != null).map((f) => f.pm1 as number);
        const pmList2 = alignedFactors.filter((f) => f.pm2 != null).map((f) => f.pm2 as number);

        const avgPM1 = pmList1.length > 0 ? pmList1.reduce((a, b) => a + b, 0) / pmList1.length : 0;
        const avgPM2 = pmList2.length > 0 ? pmList2.reduce((a, b) => a + b, 0) / pmList2.length : 0;
        const avgPMDelta = Number((avgPM2 - avgPM1).toFixed(2));

        return {
            improved,
            degraded,
            discarded,
            avgPM1: avgPM1.toFixed(2),
            avgPM2: avgPM2.toFixed(2),
            avgPMDelta,
        };
    }, [alignedFactors, diffFactors]);

    // Factores a renderizar según el filtro de "Ocultar diferencias"
    const visibleFactors = useMemo(() => {
        if (!hideDifferences) return alignedFactors;
        return alignedFactors.filter((f) => f.hasDiff);
    }, [alignedFactors, hideDifferences]);

    // Factores con cambios filtrados por la categoría seleccionada en los chips
    const filteredDiffFactors = useMemo(() => {
        if (chipFilter === 'improved') return diffFactors.filter((f) => f.changeType === 'improved' || f.changeType === 'rescued');
        if (chipFilter === 'degraded') return diffFactors.filter((f) => f.changeType === 'degraded');
        if (chipFilter === 'discarded') return diffFactors.filter((f) => f.changeType === 'discarded' || f.isDiscarded2);
        return diffFactors;
    }, [diffFactors, chipFilter]);

    // Desplazar y enfocar fila de cambio activo
    const scrollToDiff = useCallback(
        (index: number) => {
            if (diffFactors.length === 0) return;
            const boundedIndex = (index + diffFactors.length) % diffFactors.length;
            setActiveDiffIndex(boundedIndex);

            const targetFactor = diffFactors[boundedIndex];
            if (!targetFactor) return;

            const el = rowRefs.current.get(targetFactor.factorId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        [diffFactors]
    );

    // Controles de navegación por teclado (Flechas izquierda / derecha)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'ArrowRight') {
                scrollToDiff(activeDiffIndex + 1);
            } else if (e.key === 'ArrowLeft') {
                scrollToDiff(activeDiffIndex - 1);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeDiffIndex, scrollToDiff]);

    // Transición de dictamen institucional
    const verdictTransition = useMemo(() => {
        const v1 = eval1?.verdict?.recommendation || eval1?.recommendation || null;
        const v2 = eval2?.verdict?.recommendation || eval2?.recommendation || null;

        if (!v1 && !v2) return null;

        const rank: Record<string, number> = { A: 3, B: 2, C: 1 };
        const score1 = v1 ? rank[v1] || 0 : 0;
        const score2 = v2 ? rank[v2] || 0 : 0;

        let status: 'improved' | 'degraded' | 'same' = 'same';
        let label = 'Sin alteración en recomendación';

        if (score2 > score1) {
            status = 'improved';
            label = 'Mejora en dictamen institucional';
        } else if (score2 < score1) {
            status = 'degraded';
            label = 'Degradación / Mayor restricción de adopción';
        }

        return {
            from: v1 || '—',
            to: v2 || '—',
            status,
            label,
        };
    }, [eval1, eval2]);

    const activeDiffFactor = diffFactors[activeDiffIndex] || null;

    if (loading) {
        return (
            <div className="py-24 flex flex-col justify-center items-center gap-3">
                <Loading label="Cargando y sincronizando evaluaciones para contrastar..." />
                <span className="text-xs text-[var(--color-text-tertiary)] font-mono">
                    Alineando matrices FODA y umbrales de cuartiles
                </span>
            </div>
        );
    }

    if (error || !eval1 || !eval2) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] my-12 shadow-sm space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <AlertCircle size={24} />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Error al cargar la comparación
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                    {error || 'No se pudieron recuperar los registros requeridos.'}
                </p>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/dashboard/guios/evaluaciones')}
                    className="flex items-center gap-2 mx-auto text-xs"
                >
                    <ArrowLeft size={13} />
                    <span>Volver a Evaluaciones</span>
                </Button>
            </div>
        );
    }

    const date1 = formatDateLabel(eval1.verdict?.calculated_at || eval1.completed_at || eval1.started_at);
    const date2 = formatDateLabel(eval2.verdict?.calculated_at || eval2.completed_at || eval2.started_at);

    return (
        <div className="space-y-4 max-w-7xl mx-auto pb-16 print:p-0 print:max-w-none">
            {/* ── BARRA SUPERIOR DE HERRAMIENTAS ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)] print:hidden">
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/dashboard/guios/evaluaciones')}
                        className="flex items-center gap-1.5 text-xs h-8 px-2.5"
                        title="Regresar a la lista de evaluaciones"
                    >
                        <ArrowLeft size={13} />
                        <span>Volver</span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSwapEvaluations}
                        className="flex items-center gap-1.5 text-xs h-8 px-2.5"
                        title="Invertir el orden (cambiar Antes por Después)"
                    >
                        <ArrowLeftRight size={13} />
                        <span className="hidden sm:inline">Invertir</span>
                    </Button>

                    <div className="h-4 w-px bg-[var(--color-border-subtle)] mx-1 hidden sm:block" />

                    {/* Selector de Modo de Visualización */}
                    <div className="flex items-center p-0.5 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] font-mono text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('split')}
                            className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] font-bold transition-all cursor-pointer text-xs',
                                viewMode === 'split'
                                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                            title="Ver dos tarjetas espejo lado a lado"
                        >
                            <Columns2 size={12} />
                            <span>Lado a Lado</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('unified')}
                            className={clsx(
                                'flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] font-bold transition-all cursor-pointer text-xs',
                                viewMode === 'unified'
                                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            )}
                            title="Ver tabla única integrada con deltas matemáticos"
                        >
                            <Table size={12} />
                            <span>Matriz Delta</span>
                        </button>
                    </div>

                    {/* Toggle Ocultar / Mostrar solo diferencias */}
                    <button
                        type="button"
                        onClick={() => setHideDifferences((prev) => !prev)}
                        className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all cursor-pointer border',
                            hideDifferences
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/20'
                                : 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                        )}
                        title={hideDifferences ? 'Mostrar todos los 18 factores' : 'Filtrar solo factores con cambios'}
                    >
                        {hideDifferences ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{hideDifferences ? 'Solo diferencias' : 'Ocultar sin cambios'}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                            {totalDiffCount}
                        </span>
                    </button>
                </div>

                {/* Acciones Secundarias */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => window.print()}
                        className="flex items-center gap-1 text-xs h-8 px-2.5"
                        title="Imprimir informe comparativo oficial"
                    >
                        <Printer size={13} />
                        <span className="hidden sm:inline">Imprimir</span>
                    </Button>
                </div>
            </div>

            {/* ── 1. TARJETAS KPI DE IMPACTO EJECUTIVO ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* KPI 1: Dictamen */}
                <div className="p-3.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            Transición Dictamen
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                            <span className="text-xl font-black text-[var(--color-text-primary)]">
                                {verdictTransition?.from} → {verdictTransition?.to}
                            </span>
                        </div>
                        <span className="text-[10px] text-[var(--color-text-secondary)] block mt-0.5 truncate">
                            {verdictTransition?.label}
                        </span>
                    </div>
                    <div
                        className={clsx(
                            'p-2 rounded-[6px]',
                            verdictTransition?.status === 'improved'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : verdictTransition?.status === 'degraded'
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'bg-amber-500/10 text-amber-500'
                        )}
                    >
                        <Award size={20} />
                    </div>
                </div>

                {/* KPI 2: PM Global Delta */}
                <div className="p-3.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            PM Promedio Global
                        </span>
                        <div className="flex items-baseline gap-2 mt-1 font-mono">
                            <span className="text-xl font-black text-[var(--color-text-primary)]">
                                {stats.avgPM2}
                            </span>
                            <DeltaBadge delta={stats.avgPMDelta} />
                        </div>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block font-mono">
                            Antes: {stats.avgPM1} sobre 4.0
                        </span>
                    </div>
                    <div className="p-2 rounded-[6px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        {stats.avgPMDelta >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                </div>

                {/* KPI 3: Factores con Mejora */}
                <div className="p-3.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            Factores con Mejora
                        </span>
                        <span className="text-xl font-black font-mono text-emerald-500 mt-1 block">
                            {stats.improved}{' '}
                            <span className="text-xs font-normal text-[var(--color-text-secondary)]">factores</span>
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                            Aumentaron PM o subieron a Fortaleza
                        </span>
                    </div>
                    <div className="p-2 rounded-[6px] bg-emerald-500/10 text-emerald-500">
                        <ShieldCheck size={20} />
                    </div>
                </div>

                {/* KPI 4: Retrocesos o Exclusiones */}
                <div className="p-3.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] flex items-center justify-between shadow-xs">
                    <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            Retrocesos / Descartes
                        </span>
                        <span className="text-xl font-black font-mono text-rose-500 mt-1 block">
                            {stats.degraded}{' '}
                            <span className="text-xs font-normal text-[var(--color-text-secondary)]">factores</span>
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                            {stats.discarded} excluidos en Fase 1 (IR=1)
                        </span>
                    </div>
                    <div className="p-2 rounded-[6px] bg-rose-500/10 text-rose-500">
                        <ShieldAlert size={20} />
                    </div>
                </div>
            </div>

            {/* ── 2. INSPECTOR INTELIGENTE DE CAMBIO ACTIVO (PASO A PASO ENRIQUECIDO) ── */}
            {totalDiffCount > 0 && activeDiffFactor && (
                <div className="rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-primary)]/40 shadow-sm p-3.5 sm:p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[var(--color-border-subtle)] pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="px-2 py-0.5 rounded bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] text-xs font-mono font-black">
                                Cambio {activeDiffIndex + 1} de {totalDiffCount}
                            </span>
                            <h3 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] truncate">
                                {activeDiffFactor.order ? `${activeDiffFactor.order}. ` : ''}{activeDiffFactor.factorName}
                            </h3>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] font-mono">
                                {activeDiffFactor.dimensionName}
                            </span>
                            {/* Badge de tipo de cambio */}
                            <span
                                className={clsx(
                                    'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1',
                                    activeDiffFactor.changeType === 'improved' || activeDiffFactor.changeType === 'rescued'
                                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                        : activeDiffFactor.changeType === 'degraded'
                                        ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                        : activeDiffFactor.changeType === 'discarded'
                                        ? 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                                        : 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]'
                                )}
                            >
                                {activeDiffFactor.changeType === 'improved' && '▲ Mejora en Calificación'}
                                {activeDiffFactor.changeType === 'rescued' && '▲ Factor Recuperado'}
                                {activeDiffFactor.changeType === 'degraded' && '▼ Retroceso / Riesgo'}
                                {activeDiffFactor.changeType === 'discarded' && '⊘ Descartado (IR=1)'}
                                {activeDiffFactor.changeType === 'neutral' && '• Ajuste de Parámetros'}
                            </span>
                        </div>

                        {/* Controles de Navegación del Paso a Paso */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto font-mono text-xs shrink-0">
                            <button
                                type="button"
                                onClick={() => scrollToDiff(activeDiffIndex - 1)}
                                className="h-7 px-2.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors flex items-center gap-1 cursor-pointer font-bold"
                                title="Cambio anterior (Tecla ←)"
                            >
                                <ChevronLeft size={13} />
                                <span>Anterior</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => scrollToDiff(activeDiffIndex + 1)}
                                className="h-7 px-2.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors flex items-center gap-1 cursor-pointer font-bold"
                                title="Siguiente cambio (Tecla →)"
                            >
                                <span>Siguiente</span>
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>

                    {/* Desglose comparativo visual de las 3 variables (Compacto y Elegante) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {/* 1. Variación IR */}
                        <div className="p-2.5 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] space-y-1">
                            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] block">
                                Importancia Relativa (IR)
                            </span>
                            <div className="flex items-center gap-2 font-mono text-xs">
                                <span className="font-semibold text-[var(--color-text-secondary)]">
                                    Antes: {activeDiffFactor.ir1 ?? '—'}
                                </span>
                                <span className="text-[var(--color-border-strong)]">→</span>
                                <span className="font-bold text-[var(--color-text-primary)]">
                                    Después: {activeDiffFactor.ir2 ?? '—'}
                                </span>
                                {activeDiffFactor.hasDiffIR && (
                                    <span
                                        className={clsx(
                                            'text-[10px] font-bold px-1.5 py-0.2 rounded ml-auto',
                                            activeDiffFactor.deltaIR > 0
                                                ? 'bg-emerald-500/15 text-emerald-500'
                                                : 'bg-rose-500/15 text-rose-500'
                                        )}
                                    >
                                        {activeDiffFactor.deltaIR > 0 ? `+${activeDiffFactor.deltaIR} ▲` : `${activeDiffFactor.deltaIR} ▼`}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 2. Variación PM */}
                        <div className="p-2.5 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] space-y-1">
                            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] block">
                                Ponderación Media (PM)
                            </span>
                            <div className="flex items-center gap-2 font-mono text-xs">
                                <span className="font-semibold text-[var(--color-text-secondary)]">
                                    Antes: {activeDiffFactor.isDiscarded1 ? '— (Excluido)' : activeDiffFactor.pm1?.toFixed(2) ?? '—'}
                                </span>
                                <span className="text-[var(--color-border-strong)]">→</span>
                                <span className="font-bold text-[var(--color-text-primary)]">
                                    Después: {activeDiffFactor.isDiscarded2 ? '— (Excluido)' : activeDiffFactor.pm2?.toFixed(2) ?? '—'}
                                </span>
                                <div className="ml-auto">
                                    <DeltaBadge delta={activeDiffFactor.deltaPM} />
                                </div>
                            </div>
                        </div>

                        {/* 3. Variación FODA */}
                        <div className="p-2.5 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] space-y-1">
                            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[var(--color-text-tertiary)] block">
                                Diagnóstico FODA
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                                <FodaBadge foda={activeDiffFactor.foda1} isDiscarded={activeDiffFactor.isDiscarded1} />
                                <span className="text-[var(--color-border-strong)]">→</span>
                                <FodaBadge foda={activeDiffFactor.foda2} isDiscarded={activeDiffFactor.isDiscarded2} />
                            </div>
                        </div>
                    </div>

                    {/* Explicación Inteligente basada en los datos */}
                    <div className="p-3 rounded-[6px] bg-[var(--color-bg-page)]/70 border border-[var(--color-border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                                ℹ
                            </span>
                            <div className="space-y-0.5">
                                <span className="text-[11px] font-mono font-bold text-[var(--color-text-primary)] uppercase tracking-wider block">
                                    Análisis del Cambio:
                                </span>
                                <p className="text-[var(--color-text-primary)] leading-relaxed font-sans">
                                    {activeDiffFactor.explanation}
                                </p>
                            </div>
                        </div>

                        {activeDiffFactor.subfactors.length > 0 && (
                            <button
                                type="button"
                                onClick={() => handleToggleExpand(activeDiffFactor.factorId)}
                                className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 shrink-0 cursor-pointer px-2.5 py-1 rounded bg-[var(--color-primary-soft-bg)]/40 hover:bg-[var(--color-primary-soft-bg)]/70 transition-colors"
                            >
                                {expandedFactorIds.has(activeDiffFactor.factorId) ? (
                                    <>
                                        <ChevronUp size={13} />
                                        <span>Ocultar {activeDiffFactor.subfactors.length} subfactores</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={13} />
                                        <span>Auditar {activeDiffFactor.subfactors.length} subfactores</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Desglose inline de subfactores cuando el inspector está expandido */}
                    {expandedFactorIds.has(activeDiffFactor.factorId) && activeDiffFactor.subfactors.length > 0 && (
                        <div className="p-3 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-text-tertiary)] border-b border-[var(--color-border-subtle)] pb-1 font-bold uppercase">
                                <span>Afirmaciones Técnicas Verificables</span>
                                <span>Antes → Después (Δ)</span>
                            </div>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {activeDiffFactor.subfactors.map((sf) => (
                                    <div
                                        key={`insp-sf-${sf.subfactorId}`}
                                        className="flex items-center justify-between gap-3 text-xs py-1.5 px-2.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]"
                                    >
                                        <span className="text-[var(--color-text-secondary)] font-medium leading-snug line-clamp-2 flex-1">
                                            {sf.description}
                                        </span>
                                        <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                                            <span className="text-[var(--color-text-tertiary)]">
                                                {sf.rating1 != null ? `${sf.rating1}/4` : '—'}
                                            </span>
                                            <span className="text-[var(--color-border-strong)]">→</span>
                                            <span className="font-bold text-[var(--color-text-primary)]">
                                                {sf.rating2 != null ? `${sf.rating2}/4` : '—'}
                                            </span>
                                            {sf.hasDiff && (
                                                <span
                                                    className={clsx(
                                                        'text-[10px] font-bold px-1.5 py-0.2 rounded font-mono',
                                                        sf.diff > 0
                                                            ? 'bg-emerald-500/15 text-emerald-500'
                                                            : 'bg-rose-500/15 text-rose-500'
                                                    )}
                                                >
                                                    {sf.diff > 0 ? `+${sf.diff}` : sf.diff}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Barra de Filtro y Saltos Rápidos a Todos los Cambios (Wrapping & High Contrast) */}
                    <div className="pt-2 border-t border-[var(--color-border-subtle)] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-mono text-[var(--color-text-primary)] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <span>Saltar al Factor:</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] font-black">
                                    {filteredDiffFactors.length} de {totalDiffCount}
                                </span>
                            </span>

                            {/* Filtros por tipo de cambio */}
                            <div className="flex items-center gap-1 text-[10px] font-mono">
                                <button
                                    type="button"
                                    onClick={() => setChipFilter('all')}
                                    className={clsx(
                                        'px-2 py-0.5 rounded cursor-pointer transition-colors font-bold',
                                        chipFilter === 'all'
                                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)]'
                                    )}
                                >
                                    Todos ({totalDiffCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChipFilter('improved')}
                                    className={clsx(
                                        'px-2 py-0.5 rounded cursor-pointer transition-colors font-bold flex items-center gap-0.5',
                                        chipFilter === 'improved'
                                            ? 'bg-emerald-500 text-white'
                                            : 'text-emerald-500 hover:bg-emerald-500/10'
                                    )}
                                >
                                    <span>▲</span> Mejoras ({stats.improved})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChipFilter('degraded')}
                                    className={clsx(
                                        'px-2 py-0.5 rounded cursor-pointer transition-colors font-bold flex items-center gap-0.5',
                                        chipFilter === 'degraded'
                                            ? 'bg-rose-500 text-white'
                                            : 'text-rose-500 hover:bg-rose-500/10'
                                    )}
                                >
                                    <span>▼</span> Retrocesos ({stats.degraded})
                                </button>
                                {stats.discarded > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setChipFilter('discarded')}
                                        className={clsx(
                                            'px-2 py-0.5 rounded cursor-pointer transition-colors font-bold flex items-center gap-0.5',
                                            chipFilter === 'discarded'
                                                ? 'bg-[var(--color-text-secondary)] text-[var(--color-bg-page)]'
                                                : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-page)]'
                                        )}
                                    >
                                        <span>⊘</span> Excluidos ({stats.discarded})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Contenedor envolvente (flex-wrap) para visualizar los 17 factores sin recorte */}
                        <div className="flex flex-wrap items-center gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {filteredDiffFactors.map((df) => {
                                const originalIndex = diffFactors.findIndex((item) => item.factorId === df.factorId);
                                const isActive = originalIndex === activeDiffIndex;

                                return (
                                    <button
                                        key={`chip-${df.factorId}`}
                                        type="button"
                                        onClick={() => scrollToDiff(originalIndex)}
                                        className={clsx(
                                            'px-2.5 py-1 rounded-[5px] text-[11px] font-mono transition-all cursor-pointer border flex items-center gap-1.5 shadow-xs',
                                            isActive
                                                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-[var(--color-primary)] font-black ring-2 ring-[var(--color-primary)]/30'
                                                : 'bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-elevated)] font-semibold'
                                        )}
                                        title={`${df.factorName} (${df.dimensionName}): ${df.explanation}`}
                                    >
                                        <span
                                            className={clsx(
                                                'w-1.5 h-1.5 rounded-full shrink-0',
                                                df.changeType === 'improved' || df.changeType === 'rescued'
                                                    ? isActive ? 'bg-emerald-700' : 'bg-emerald-500'
                                                    : df.changeType === 'degraded'
                                                    ? isActive ? 'bg-rose-700' : 'bg-rose-500'
                                                    : df.changeType === 'discarded'
                                                    ? isActive ? 'bg-zinc-600' : 'bg-slate-400'
                                                    : isActive ? 'bg-amber-700' : 'bg-amber-400'
                                            )}
                                        />
                                        <span className="truncate max-w-[130px] sm:max-w-[180px]">
                                            {df.order ? `${df.order}. ` : ''}{df.factorName}
                                        </span>
                                        {df.deltaPM !== null && Math.abs(df.deltaPM) >= 0.01 && (
                                            <span
                                                className={clsx(
                                                    'text-[9px] px-1 py-0.2 rounded font-black font-mono shrink-0',
                                                    isActive
                                                        ? df.deltaPM > 0
                                                            ? 'bg-emerald-600/20 text-emerald-950 font-black'
                                                            : 'bg-rose-600/20 text-rose-950 font-black'
                                                        : df.deltaPM > 0
                                                        ? 'bg-emerald-500/15 text-emerald-500'
                                                        : 'bg-rose-500/15 text-rose-500'
                                                )}
                                            >
                                                {df.deltaPM > 0 ? `+${df.deltaPM.toFixed(2)}` : df.deltaPM.toFixed(2)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODALIDAD 1: VISTA LADO A LADO (ESPEJO MEJORADA CON DELTAS) ── */}
            {viewMode === 'split' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">
                    {/* ── TARJETA 1: ANTES ── */}
                    <div className="rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] border-t-2 border-t-emerald-600 shadow-sm overflow-hidden flex flex-col">
                        {/* Cabecera Tarjeta 1 */}
                        <div className="p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/40">
                            <div className="space-y-1 min-w-0">
                                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--color-text-tertiary)] uppercase block">
                                    ANTES
                                </span>
                                <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-tight truncate">
                                    {eval1.software_name}{' '}
                                    {eval1.software_version && (
                                        <span className="font-mono text-sm font-normal text-[var(--color-text-tertiary)]">
                                            {eval1.software_version}
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] font-medium">
                                    <Building2 size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
                                    <span className="truncate">{eval1.org_name}</span>
                                </div>
                                <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] block">
                                    Dictamen del {date1}
                                </span>
                            </div>

                            {/* Sello de Dictamen Oficial */}
                            <VerdictSeal recommendation={eval1.verdict?.recommendation || eval1.recommendation} />
                        </div>

                        {/* Tabla de Factores Tarjeta 1 */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        <th className="py-2.5 px-3.5">FACTOR</th>
                                        <th className="py-2.5 px-2 text-center w-12">IR</th>
                                        <th className="py-2.5 px-2 text-right w-16">PM</th>
                                        <th className="py-2.5 px-3.5 text-left w-28">FODA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]/60 font-sans">
                                    {visibleFactors.map((f) => {
                                        const isTargetDiff = diffFactors[activeDiffIndex]?.factorId === f.factorId;
                                        const isExpanded = expandedFactorIds.has(f.factorId);

                                        return (
                                            <React.Fragment key={`before-frag-${f.factorId}`}>
                                                <tr
                                                    ref={(el) => {
                                                        if (el) rowRefs.current.set(f.factorId, el);
                                                    }}
                                                    className={clsx(
                                                        'transition-colors',
                                                        isTargetDiff ? 'bg-[var(--color-primary-soft-bg)]/25 border-l-2 border-l-[var(--color-primary)] font-medium'
                                                            
                                                            : 'hover:bg-[var(--color-bg-page)]/40'
                                                    )}
                                                >
                                                    <td className="py-2.5 px-3.5">
                                                        <div className="flex items-center gap-1.5">
                                                            {f.subfactors.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleExpand(f.factorId)}
                                                                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] p-0.5 rounded cursor-pointer"
                                                                    title="Ver calificaciones de subfactores"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                </button>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-xs text-[var(--color-text-primary)] leading-snug">
                                                                    {f.factorName}
                                                                </div>
                                                                <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                                                                    {f.dimensionName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-2.5 px-2 text-center font-mono">
                                                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                                            {f.ir1 ?? '—'}
                                                        </span>
                                                    </td>

                                                    <td className="py-2.5 px-2 text-right font-mono">
                                                        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                                            {f.isDiscarded1 ? '—' : f.pm1 != null ? f.pm1.toFixed(2) : '—'}
                                                        </span>
                                                    </td>

                                                    <td className="py-2.5 px-3.5 text-left">
                                                        <FodaBadge foda={f.foda1} isDiscarded={f.isDiscarded1} />
                                                    </td>
                                                </tr>

                                                {/* Detalle Desplegado de Subfactores de Tarjeta 1 */}
                                                {isExpanded && f.subfactors.length > 0 && (
                                                    <tr className="bg-[var(--color-bg-page)]/80">
                                                        <td colSpan={4} className="p-3 pl-8">
                                                            <span className="text-[10px] font-mono uppercase font-bold text-[var(--color-text-tertiary)] block mb-1.5">
                                                                Afirmaciones Técnicas Verificables (Antes)
                                                            </span>
                                                            <div className="space-y-1.5">
                                                                {f.subfactors.map((sf) => (
                                                                    <div
                                                                        key={`sf1-${sf.subfactorId}`}
                                                                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] gap-2"
                                                                    >
                                                                        <span className="truncate flex-1 text-[var(--color-text-secondary)]">
                                                                            {sf.description}
                                                                        </span>
                                                                        <span className="font-mono text-xs font-bold px-1.5 py-0.2 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
                                                                            {sf.rating1 != null ? `${sf.rating1} / 4` : '—'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    {visibleFactors.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
                                                No hay factores con diferencias entre estas dos evaluaciones.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── TARJETA 2: DESPUÉS ── */}
                    <div className="rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] border-t-2 border-t-emerald-600 shadow-sm overflow-hidden flex flex-col">
                        {/* Cabecera Tarjeta 2 */}
                        <div className="p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/40">
                            <div className="space-y-1 min-w-0">
                                <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--color-text-tertiary)] uppercase block">
                                    DESPUÉS
                                </span>
                                <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-tight truncate">
                                    {eval2.software_name}{' '}
                                    {eval2.software_version && (
                                        <span className="font-mono text-sm font-normal text-[var(--color-text-tertiary)]">
                                            {eval2.software_version}
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] font-medium">
                                    <Building2 size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
                                    <span className="truncate">{eval2.org_name}</span>
                                </div>
                                <span className="text-[11px] font-mono text-[var(--color-text-tertiary)] block">
                                    Dictamen del {date2}
                                </span>
                            </div>

                            {/* Sello de Dictamen Oficial */}
                            <VerdictSeal recommendation={eval2.verdict?.recommendation || eval2.recommendation} />
                        </div>

                        {/* Tabla de Factores Tarjeta 2 */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        <th className="py-2.5 px-3.5">FACTOR</th>
                                        <th className="py-2.5 px-2 text-center w-12">IR</th>
                                        <th className="py-2.5 px-2 text-right w-24">PM (Δ)</th>
                                        <th className="py-2.5 px-3.5 text-left w-32">FODA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]/60 font-sans">
                                    {visibleFactors.map((f) => {
                                        const isTargetDiff = diffFactors[activeDiffIndex]?.factorId === f.factorId;
                                        const isExpanded = expandedFactorIds.has(f.factorId);

                                        return (
                                            <React.Fragment key={`after-frag-${f.factorId}`}>
                                                <tr
                                                    className={clsx(
                                                        'transition-colors',
                                                        isTargetDiff ? 'bg-[var(--color-primary-soft-bg)]/25 border-l-2 border-l-[var(--color-primary)] font-medium'
                                                            
                                                            : 'hover:bg-[var(--color-bg-page)]/40'
                                                    )}
                                                >
                                                    <td className="py-2.5 px-3.5">
                                                        <div className="flex items-center gap-1.5">
                                                            {f.subfactors.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleExpand(f.factorId)}
                                                                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] p-0.5 rounded cursor-pointer"
                                                                    title="Ver calificaciones de subfactores"
                                                                >
                                                                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                                </button>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-semibold text-xs text-[var(--color-text-primary)] leading-snug">
                                                                    {f.factorName}
                                                                </div>
                                                                <span className="text-[10px] text-[var(--color-text-tertiary)] block">
                                                                    {f.dimensionName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="py-2.5 px-2 text-center font-mono">
                                                        <span
                                                            className={clsx(
                                                                'text-xs font-bold px-1.5 py-0.5 rounded',
                                                                f.hasDiffIR
                                                                    ? f.deltaIR > 0
                                                                        ? 'bg-emerald-500/20 text-emerald-500 font-black'
                                                                        : 'bg-rose-500/20 text-rose-500 font-black'
                                                                    : 'text-[var(--color-text-primary)]'
                                                            )}
                                                            title={f.hasDiffIR ? `Antes era IR=${f.ir1}` : undefined}
                                                        >
                                                            {f.ir2 ?? '—'}
                                                        </span>
                                                    </td>

                                                    <td className="py-2.5 px-2 text-right font-mono">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                                                {f.isDiscarded2 ? '—' : f.pm2 != null ? f.pm2.toFixed(2) : '—'}
                                                            </span>
                                                            {f.hasDiffPM && <DeltaBadge delta={f.deltaPM} />}
                                                        </div>
                                                    </td>

                                                    <td className="py-2.5 px-3.5 text-left">
                                                        <div className="flex items-center gap-1">
                                                            <FodaBadge foda={f.foda2} isDiscarded={f.isDiscarded2} />
                                                            {f.hasDiffFODA && (
                                                                <span
                                                                    className="text-[9px] font-mono text-[var(--color-text-tertiary)] block truncate"
                                                                    title={`Antes: ${f.foda1}`}
                                                                >
                                                                    (era {f.foda1})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Detalle Desplegado de Subfactores de Tarjeta 2 con Deltas */}
                                                {isExpanded && f.subfactors.length > 0 && (
                                                    <tr className="bg-[var(--color-bg-page)]/80">
                                                        <td colSpan={4} className="p-3 pl-8">
                                                            <span className="text-[10px] font-mono uppercase font-bold text-[var(--color-text-tertiary)] block mb-1.5">
                                                                Afirmaciones Técnicas Verificables (Después y Variación)
                                                            </span>
                                                            <div className="space-y-1.5">
                                                                {f.subfactors.map((sf) => (
                                                                    <div
                                                                        key={`sf2-${sf.subfactorId}`}
                                                                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] gap-2"
                                                                    >
                                                                        <span className="truncate flex-1 text-[var(--color-text-primary)] font-medium">
                                                                            {sf.description}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5 font-mono text-xs shrink-0">
                                                                            <span className="text-[var(--color-text-secondary)]">
                                                                                {sf.rating1 != null ? sf.rating1 : '—'} →
                                                                            </span>
                                                                            <span className="font-bold text-[var(--color-text-primary)]">
                                                                                {sf.rating2 != null ? `${sf.rating2} / 4` : '—'}
                                                                            </span>
                                                                            {sf.hasDiff && (
                                                                                <span
                                                                                    className={clsx(
                                                                                        'text-[10px] font-bold px-1 rounded',
                                                                                        sf.diff > 0
                                                                                            ? 'bg-emerald-500/15 text-emerald-500'
                                                                                            : 'bg-rose-500/15 text-rose-500'
                                                                                    )}
                                                                                >
                                                                                    {sf.diff > 0 ? `+${sf.diff}` : sf.diff}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}

                                    {visibleFactors.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
                                                No hay factores con diferencias entre estas dos evaluaciones.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODALIDAD 2: MATRIZ DELTA UNIFICADA (TABLA CONSOLIDADA CON AUDITORÍA METODOLÓGICA) ── */}
            {viewMode === 'unified' && (
                <div className="rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-sm overflow-hidden">
                    <div className="p-3.5 bg-[var(--color-bg-page)] border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-[var(--color-text-secondary)]" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] font-mono">
                                Matriz Consolidada de Variación Metodológica
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                            {visibleFactors.length} factores en auditoría • Comparando Antes vs Después
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/60 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                    <th className="py-2.5 px-3.5">FACTOR / DIMENSIÓN</th>
                                    <th className="py-2.5 px-2 text-center">IR (Antes → Después)</th>
                                    <th className="py-2.5 px-2 text-center">PM (Antes → Después)</th>
                                    <th className="py-2.5 px-2 text-center">Variación Δ</th>
                                    <th className="py-2.5 px-3 text-center">Transición FODA</th>
                                    <th className="py-2.5 px-3.5 text-left">Diagnóstico de Impacto</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border-subtle)]/60 font-sans">
                                {visibleFactors.map((f) => {
                                    const isTargetDiff = diffFactors[activeDiffIndex]?.factorId === f.factorId;
                                    const isExpanded = expandedFactorIds.has(f.factorId);

                                    return (
                                        <React.Fragment key={`unified-frag-${f.factorId}`}>
                                            <tr
                                                className={clsx(
                                                    'transition-colors',
                                                    isTargetDiff ? 'bg-[var(--color-primary-soft-bg)]/25 border-l-2 border-l-[var(--color-primary)] font-medium'
                                                        
                                                        : 'hover:bg-[var(--color-bg-page)]/40'
                                                )}
                                            >
                                                <td className="py-2.5 px-3.5">
                                                    <div className="flex items-center gap-1.5">
                                                        {f.subfactors.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleExpand(f.factorId)}
                                                                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] p-0.5 rounded cursor-pointer"
                                                                title="Ver subfactores"
                                                            >
                                                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                            </button>
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-xs text-[var(--color-text-primary)]">
                                                                {f.factorName}
                                                            </div>
                                                            <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                                                                {f.dimensionName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* IR */}
                                                <td className="py-2.5 px-2 text-center font-mono">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="text-[var(--color-text-secondary)]">{f.ir1 ?? '—'}</span>
                                                        <span className="text-[var(--color-border-strong)]">→</span>
                                                        <span className="font-bold text-[var(--color-text-primary)]">{f.ir2 ?? '—'}</span>
                                                    </div>
                                                </td>

                                                {/* PM */}
                                                <td className="py-2.5 px-2 text-center font-mono">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="text-[var(--color-text-secondary)]">
                                                            {f.isDiscarded1 ? '—' : f.pm1?.toFixed(2) ?? '—'}
                                                        </span>
                                                        <span className="text-[var(--color-border-strong)]">→</span>
                                                        <span className="font-bold text-[var(--color-text-primary)]">
                                                            {f.isDiscarded2 ? '—' : f.pm2?.toFixed(2) ?? '—'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Delta */}
                                                <td className="py-2.5 px-2 text-center font-mono">
                                                    <DeltaBadge delta={f.deltaPM} />
                                                </td>

                                                {/* Transición FODA */}
                                                <td className="py-2.5 px-3 text-center">
                                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                                        <FodaBadge foda={f.foda1} isDiscarded={f.isDiscarded1} />
                                                        <span className="text-[10px] text-[var(--color-border-strong)]">→</span>
                                                        <FodaBadge foda={f.foda2} isDiscarded={f.isDiscarded2} />
                                                    </div>
                                                </td>

                                                {/* Explicación */}
                                                <td className="py-2.5 px-3.5">
                                                    <span className="text-xs text-[var(--color-text-secondary)] leading-tight block">
                                                        {f.explanation}
                                                    </span>
                                                </td>
                                            </tr>

                                            {/* Subfactores anidados en modo unificado */}
                                            {isExpanded && f.subfactors.length > 0 && (
                                                <tr className="bg-[var(--color-bg-page)]/80">
                                                    <td colSpan={6} className="p-3 pl-10">
                                                        <span className="text-[10px] font-mono uppercase font-bold text-[var(--color-text-tertiary)] block mb-1.5">
                                                            Desglose comparativo por afirmación técnica
                                                        </span>
                                                        <div className="space-y-1">
                                                            {f.subfactors.map((sf) => (
                                                                <div
                                                                    key={`sf-uni-${sf.subfactorId}`}
                                                                    className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] gap-3"
                                                                >
                                                                    <span className="text-[var(--color-text-primary)] flex-1 truncate">
                                                                        {sf.description}
                                                                    </span>
                                                                    <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                                                                        <span className="text-[var(--color-text-secondary)]">
                                                                            Antes: {sf.rating1 != null ? `${sf.rating1}/4` : '—'}
                                                                        </span>
                                                                        <span>→</span>
                                                                        <span className="font-bold text-[var(--color-text-primary)]">
                                                                            Después: {sf.rating2 != null ? `${sf.rating2}/4` : '—'}
                                                                        </span>
                                                                        {sf.hasDiff && (
                                                                            <span
                                                                                className={clsx(
                                                                                    'text-[10px] font-bold px-1.5 py-0.2 rounded',
                                                                                    sf.diff > 0
                                                                                        ? 'bg-emerald-500/15 text-emerald-500'
                                                                                        : 'bg-rose-500/15 text-rose-500'
                                                                                )}
                                                                            >
                                                                                {sf.diff > 0 ? `+${sf.diff}` : sf.diff}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}

                                {visibleFactors.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
                                            No hay factores con diferencias entre estas dos evaluaciones.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── BARRA INFERIOR DE RESUMEN METODOLÓGICO ── */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs print:hidden">
                <div className="flex items-center gap-3">
                    <span className="p-2 rounded-[6px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Layers size={18} />
                    </span>
                    <div>
                        <span className="font-bold text-[var(--color-text-primary)] block">
                            Auditoría Comparativa GUIOS PRO
                        </span>
                        <span className="text-[11px] text-[var(--color-text-secondary)] font-mono">
                            {alignedFactors.length} factores contrastados • {totalDiffCount} cambios detectados ({stats.improved} mejoras, {stats.degraded} retrocesos)
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/dashboard/guios/evaluaciones')}
                        className="text-xs h-8 px-3 font-semibold"
                    >
                        Volver a la Lista
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default EvaluationComparePage;
