/**
 * features/publicEvaluation/components/PublicEvaluationCompareModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal Comparador Ejecutivo entre dos Evaluaciones Públicas guardadas en el
 * navegador (Paso 0 - Historial Local).
 *
 * Permite contrastar lado a lado dos softwares FLOSS evaluados (o dos versiones
 * del mismo software) analizando Dictamen (A/B/C), Promedio Global (PM),
 * Matriz FODA (F/O/D/A), Deltas cuantitativos por factor y desglose por subfactores.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeftRight,
    TrendingUp,
    TrendingDown,
    ChevronDown,
    ChevronUp,
    Award,
    Layers,
    Eye,
    EyeOff,
    AlertCircle,
    Play,
} from 'lucide-react';
import { clsx } from 'clsx';

import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import publicEvaluationService from '../../../api/publicEvaluationService';
import type { EvaluationDetail } from '../../../api/evaluationService';
import type { SavedEvaluationItem } from '../utils/historyStorage';
import { getErrorDetail } from '../../../utils/errorUtils';

interface PublicEvaluationCompareModalProps {
    isOpen: boolean;
    onClose: () => void;
    savedEvaluations: SavedEvaluationItem[];
    initialUuid1?: string;
    initialUuid2?: string;
    onResumeEvaluation?: (uuid: string) => void;
}

interface SubfactorComparisonItem {
    subfactorId: number;
    description: string;
    rating1: number | null;
    rating2: number | null;
    diff: number;
}

interface FactorComparisonRow {
    factorId: number;
    factorName: string;
    dimensionName: string;
    ir1: number | null;
    pm1: number | null;
    foda1: string;
    isDiscarded1: boolean;
    ir2: number | null;
    pm2: number | null;
    foda2: string;
    isDiscarded2: boolean;
    deltaPM: number | null;
    hasDiff: boolean;
    subfactors: SubfactorComparisonItem[];
}

const getFodaLabel = (cls?: string | null, display?: string | null, isDiscarded?: boolean): string => {
    if (isDiscarded) return 'Descartado';
    if (display) return display;
    switch (cls) {
        case 'strength':
            return 'Fortaleza';
        case 'opportunity':
            return 'Oportunidad';
        case 'weakness':
            return 'Debilidad';
        case 'threat':
            return 'Amenaza';
        default:
            return 'Pendiente';
    }
};

const FodaPill: React.FC<{ foda: string; isDiscarded?: boolean }> = ({ foda, isDiscarded }) => {
    if (isDiscarded || foda === 'Descartado') {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)] italic">
                IR=1 (Excluido)
            </span>
        );
    }
    const lower = foda.toLowerCase();
    if (lower.includes('fortaleza') || lower.includes('oportunidad')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>{foda}</span>
            </span>
        );
    }
    if (lower.includes('debilidad')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>{foda}</span>
            </span>
        );
    }
    if (lower.includes('amenaza')) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>{foda}</span>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)]">
            {foda}
        </span>
    );
};

const DeltaBadge: React.FC<{ delta: number | null }> = ({ delta }) => {
    if (delta === null || Math.abs(delta) < 0.005) {
        return <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">0.00</span>;
    }
    const isPos = delta > 0;
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border',
                isPos
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
            )}
        >
            {isPos ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span>
                {isPos ? '+' : ''}
                {delta.toFixed(2)}
            </span>
        </span>
    );
};

const VerdictBadge: React.FC<{ rec?: string | null }> = ({ rec }) => {
    const code = (rec || '—').toUpperCase();
    const style =
        code === 'A'
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/35'
            : code === 'B'
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/35'
            : code === 'C'
            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35'
            : 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]';

    return (
        <div
            className={clsx(
                'w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center shrink-0 font-mono',
                style
            )}
            title={code !== '—' ? `Dictamen Oficial: Recomendación ${code}` : 'Sin dictamen emitido aún'}
        >
            <span className="text-sm font-black leading-none">{code}</span>
            <span className="text-[7px] font-bold uppercase tracking-wider mt-0.5">Dict.</span>
        </div>
    );
};

export const PublicEvaluationCompareModal: React.FC<PublicEvaluationCompareModalProps> = ({
    isOpen,
    onClose,
    savedEvaluations,
    initialUuid1,
    initialUuid2,
    onResumeEvaluation,
}) => {
    const [uuid1, setUuid1] = useState<string>('');
    const [uuid2, setUuid2] = useState<string>('');
    const [eval1, setEval1] = useState<EvaluationDetail | null>(null);
    const [eval2, setEval2] = useState<EvaluationDetail | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [onlyDifferences, setOnlyDifferences] = useState<boolean>(false);
    const [expandedFactorId, setExpandedFactorId] = useState<number | null>(null);

    // Inicializar UUIDs al abrir el modal
    useEffect(() => {
        if (!isOpen || savedEvaluations.length < 2) return;
        const first = initialUuid1 || savedEvaluations[0]?.uuid || '';
        const second =
            initialUuid2 && initialUuid2 !== first
                ? initialUuid2
                : savedEvaluations.find((e) => e.uuid !== first)?.uuid || savedEvaluations[1]?.uuid || '';
        setUuid1(first);
        setUuid2(second);
    }, [isOpen, initialUuid1, initialUuid2, savedEvaluations]);

    // Cargar el detalle completo de ambas evaluaciones
    useEffect(() => {
        if (!isOpen || !uuid1 || !uuid2) return;

        let cancelled = false;
        setLoading(true);
        setError(null);

        Promise.all([
            publicEvaluationService.getEvaluation(uuid1),
            publicEvaluationService.getEvaluation(uuid2),
        ])
            .then(([data1, data2]) => {
                if (cancelled) return;
                setEval1(data1);
                setEval2(data2);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(
                    getErrorDetail(
                        err,
                        'No se pudieron cargar los detalles de las evaluaciones seleccionadas.'
                    )
                );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, uuid1, uuid2]);

    const handleSwap = () => {
        setUuid1(uuid2);
        setUuid2(uuid1);
    };

    // Construcción de filas comparativas por factor
    const comparisonRows = useMemo<FactorComparisonRow[]>(() => {
        if (!eval1 || !eval2) return [];

        const factors1 = eval1.factors || [];
        const factors2 = eval2.factors || [];
        const results1 = eval1.results || [];
        const results2 = eval2.results || [];
        const subfactors1 = eval1.subfactors || [];
        const subfactors2 = eval2.subfactors || [];

        const factorIds = Array.from(
            new Set([...factors1.map((f) => f.factor_id), ...factors2.map((f) => f.factor_id)])
        );

        return factorIds.map((factorId) => {
            const f1 = factors1.find((f) => f.factor_id === factorId);
            const f2 = factors2.find((f) => f.factor_id === factorId);
            const r1 = results1.find((r) => r.factor_id === factorId);
            const r2 = results2.find((r) => r.factor_id === factorId);

            const ir1 = f1?.relative_importance ?? null;
            const ir2 = f2?.relative_importance ?? null;
            const isDiscarded1 = ir1 === 1;
            const isDiscarded2 = ir2 === 1;

            const pm1 =
                !isDiscarded1 && r1?.weighted_average !== undefined && r1?.weighted_average !== null
                    ? Number(r1.weighted_average)
                    : null;
            const pm2 =
                !isDiscarded2 && r2?.weighted_average !== undefined && r2?.weighted_average !== null
                    ? Number(r2.weighted_average)
                    : null;

            const foda1 = getFodaLabel(r1?.foda_classification, r1?.foda_display, isDiscarded1);
            const foda2 = getFodaLabel(r2?.foda_classification, r2?.foda_display, isDiscarded2);

            const deltaPM = pm1 !== null && pm2 !== null ? pm2 - pm1 : null;
            const hasDiff =
                (deltaPM !== null && Math.abs(deltaPM) >= 0.01) ||
                foda1 !== foda2 ||
                ir1 !== ir2;

            const sf1List = subfactors1.filter((s) => s.factor_id === factorId);
            const sf2List = subfactors2.filter((s) => s.factor_id === factorId);
            const subIds = Array.from(
                new Set([
                    ...sf1List.map((s) => s.subfactor_id),
                    ...sf2List.map((s) => s.subfactor_id),
                ])
            );

            const subfactors: SubfactorComparisonItem[] = subIds.map((subId) => {
                const s1 = sf1List.find((s) => s.subfactor_id === subId);
                const s2 = sf2List.find((s) => s.subfactor_id === subId);
                const rt1 = s1?.rating ?? null;
                const rt2 = s2?.rating ?? null;
                return {
                    subfactorId: subId,
                    description: s1?.description_snapshot || s2?.description_snapshot || `Criterio #${subId}`,
                    rating1: rt1,
                    rating2: rt2,
                    diff: rt1 !== null && rt2 !== null ? rt2 - rt1 : 0,
                };
            });

            return {
                factorId,
                factorName: f1?.factor_name || f2?.factor_name || `Factor #${factorId}`,
                dimensionName: f1?.dimension_name || f2?.dimension_name || 'General',
                ir1,
                pm1,
                foda1,
                isDiscarded1,
                ir2,
                pm2,
                foda2,
                isDiscarded2,
                deltaPM,
                hasDiff,
                subfactors,
            };
        });
    }, [eval1, eval2]);

    const filteredRows = useMemo(() => {
        if (!onlyDifferences) return comparisonRows;
        return comparisonRows.filter((r) => r.hasDiff);
    }, [comparisonRows, onlyDifferences]);

    // Resumen ejecutivo agregado de ambas evaluaciones
    const summaryMetrics = useMemo(() => {
        const validPm1 = comparisonRows.filter((r) => r.pm1 !== null).map((r) => r.pm1!);
        const validPm2 = comparisonRows.filter((r) => r.pm2 !== null).map((r) => r.pm2!);

        const avgPm1 =
            validPm1.length > 0 ? validPm1.reduce((acc, v) => acc + v, 0) / validPm1.length : 0;
        const avgPm2 =
            validPm2.length > 0 ? validPm2.reduce((acc, v) => acc + v, 0) / validPm2.length : 0;

        let bWinsCount = 0;
        let aWinsCount = 0;
        comparisonRows.forEach((r) => {
            if (r.deltaPM !== null) {
                if (r.deltaPM > 0.01) bWinsCount++;
                else if (r.deltaPM < -0.01) aWinsCount++;
            }
        });

        const countFoda = (ev: EvaluationDetail | null) => {
            const res = ev?.results || [];
            return {
                f: res.filter((r) => r.foda_classification === 'strength').length,
                o: res.filter((r) => r.foda_classification === 'opportunity').length,
                d: res.filter((r) => r.foda_classification === 'weakness').length,
                a: res.filter((r) => r.foda_classification === 'threat').length,
            };
        };

        return {
            avgPm1,
            avgPm2,
            globalDelta: validPm1.length > 0 && validPm2.length > 0 ? avgPm2 - avgPm1 : null,
            bWinsCount,
            aWinsCount,
            foda1: countFoda(eval1),
            foda2: countFoda(eval2),
        };
    }, [comparisonRows, eval1, eval2]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Comparador de Evaluaciones FLOSS (GUIOS)"
            size="lg"
            footer={
                <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-[11px] text-[var(--color-text-tertiary)] hidden sm:inline">
                        Haz clic en cualquier fila de la tabla para desglosar sus subfactores (1 a 4).
                    </span>
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cerrar Comparador
                    </Button>
                </div>
            }
        >
            <div className="space-y-3.5 max-h-[75vh] overflow-y-auto pr-1">
                {/* ── 1. Selector de Evaluaciones A y B ── */}
                <div className="p-2.5 sm:p-3 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] grid grid-cols-1 md:grid-cols-11 gap-2 items-center">
                    <div className="md:col-span-5">
                        <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-text-tertiary)] mb-1">
                            Evaluación Base (A)
                        </label>
                        <select
                            value={uuid1}
                            onChange={(e) => setUuid1(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                        >
                            {savedEvaluations.map((ev) => (
                                <option key={ev.uuid} value={ev.uuid} disabled={ev.uuid === uuid2}>
                                    {ev.software_name} {ev.software_version ? `(v${ev.software_version})` : ''} — {ev.org_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-1 flex justify-center pt-1 md:pt-4">
                        <button
                            type="button"
                            onClick={handleSwap}
                            className="p-2 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                            title="Intercambiar orden de comparación (A ↔ B)"
                        >
                            <ArrowLeftRight size={14} />
                        </button>
                    </div>

                    <div className="md:col-span-5">
                        <label className="block text-[10px] font-mono font-bold uppercase text-[var(--color-text-tertiary)] mb-1">
                            Evaluación Comparada (B)
                        </label>
                        <select
                            value={uuid2}
                            onChange={(e) => setUuid2(e.target.value)}
                            className="w-full h-9 px-2.5 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                        >
                            {savedEvaluations.map((ev) => (
                                <option key={ev.uuid} value={ev.uuid} disabled={ev.uuid === uuid1}>
                                    {ev.software_name} {ev.software_version ? `(v${ev.software_version})` : ''} — {ev.org_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-xs text-[var(--color-text-secondary)] space-y-2">
                        <div className="w-6 h-6 border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] rounded-full animate-spin mx-auto" />
                        <p>Sincronizando matrices y calculando deltas metodológicos...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 rounded-[6px] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : eval1 && eval2 ? (
                    <>
                        {/* ── 2. Tarjetas Ejecutivas Lado a Lado + Variación Global ── */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                            {/* Software A */}
                            <div className="p-3 rounded-[6px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex flex-col justify-between gap-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]">
                                            Base (A)
                                        </span>
                                        <h4 className="text-xs sm:text-sm font-black text-[var(--color-text-primary)] truncate mt-1">
                                            {eval1.software_name}
                                        </h4>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                            {eval1.org_name}
                                        </p>
                                    </div>
                                    <VerdictBadge rec={eval1.verdict?.recommendation} />
                                </div>
                                <div className="pt-2 border-t border-[var(--color-border-subtle)]/70 flex items-center justify-between text-[11px] font-mono">
                                    <span>
                                        PM Global:{' '}
                                        <strong className="text-[var(--color-text-primary)]">
                                            {summaryMetrics.avgPm1 > 0 ? summaryMetrics.avgPm1.toFixed(2) : '—'}
                                        </strong>
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                        F:{summaryMetrics.foda1.f} O:{summaryMetrics.foda1.o} D:{summaryMetrics.foda1.d} A:{summaryMetrics.foda1.a}
                                    </span>
                                </div>
                                {onResumeEvaluation && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onResumeEvaluation(eval1.uuid);
                                        }}
                                        className="text-[10px] font-bold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer self-start"
                                    >
                                        <Play size={9} fill="currentColor" />
                                        <span>Abrir esta evaluación</span>
                                    </button>
                                )}
                            </div>

                            {/* Software B */}
                            <div className="p-3 rounded-[6px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex flex-col justify-between gap-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--color-primary-soft-bg)] border border-[var(--color-primary)]/25 text-[var(--color-primary)]">
                                            Comparada (B)
                                        </span>
                                        <h4 className="text-xs sm:text-sm font-black text-[var(--color-text-primary)] truncate mt-1">
                                            {eval2.software_name}
                                        </h4>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                            {eval2.org_name}
                                        </p>
                                    </div>
                                    <VerdictBadge rec={eval2.verdict?.recommendation} />
                                </div>
                                <div className="pt-2 border-t border-[var(--color-border-subtle)]/70 flex items-center justify-between text-[11px] font-mono">
                                    <span>
                                        PM Global:{' '}
                                        <strong className="text-[var(--color-text-primary)]">
                                            {summaryMetrics.avgPm2 > 0 ? summaryMetrics.avgPm2.toFixed(2) : '—'}
                                        </strong>
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                        F:{summaryMetrics.foda2.f} O:{summaryMetrics.foda2.o} D:{summaryMetrics.foda2.d} A:{summaryMetrics.foda2.a}
                                    </span>
                                </div>
                                {onResumeEvaluation && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onResumeEvaluation(eval2.uuid);
                                        }}
                                        className="text-[10px] font-bold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer self-start"
                                    >
                                        <Play size={9} fill="currentColor" />
                                        <span>Abrir esta evaluación</span>
                                    </button>
                                )}
                            </div>

                            {/* Diagnóstico Comparativo */}
                            <div className="p-3 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] flex flex-col justify-between gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-secondary)] flex items-center gap-1">
                                        <Award size={12} className="text-[var(--color-primary)]" />
                                        <span>Balance Técnico (B vs A)</span>
                                    </span>
                                    <DeltaBadge delta={summaryMetrics.globalDelta} />
                                </div>

                                <div className="text-xs text-[var(--color-text-primary)] leading-snug">
                                    {summaryMetrics.globalDelta !== null && Math.abs(summaryMetrics.globalDelta) >= 0.02 ? (
                                        summaryMetrics.globalDelta > 0 ? (
                                            <span>
                                                <strong className="text-emerald-500">{eval2.software_name}</strong> supera en promedio global por{' '}
                                                <strong className="font-mono">+{summaryMetrics.globalDelta.toFixed(2)} pts</strong>.
                                            </span>
                                        ) : (
                                            <span>
                                                <strong className="text-emerald-500">{eval1.software_name}</strong> supera en promedio global por{' '}
                                                <strong className="font-mono">+{Math.abs(summaryMetrics.globalDelta).toFixed(2)} pts</strong>.
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-[var(--color-text-secondary)]">
                                            Desempeño técnico global equivalente o pendiente de calificación en una de las sesiones.
                                        </span>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-[var(--color-border-subtle)]/70 flex items-center justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                                    <span>Superiores en B: <strong className="text-emerald-500">{summaryMetrics.bWinsCount}</strong></span>
                                    <span>Superiores en A: <strong className="text-amber-500">{summaryMetrics.aWinsCount}</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* ── 3. Cabecera de la Matriz Delta ── */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)]">
                                <Layers size={14} className="text-[var(--color-primary)]" />
                                <span>Comparativa por Factor ({filteredRows.length})</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOnlyDifferences((v) => !v)}
                                className={clsx(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] border text-[11px] font-semibold transition-all cursor-pointer select-none',
                                    onlyDifferences
                                        ? 'bg-[var(--color-primary-soft-bg)] border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                                        : 'bg-[var(--color-bg-page)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                )}
                            >
                                {onlyDifferences ? <Eye size={12} /> : <EyeOff size={12} />}
                                <span>Solo diferencias</span>
                            </button>
                        </div>

                        {/* ── 4. Tabla Comparativa con Desglose de Subfactores ── */}
                        <div className="rounded-[6px] border border-[var(--color-border-default)] overflow-hidden bg-[var(--color-bg-elevated)]">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs min-w-[600px]">
                                    <thead>
                                        <tr className="bg-[var(--color-bg-page)] border-b border-[var(--color-border-default)] text-[10px] font-mono uppercase text-[var(--color-text-tertiary)]">
                                            <th className="py-2 px-3">Factor / Dimensión</th>
                                            <th className="py-2 px-2.5 text-center">Base (A): {eval1.software_name}</th>
                                            <th className="py-2 px-2.5 text-center">Comp. (B): {eval2.software_name}</th>
                                            <th className="py-2 px-2.5 text-center">Δ PM (B - A)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border-subtle)]/60">
                                        {filteredRows.map((row) => {
                                            const isExpanded = expandedFactorId === row.factorId;
                                            return (
                                                <React.Fragment key={row.factorId}>
                                                    <tr
                                                        onClick={() =>
                                                            setExpandedFactorId(isExpanded ? null : row.factorId)
                                                        }
                                                        className="hover:bg-[var(--color-bg-page)]/60 transition-colors cursor-pointer"
                                                    >
                                                        <td className="py-2.5 px-3">
                                                            <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)]">
                                                                {isExpanded ? (
                                                                    <ChevronUp size={13} className="text-[var(--color-primary)] shrink-0" />
                                                                ) : (
                                                                    <ChevronDown size={13} className="text-[var(--color-text-tertiary)] shrink-0" />
                                                                )}
                                                                <span>{row.factorName}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] pl-5 block">
                                                                {row.dimensionName}
                                                            </span>
                                                        </td>

                                                        <td className="py-2.5 px-2.5 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                                                    {row.pm1 !== null ? `PM ${row.pm1.toFixed(1)}` : '—'}
                                                                    {row.ir1 !== null && (
                                                                        <span className="text-[10px] font-normal text-[var(--color-text-tertiary)] ml-1">
                                                                            (IR={row.ir1})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <FodaPill foda={row.foda1} isDiscarded={row.isDiscarded1} />
                                                            </div>
                                                        </td>

                                                        <td className="py-2.5 px-2.5 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                                                    {row.pm2 !== null ? `PM ${row.pm2.toFixed(1)}` : '—'}
                                                                    {row.ir2 !== null && (
                                                                        <span className="text-[10px] font-normal text-[var(--color-text-tertiary)] ml-1">
                                                                            (IR={row.ir2})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <FodaPill foda={row.foda2} isDiscarded={row.isDiscarded2} />
                                                            </div>
                                                        </td>

                                                        <td className="py-2.5 px-2.5 text-center">
                                                            <DeltaBadge delta={row.deltaPM} />
                                                        </td>
                                                    </tr>

                                                    {isExpanded && (
                                                        <tr className="bg-[var(--color-bg-page)]/80">
                                                            <td colSpan={4} className="p-3">
                                                                <div className="text-[10px] font-mono font-bold uppercase text-[var(--color-text-secondary)] mb-2">
                                                                    Desglose de Subfactores Técnicos — {row.factorName}
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    {row.subfactors.map((sf, sIdx) => (
                                                                        <div
                                                                            key={sf.subfactorId}
                                                                            className="p-2 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] flex items-center justify-between gap-3 text-[11px]"
                                                                        >
                                                                            <span className="text-[var(--color-text-primary)] flex-1">
                                                                                <strong className="font-mono text-[10px] text-[var(--color-text-tertiary)] mr-1.5">
                                                                                    #{sIdx + 1}
                                                                                </strong>
                                                                                {sf.description}
                                                                            </span>
                                                                            <div className="flex items-center gap-2 font-mono shrink-0">
                                                                                <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                                                                                    A: <strong>{sf.rating1 ?? '—'}</strong>
                                                                                </span>
                                                                                <span className="px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                                                                                    B: <strong>{sf.rating2 ?? '—'}</strong>
                                                                                </span>
                                                                                {sf.diff !== 0 && (
                                                                                    <span
                                                                                        className={clsx(
                                                                                            'font-bold text-[10px]',
                                                                                            sf.diff > 0 ? 'text-emerald-500' : 'text-rose-500'
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
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </Modal>
    );
};

export default PublicEvaluationCompareModal;
