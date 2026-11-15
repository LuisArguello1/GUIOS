/**
 * features/publicEvaluation/components/steps/Step3VerdictSWOT.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fase 3 (Pasos 5 y 6): Matriz FODA Consolidada, Dictamen Final (A/B/C),
 * Resumen Ejecutivo de IA, Plan de Mitigación Tabular y Exportación Oficial (PDF y Excel).
 *
 * Principio:
 * - Fila amplia superior con Dictamen Oficial.
 * - Fila amplia en tabs (Resumen Ejecutivo y Plan de Mitigación estructurado en tabla).
 * - Matriz técnica de factores ubicada abajo a todo el ancho.
 */

import React, { useMemo, useState, memo } from 'react';
import {
    Award,
    FileDown,
    FileSpreadsheet,
    Sparkles,
    ShieldCheck,
    ArrowLeft,
    Lock,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    HelpCircle,
    CheckCircle2,
    Layers,
    FileText,
    Eye,
    Share2,
    Copy,
} from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../../components/ui/Button';
import MarkdownViewer from '../MarkdownViewer';
import { MitigationPlanTable } from '../../../guios/evaluations/components/detail/MitigationPlanTable';
import RepoHealthCard from '../../../guios/evaluations/components/detail/RepoHealthCard';
import {
    classifyRecommendation,
    RECOMMENDATION_LABELS,
    type RecommendationCode,
} from '../../../../calculations/combinationMatrix';
import type { EvaluationDetail } from '../../../../api/evaluationService';

interface Step3VerdictSWOTProps {
    evaluation: EvaluationDetail;
    onEmitVerdict: () => Promise<boolean>;
    isComputing: boolean;
    onDownloadPdf: () => Promise<void>;
    onDownloadExcel: () => Promise<void>;
    downloadingFormat: 'pdf' | 'excel' | null;
    onBackToStep2?: () => void;
    onInspectFactor?: (factorId: number) => void;
    onShareEvaluation?: () => void;
    onCloneEvaluation?: () => void;
    onResetEvaluation: () => void;
    onOpenHelp: () => void;
    onSyncRepoHealth?: (customRepoUrl?: string) => Promise<void> | void;
    syncingRepoHealth?: boolean;
}

const FODA_CONFIG: Record<
    string,
    { label: string; badgeClass: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
    strength: {
        label: 'Fortaleza (Interna)',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        icon: TrendingUp,
    },
    opportunity: {
        label: 'Oportunidad (Externa)',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        icon: TrendingUp,
    },
    weakness: {
        label: 'Debilidad (Interna)',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        icon: TrendingDown,
    },
    threat: {
        label: 'Amenaza (Externa)',
        badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        icon: TrendingDown,
    },
};

export const Step3VerdictSWOT: React.FC<Step3VerdictSWOTProps> = ({
    evaluation,
    onEmitVerdict,
    isComputing,
    onDownloadPdf,
    onDownloadExcel,
    downloadingFormat,
    onBackToStep2,
    onInspectFactor,
    onShareEvaluation,
    onCloneEvaluation,
    onResetEvaluation,
    onOpenHelp,
    onSyncRepoHealth,
    syncingRepoHealth = false,
}) => {
    const verdict = evaluation.verdict;
    const hasVerdict = Boolean(verdict && verdict.calculated_at);
    const results = useMemo(() => evaluation.results || [], [evaluation.results]);
    const factors = useMemo(() => evaluation.factors || [], [evaluation.factors]);

    const factorScopeMap = useMemo(() => {
        const map = new Map<number, 'internal' | 'external'>();
        factors.forEach((f) => map.set(f.factor_id, f.scope_used));
        return map;
    }, [factors]);

    const [activeTab, setActiveTab] = useState<'executive' | 'mitigation'>('mitigation');
    const [fodaViewMode, setFodaViewMode] = useState<'matrix' | 'table'>('matrix');

    // Mapeo de factores agrupados por cuadrante FODA (2×2)
    const fodaGroups = useMemo(() => {
        const groups = {
            strength: [] as { factor_id: number; factor_name: string; pm: number }[],
            opportunity: [] as { factor_id: number; factor_name: string; pm: number }[],
            weakness: [] as { factor_id: number; factor_name: string; pm: number }[],
            threat: [] as { factor_id: number; factor_name: string; pm: number }[],
        };

        results.forEach((r) => {
            const cls = r.foda_classification as 'strength' | 'opportunity' | 'weakness' | 'threat';
            if (cls && groups[cls]) {
                const pmNum =
                    typeof r.weighted_average === 'number'
                        ? r.weighted_average
                        : parseFloat(String(r.weighted_average)) || 0;
                groups[cls].push({
                    factor_id: r.factor_id,
                    factor_name: r.factor_name,
                    pm: pmNum,
                });
            }
        });

        return groups;
    }, [results]);

    // Conteo en vivo de factores FODA
    const fodaCounts = useMemo(() => {
        let strengths = 0;
        let opportunities = 0;
        let weaknesses = 0;
        let threats = 0;

        results.forEach((r) => {
            const cls = r.foda_classification;
            if (cls === 'strength') strengths++;
            else if (cls === 'opportunity') opportunities++;
            else if (cls === 'weakness') weaknesses++;
            else if (cls === 'threat') threats++;
        });

        return { strengths, opportunities, weaknesses, threats };
    }, [results]);

    // Dictamen preliminar calculado en cliente
    const previewRecommendation = useMemo<RecommendationCode | null>(() => {
        if (hasVerdict && verdict?.recommendation) {
            return verdict.recommendation as RecommendationCode;
        }
        if (results.length === 0) return null;

        const factorMap = new Map<number, number>();
        factors.forEach((f) => {
            if (f.relative_importance !== null && f.relative_importance !== undefined) {
                factorMap.set(f.factor_id, f.relative_importance);
            }
        });

        const factorInputs = results.map((r) => ({
            meetsThreshold: r.meets_threshold,
            relativeImportance: factorMap.get(r.factor_id) ?? 1,
        }));

        return classifyRecommendation(factorInputs);
    }, [hasVerdict, verdict, results, factors]);

    return (
        <div className="h-full flex flex-col bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-sans overflow-hidden">
            {/* ── BARRA SUPERIOR FIJA (Resumen y Acciones Rápidas) ── */}
            <div
                className="bg-[var(--color-bg-elevated)] border-b border-[var(--color-border-subtle)] px-3 sm:px-4 py-2 shrink-0 flex items-center justify-between gap-2 sm:gap-3 shadow-xs"
                data-tour="phase3-header"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] shrink-0">
                        <Award size={15} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                            <span className="hidden sm:inline">Fase 3: Matriz FODA y Dictamen Final Institucional</span>
                            <span className="sm:hidden">Fase 3: Matriz FODA y Dictamen</span>
                        </h2>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono block truncate">
                            Software: <strong className="text-[var(--color-text-secondary)]">{evaluation.software_name}</strong> • {results.length} factores calificados
                        </span>
                    </div>
                </div>

                {/* Métricas rápidas y Acciones de Cabecera */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-secondary)]">
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> F: {fodaCounts.strengths}
                        </span>
                        <span className="text-[var(--color-border-subtle)]">•</span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> O: {fodaCounts.opportunities}
                        </span>
                        <span className="text-[var(--color-border-subtle)]">•</span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> D: {fodaCounts.weaknesses}
                        </span>
                        <span className="text-[var(--color-border-subtle)]">•</span>
                        <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> A: {fodaCounts.threats}
                        </span>
                    </div>

                    {!hasVerdict && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={onEmitVerdict}
                            disabled={isComputing || results.length === 0}
                            className="flex items-center gap-1.5 text-xs font-bold h-7 px-2.5 sm:px-3 shadow-xs"
                            title="Calcular dictamen final y generar resumen de mitigación"
                        >
                            <Sparkles size={12} className={isComputing ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">{isComputing ? 'Emitiendo Dictamen...' : 'Emitir Dictamen'}</span>
                            <span className="sm:hidden">{isComputing ? 'Emitiendo...' : 'Emitir'}</span>
                        </Button>
                    )}

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onOpenHelp}
                        className="flex items-center gap-1 text-xs h-7 px-2"
                        title="Ver guía metodológica de la Fase 3"
                    >
                        <HelpCircle size={12} className="text-[var(--color-primary)]" />
                        <span className="hidden md:inline">Ayuda</span>
                    </Button>
                </div>
            </div>

            {/* ── CUERPO PRINCIPAL CON SCROLL VERTICAL NATURAL (DICTAMEN -> TABS AMPLIOS -> MATRIZ FODA ABAJO) ── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-3.5 space-y-3 sm:space-y-3.5">
                {/* ── 1. TARJETA AMPLIA DE DICTAMEN OFICIAL ── */}
                <div
                    className="p-3 sm:p-4 rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs"
                    data-tour="verdict-card"
                >
                    {hasVerdict && verdict ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        Dictamen Oficial GUIOS
                                    </span>
                                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
                                        Recomendación {verdict.recommendation}
                                    </span>
                                </div>
                                <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                                    Emitido: {new Date(verdict.calculated_at).toLocaleDateString()}
                                </span>
                            </div>

                            <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">
                                {verdict.recommendation_display}
                            </h3>

                            <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-2">
                                <MarkdownViewer content={verdict.explanation_text} className="[&_p]:mb-0 [&_p]:text-inherit" />
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-[6px] border border-dashed border-[var(--color-border-strong)] text-center flex flex-col items-center justify-center gap-2 bg-[var(--color-bg-page)]">
                            <Award size={22} className="text-[var(--color-primary)]" />
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                Veredicto Pendiente
                            </span>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] max-w-md">
                                {previewRecommendation
                                    ? `Cálculo con factores registrados: Recomendación ${previewRecommendation}. ${RECOMMENDATION_LABELS[previewRecommendation]}. Emita el dictamen para fijar el texto oficial y estructurar el plan.`
                                    : 'Califique los factores relevantes antes de emitir el dictamen formal.'}
                            </p>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onEmitVerdict}
                                disabled={isComputing || results.length === 0}
                                className="h-7 px-3.5 text-xs font-bold mt-1"
                            >
                                <Sparkles size={12} className={isComputing ? 'animate-spin' : ''} />
                                <span>{isComputing ? 'Calculando...' : 'Emitir Dictamen'}</span>
                            </Button>
                        </div>
                    )}
                </div>

                {(evaluation.software_repo_url || evaluation.repo_health_metrics) && (
                    <RepoHealthCard
                        repoUrl={evaluation.software_repo_url}
                        metrics={evaluation.repo_health_metrics}
                        onSync={onSyncRepoHealth}
                        isSyncing={syncingRepoHealth}
                        allowEditUrl={evaluation.status === 'in_progress'}
                    />
                )}

                {/* ── 2. FILA AMPLIA EN TABS (RESUMEN EJECUTIVO Y PLAN DE MITIGACIÓN TABULAR) ── */}
                <div
                    className="rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs overflow-hidden"
                    data-tour="tabs-section"
                >
                    {/* Barra de Tabs */}
                    <div className="px-3 sm:px-3.5 py-2 bg-[var(--color-bg-page)] border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                            <button
                                type="button"
                                onClick={() => setActiveTab('executive')}
                                className={clsx(
                                    'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[4px] font-bold transition-all cursor-pointer text-xs',
                                    activeTab === 'executive'
                                        ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                )}
                                data-tour="executive-tab-btn"
                            >
                                <FileText size={12} />
                                <span className="hidden sm:inline">Resumen Ejecutivo</span>
                                <span className="sm:hidden">Resumen</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab('mitigation')}
                                className={clsx(
                                    'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-[4px] font-bold transition-all cursor-pointer text-xs',
                                    activeTab === 'mitigation'
                                        ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                )}
                                data-tour="mitigation-tab-btn"
                            >
                                <ShieldCheck size={12} />
                                <span className="hidden sm:inline">Plan de Mitigación</span>
                                <span className="sm:hidden">Mitigación</span>
                            </button>
                        </div>

                        <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] hidden sm:inline">
                            {activeTab === 'executive' ? 'Síntesis directiva' : 'Estructura tabular de mitigación'}
                        </span>
                    </div>

                    {/* Contenido a Ancho Completo */}
                    <div className="p-3.5 sm:p-4 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {activeTab === 'executive' && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)] pb-1.5 border-b border-[var(--color-border-subtle)]">
                                    <Sparkles size={13} className="text-[var(--color-text-secondary)]" />
                                    <span>Síntesis Orientada a la Alta Dirección</span>
                                </div>
                                {verdict?.ai_executive_summary || verdict?.explanation_text ? (
                                    <div className="bg-[var(--color-bg-page)] p-3.5 rounded-[6px] border border-[var(--color-border-subtle)]">
                                        <MarkdownViewer content={verdict.ai_executive_summary || verdict.explanation_text} />
                                    </div>
                                ) : (
                                    <div className="p-6 text-center text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-page)] rounded-[6px] border border-[var(--color-border-subtle)]">
                                        El resumen ejecutivo se generará automáticamente al emitir el dictamen final.
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'mitigation' && (
                            <MitigationPlanTable
                                evaluation={evaluation}
                                mitigationPlanText={verdict?.ai_mitigation_plan}
                                onViewFactorDetails={onInspectFactor}
                            />
                        )}
                    </div>
                </div>

                {/* ── 3. MATRIZ FODA CONSOLIDADA (2×2) ── */}
                <div
                    className="rounded-[8px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] shadow-xs overflow-hidden"
                    data-tour="foda-matrix-section"
                >
                    {/* Cabecera de la matriz */}
                    <div className="px-3 sm:px-3.5 py-2.5 bg-[var(--color-bg-page)] border-b border-[var(--color-border-subtle)] flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-[var(--color-text-secondary)]" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] font-mono">
                                <span className="hidden sm:inline">Matriz FODA Consolidada (2×2)</span>
                                <span className="sm:hidden">Matriz FODA (2×2)</span>
                            </h3>
                        </div>

                        <div className="flex items-center gap-3" data-tour="foda-view-toggle">
                            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] hidden sm:inline">
                                {results.length} factores clasificados
                            </span>

                            {/* Toggle entre Matriz 2x2 y Vista Tabla */}
                            {results.length > 0 && (
                                <div className="flex items-center gap-1 font-mono text-[10px]">
                                    <button
                                        type="button"
                                        onClick={() => setFodaViewMode('matrix')}
                                        className={clsx(
                                            'px-2 py-0.5 rounded transition-all cursor-pointer font-bold',
                                            fodaViewMode === 'matrix'
                                                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] shadow-xs'
                                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                                        )}
                                    >
                                        Matriz 2×2
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFodaViewMode('table')}
                                        className={clsx(
                                            'px-2 py-0.5 rounded transition-all cursor-pointer font-bold',
                                            fodaViewMode === 'table'
                                                ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] shadow-xs'
                                                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                                        )}
                                    >
                                        Vista Tabla
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Vista Matriz 2×2 (Por defecto) */}
                    {fodaViewMode === 'matrix' && (
                        <div className="p-3 sm:p-4">
                            {results.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--color-border-subtle)] rounded-[6px] overflow-hidden border border-[var(--color-border-subtle)]">
                                    {/* FORTALEZAS (F) */}
                                    <div className="p-3.5 bg-[var(--color-bg-surface)]">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                FORTALEZAS (F)
                                            </span>
                                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                                {fodaGroups.strength.length}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2.5">
                                            Factores Internos con PM ≥ 3.0
                                        </p>
                                        <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                                            {fodaGroups.strength.map((f) => (
                                                <button
                                                    key={f.factor_id}
                                                    type="button"
                                                    onClick={() => onInspectFactor?.(f.factor_id)}
                                                    title="Haz clic para ver los subfactores de este factor en Fase 2 (Solo lectura)"
                                                    className="w-full text-left py-1.5 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between transition-colors group select-none cursor-pointer"
                                                >
                                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] flex items-center gap-1.5">
                                                        <span className="truncate">{f.factor_name}</span>
                                                        <Eye size={11} className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] transition-opacity shrink-0" />
                                                    </span>
                                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] font-semibold shrink-0">
                                                        {f.pm.toFixed(1)}
                                                    </span>
                                                </button>
                                            ))}
                                            {fodaGroups.strength.length === 0 && (
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-4">
                                                    Sin factores en este cuadrante
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* OPORTUNIDADES (O) */}
                                    <div className="p-3.5 bg-[var(--color-bg-surface)]">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                                OPORTUNIDADES (O)
                                            </span>
                                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                                {fodaGroups.opportunity.length}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2.5">
                                            Factores Externos con PM ≥ 3.0
                                        </p>
                                        <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                                            {fodaGroups.opportunity.map((f) => (
                                                <button
                                                    key={f.factor_id}
                                                    type="button"
                                                    onClick={() => onInspectFactor?.(f.factor_id)}
                                                    title="Haz clic para ver los subfactores de este factor en Fase 2 (Solo lectura)"
                                                    className="w-full text-left py-1.5 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between transition-colors group select-none cursor-pointer"
                                                >
                                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] flex items-center gap-1.5">
                                                        <span className="truncate">{f.factor_name}</span>
                                                        <Eye size={11} className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] transition-opacity shrink-0" />
                                                    </span>
                                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] font-semibold shrink-0">
                                                        {f.pm.toFixed(1)}
                                                    </span>
                                                </button>
                                            ))}
                                            {fodaGroups.opportunity.length === 0 && (
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-4">
                                                    Sin factores en este cuadrante
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* DEBILIDADES (D) */}
                                    <div className="p-3.5 bg-[var(--color-bg-surface)]">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                                DEBILIDADES (D)
                                            </span>
                                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                                {fodaGroups.weakness.length}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2.5">
                                            Factores Internos con PM &lt; 3.0
                                        </p>
                                        <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                                            {fodaGroups.weakness.map((f) => (
                                                <button
                                                    key={f.factor_id}
                                                    type="button"
                                                    onClick={() => onInspectFactor?.(f.factor_id)}
                                                    title="Haz clic para ver los subfactores de este factor en Fase 2 (Solo lectura)"
                                                    className="w-full text-left py-1.5 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between transition-colors group select-none cursor-pointer"
                                                >
                                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] flex items-center gap-1.5">
                                                        <span className="truncate">{f.factor_name}</span>
                                                        <Eye size={11} className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] transition-opacity shrink-0" />
                                                    </span>
                                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] font-semibold shrink-0">
                                                        {f.pm.toFixed(1)}
                                                    </span>
                                                </button>
                                            ))}
                                            {fodaGroups.weakness.length === 0 && (
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-4">
                                                    Sin factores en este cuadrante
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* AMENAZAS (A) */}
                                    <div className="p-3.5 bg-[var(--color-bg-surface)]">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                                AMENAZAS (A)
                                            </span>
                                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                                {fodaGroups.threat.length}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2.5">
                                            Factores Externos con PM &lt; 3.0
                                        </p>
                                        <div className="space-y-0.5 max-h-56 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                                            {fodaGroups.threat.map((f) => (
                                                <button
                                                    key={f.factor_id}
                                                    type="button"
                                                    onClick={() => onInspectFactor?.(f.factor_id)}
                                                    title="Haz clic para ver los subfactores de este factor en Fase 2 (Solo lectura)"
                                                    className="w-full text-left py-1.5 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between transition-colors group select-none cursor-pointer"
                                                >
                                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] flex items-center gap-1.5">
                                                        <span className="truncate">{f.factor_name}</span>
                                                        <Eye size={11} className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] transition-opacity shrink-0" />
                                                    </span>
                                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] font-semibold shrink-0">
                                                        {f.pm.toFixed(1)}
                                                    </span>
                                                </button>
                                            ))}
                                            {fodaGroups.threat.length === 0 && (
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-4">
                                                    Sin factores en este cuadrante
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-[var(--color-text-tertiary)]">
                                    <Layers size={28} className="opacity-40 mx-auto mb-2" />
                                    <p>Aún no se han consolidado calificaciones para generar la matriz FODA.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vista Tabla Técnica */}
                    {fodaViewMode === 'table' && (
                        <div className="overflow-x-auto">
                            {results.length > 0 ? (
                                <table className="w-full text-left text-xs min-w-[560px]">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] text-[10px] uppercase font-bold text-[var(--color-text-secondary)] font-mono">
                                            <th className="py-2.5 px-3.5">Factor Evaluado</th>
                                            <th className="py-2.5 px-3 text-center">Ponderación Media (PM)</th>
                                            <th className="py-2.5 px-3 text-center">Cuadrante FODA</th>
                                            <th className="py-2.5 px-3.5 text-right">Diagnóstico</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border-subtle)]/60">
                                        {results.map((r, idx) => {
                                            const fodaKey = r.foda_classification || 'strength';
                                            const fodaMeta = FODA_CONFIG[fodaKey] || FODA_CONFIG.strength;
                                            const Icon = fodaMeta.icon;
                                            const pmNum =
                                                typeof r.weighted_average === 'number'
                                                    ? r.weighted_average
                                                    : parseFloat(String(r.weighted_average)) || 0;

                                            const isExternal =
                                                factorScopeMap.get(r.factor_id) === 'external' ||
                                                r.foda_classification === 'opportunity' ||
                                                r.foda_classification === 'threat';

                                            return (
                                                <tr key={r.id || idx} className="hover:bg-[var(--color-bg-page)]/40 transition-colors group">
                                                    <td className="py-2.5 px-3.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => onInspectFactor?.(r.factor_id)}
                                                            title="Haz clic para ver los subfactores de este factor en Fase 2 (Solo lectura)"
                                                            className="font-semibold text-xs text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors leading-tight text-left cursor-pointer inline-flex items-center gap-1.5"
                                                        >
                                                            <span>{r.factor_name}</span>
                                                            <Eye size={11} className="opacity-0 group-hover:opacity-100 text-[var(--color-primary)] transition-opacity shrink-0" />
                                                        </button>
                                                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono mt-0.5 block">
                                                            {isExternal ? 'Ámbito Externo' : 'Ámbito Interno'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center font-mono">
                                                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                                            {pmNum.toFixed(1)}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--color-text-tertiary)] ml-0.5">
                                                            / 4.0
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-primary)] font-medium">
                                                            <Icon size={12} className="text-[var(--color-text-secondary)] shrink-0" />
                                                            <span>{r.foda_display || fodaMeta.label}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3.5 text-right">
                                                        <span className="text-xs text-[var(--color-text-secondary)] font-normal">
                                                            {r.meets_threshold ? 'Supera umbral' : 'Punto de riesgo'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-xs text-[var(--color-text-tertiary)]">
                                    <Layers size={28} className="opacity-40 mx-auto mb-2" />
                                    <p>Aún no se han consolidado calificaciones para generar la matriz FODA.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── BARRA DE NAVEGACIÓN INFERIOR (Wizard) ── */}
            <div
                className="bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-subtle)] px-3 sm:px-4 py-2 shadow-xs shrink-0 flex items-center justify-between gap-2"
                data-tour="export-actions"
            >
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {onBackToStep2 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onBackToStep2}
                            className="flex items-center gap-1 text-xs h-8 px-2 sm:px-2.5 shrink-0"
                            title="Consultar las calificaciones de la Fase 2 en modo de solo lectura"
                        >
                            <ArrowLeft size={13} />
                            <span className="hidden sm:inline">Ver Fase 2</span>
                            <span className="sm:hidden">Fase 2</span>
                        </Button>
                    )}
                    <div
                        className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)] shrink-0"
                        title="Una vez en la Fase 3, los datos de los Pasos 1 y 2 están consolidados y solo se pueden consultar en modo lectura"
                    >
                        <Lock size={12} className="text-[var(--color-primary)] shrink-0" />
                        <span>Pasos 1 y 2 en solo lectura</span>
                    </div>
                </div>

                {/* Centro: Estado de la Evaluación */}
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                    {hasVerdict ? (
                        <span className="flex items-center gap-1.5 text-[var(--color-primary)] font-medium text-xs bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] px-2.5 py-0.5 rounded">
                            <CheckCircle2 size={13} /> Evaluación Oficial Completada
                        </span>
                    ) : (
                        <span>{results.length} factores listos para dictamen</span>
                    )}
                </div>

                {/* Acciones de Exportación, Enlace Compartible y Nueva Evaluación */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {onCloneEvaluation && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onCloneEvaluation}
                            className="flex items-center gap-1.5 text-xs h-8 px-2 sm:px-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            title="Re-evaluar o evaluar nueva versión precargando los datos de este software y organización"
                        >
                            <Copy size={12} />
                            <span className="hidden xl:inline">Re-evaluar</span>
                        </Button>
                    )}

                    {onShareEvaluation && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onShareEvaluation}
                            className="flex items-center gap-1.5 text-xs h-8 px-2 sm:px-2.5 font-semibold text-[var(--color-text-primary)]"
                            title="Copiar enlace directo a esta evaluación para compartir o abrir en otro dispositivo"
                        >
                            <Share2 size={13} className="text-[var(--color-primary)]" />
                            <span className="hidden md:inline">Compartir</span>
                        </Button>
                    )}

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onDownloadPdf}
                        disabled={Boolean(downloadingFormat)}
                        className="flex items-center gap-1.5 text-xs h-8 px-2 sm:px-2.5 font-semibold text-[var(--color-text-primary)]"
                        title="Descargar informe oficial en formato PDF"
                    >
                        <FileDown size={13} className="text-[var(--color-primary)]" />
                        <span className="hidden sm:inline">
                            {downloadingFormat === 'pdf' ? 'Generando PDF...' : 'Dossier PDF'}
                        </span>
                        <span className="sm:hidden">
                            {downloadingFormat === 'pdf' ? 'PDF...' : 'PDF'}
                        </span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onDownloadExcel}
                        disabled={Boolean(downloadingFormat)}
                        className="flex items-center gap-1.5 text-xs h-8 px-2 sm:px-2.5 font-semibold text-[var(--color-text-primary)]"
                        title="Descargar matriz completa en formato Excel"
                    >
                        <FileSpreadsheet size={13} className="text-emerald-500" />
                        <span className="hidden sm:inline">
                            {downloadingFormat === 'excel' ? 'Generando Excel...' : 'Excel'}
                        </span>
                        <span className="sm:hidden">
                            {downloadingFormat === 'excel' ? 'XLSX...' : 'Excel'}
                        </span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onResetEvaluation}
                        className="flex items-center gap-1 text-xs h-8 px-2 sm:px-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        title="Comenzar una nueva evaluación de software"
                    >
                        <RefreshCw size={12} />
                        <span className="hidden md:inline">Nueva</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default memo(Step3VerdictSWOT);
