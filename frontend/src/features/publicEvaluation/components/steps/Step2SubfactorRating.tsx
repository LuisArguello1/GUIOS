/**
 * features/publicEvaluation/components/steps/Step2SubfactorRating.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fase 2 (Pasos 3 y 4): Calificación de Subfactores de Factores Relevantes.
 * Cumple con RF-PUB-04, US-10, RN-01 (solo relevantes) y RN-02 (PM válida si completa).
 *
 * Diseño adaptado al viewport (100% altura, sin scroll de página) con selector
 * directo por botones de calificación (sin sliders), botón ÚNICO de guardado manual
 * con validaciones bidireccionales (avisa si no hay cambios o si intenta salir sin guardar).
 */

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import {
    CheckSquare,
    HelpCircle,
    ArrowRight,
    ArrowLeft,
    Clock,
    Layers,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Save,
    Sparkles,
    Lock,
} from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../../components/ui/Button';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import RepoHealthCard from '../../../guios/evaluations/components/detail/RepoHealthCard';
import AISuggestSelector from '../ui/AISuggestSelector';
import useToastStore from '../../../../app/useToastStore';
import type {
    EvaluationDetail,
    EvaluationFactorItem,
    EvaluationSubfactorItem,
} from '../../../../api/evaluationService';
import type { LocalSubfactorRatingState } from '../../hooks/usePublicEvaluation';

interface Step2SubfactorRatingProps {
    evaluation: EvaluationDetail;
    relevantFactors: EvaluationFactorItem[];
    activeFactorId: number | null;
    onSelectActiveFactor: (factorId: number) => void;
    activeSubfactors: EvaluationSubfactorItem[];
    subfactorRatingsMap: Record<number, LocalSubfactorRatingState>;
    onRatingChange: (subfactorId: number, rating: number) => void;
    getFactorLocalPM: (factorId: number) => { average: number; isComplete: boolean; foda: string };
    onAISuggestFactorRatings?: (factorId: number) => void;
    onAISuggestAllFactorRatings?: (factorIds: number[]) => void;
    onAISuggestSingleRating?: (subfactorId: number) => void;
    aiLoadingSubfactors?: Record<number, boolean>;
    onSaveRatings: () => Promise<boolean>;
    isComputing: boolean;
    hasUnsavedChanges: boolean;
    unsavedChangesCount: number;
    onBackToStep1: () => void;
    onContinueToStep3: () => void;
    onOpenHelp: () => void;
    isReadOnly?: boolean;
    onSyncRepoHealth?: (customRepoUrl?: string) => Promise<void> | void;
    syncingRepoHealth?: boolean;
}

const SUBFACTOR_RATING_OPTIONS = [
    {
        value: 1,
        label: '1 • No cumple',
        shortLabel: '1 • No cumple',
        title: 'El software carece o no satisface este requerimiento técnico',
        activeClass:
            'bg-[var(--color-bg-elevated)] border-[var(--color-primary)] text-[var(--color-text-primary)] font-semibold shadow-xs ring-1 ring-[var(--color-primary)]/25',
        dotClass: 'bg-[var(--color-primary)] border-[var(--color-primary)]',
    },
    {
        value: 2,
        label: '2 • Desconozco',
        shortLabel: '2 • Desconozco',
        title: 'Sin evidencia suficiente o verificación pendiente',
        activeClass:
            'bg-[var(--color-bg-elevated)] border-[var(--color-primary)] text-[var(--color-text-primary)] font-semibold shadow-xs ring-1 ring-[var(--color-primary)]/25',
        dotClass: 'bg-[var(--color-primary)] border-[var(--color-primary)]',
    },
    {
        value: 3,
        label: '3 • Parcial',
        shortLabel: '3 • Parcial',
        title: 'Cumplimiento incompleto, básico o condicionado',
        activeClass:
            'bg-[var(--color-bg-elevated)] border-[var(--color-primary)] text-[var(--color-text-primary)] font-semibold shadow-xs ring-1 ring-[var(--color-primary)]/25',
        dotClass: 'bg-[var(--color-primary)] border-[var(--color-primary)]',
    },
    {
        value: 4,
        label: '4 • Satisfactorio',
        shortLabel: '4 • Satisfactorio',
        title: 'Cumple plenamente con el estándar técnico exigido',
        activeClass:
            'bg-[var(--color-bg-elevated)] border-[var(--color-primary)] text-[var(--color-text-primary)] font-semibold shadow-xs ring-1 ring-[var(--color-primary)]/25',
        dotClass: 'bg-[var(--color-primary)] border-[var(--color-primary)]',
    },
];

export const Step2SubfactorRating: React.FC<Step2SubfactorRatingProps> = ({
    evaluation,
    relevantFactors,
    activeFactorId,
    onSelectActiveFactor,
    activeSubfactors,
    subfactorRatingsMap,
    onRatingChange,
    getFactorLocalPM,
    onAISuggestFactorRatings,
    onAISuggestAllFactorRatings,
    onAISuggestSingleRating,
    aiLoadingSubfactors,
    onSaveRatings,
    isComputing,
    hasUnsavedChanges,
    unsavedChangesCount,
    onBackToStep1,
    onContinueToStep3,
    onOpenHelp,
    isReadOnly = false,
    onSyncRepoHealth,
    syncingRepoHealth = false,
}) => {
    const { addToast } = useToastStore();

    // ── Vista activa en Móvil / Tablet (< lg): 'criteria' (calificar factor activo) o 'factors' (lista de factores relevantes) ──
    const [mobileView, setMobileView] = useState<'criteria' | 'factors'>('criteria');
    const [isLeaveConfirmModalOpen, setIsLeaveConfirmModalOpen] = useState<boolean>(false);
    const [aiSuggestScope, setAiSuggestScope] = useState<'factor' | 'all'>('factor');

    // Factor activo actual
    const currentActiveFactor = useMemo(() => {
        return relevantFactors.find((f) => f.factor_id === activeFactorId) || relevantFactors[0];
    }, [relevantFactors, activeFactorId]);

    // Resumen de factores completados vs pendientes
    const progressSummary = useMemo(() => {
        let completedFactors = 0;
        relevantFactors.forEach((f) => {
            const pmData = getFactorLocalPM(f.factor_id);
            if (pmData.isComplete) completedFactors++;
        });
        return {
            completedFactors,
            totalFactors: relevantFactors.length,
            percentage:
                relevantFactors.length > 0
                    ? Math.round((completedFactors / relevantFactors.length) * 100)
                    : 0,
            allDone: completedFactors === relevantFactors.length && relevantFactors.length > 0,
        };
    }, [relevantFactors, getFactorLocalPM]);

    const activePM = currentActiveFactor ? getFactorLocalPM(currentActiveFactor.factor_id) : null;

    // Comprobar si el factor activo tiene cambios sin guardar
    const factorSuggestionsReady = activeSubfactors.length > 0 && activeSubfactors.every((sf) => (
        Boolean(subfactorRatingsMap[sf.subfactor_id]?.ai_justification || sf.ai_rating_justification)
    ));

    const activePendingSubfactorsCount = useMemo(
        () =>
            activeSubfactors.filter(
                (sf) => !(subfactorRatingsMap[sf.subfactor_id]?.ai_justification || sf.ai_rating_justification)
            ).length,
        [activeSubfactors, subfactorRatingsMap]
    );

    const pendingRelevantFactorIds = useMemo(
        () =>
            relevantFactors
                .filter((factor) => {
                    const subs = (evaluation.subfactors || []).filter((sf) => sf.factor_id === factor.factor_id);
                    return subs.some(
                        (sf) => !(subfactorRatingsMap[sf.subfactor_id]?.ai_justification || sf.ai_rating_justification)
                    );
                })
                .map((factor) => factor.factor_id),
        [relevantFactors, evaluation.subfactors, subfactorRatingsMap]
    );

    const aiScopeOptions = useMemo(
        () => [
            {
                value: 'factor',
                label: 'Subfactores del factor',
                pendingCount: activePendingSubfactorsCount,
            },
            {
                value: 'all',
                label: 'Todos los factores',
                pendingCount: pendingRelevantFactorIds.length,
            },
        ],
        [activePendingSubfactorsCount, pendingRelevantFactorIds.length]
    );

    const isAnySubfactorLoading = useMemo(
        () => Object.values(aiLoadingSubfactors || {}).some(Boolean),
        [aiLoadingSubfactors]
    );

    const handleRunStep2AISuggest = useCallback(() => {
        if (aiSuggestScope === 'factor') {
            if (currentActiveFactor && onAISuggestFactorRatings) {
                onAISuggestFactorRatings(currentActiveFactor.factor_id);
            }
            return;
        }
        onAISuggestAllFactorRatings?.(pendingRelevantFactorIds);
    }, [
        aiSuggestScope,
        currentActiveFactor,
        onAISuggestFactorRatings,
        onAISuggestAllFactorRatings,
        pendingRelevantFactorIds,
    ]);

    const hasUnsavedChangesInCurrentFactor = useMemo(() => {
        return activeSubfactors.some((sf) => subfactorRatingsMap[sf.subfactor_id]?.is_modified);
    }, [activeSubfactors, subfactorRatingsMap]);

    const activeFactorUsesAISuggestion = useMemo(() => {
        if (!currentActiveFactor) return false;
        const factorSubfactors = (evaluation.subfactors || []).filter(
            (sf) => sf.factor_id === currentActiveFactor.factor_id
        );
        const hasAISuggestions = factorSubfactors.length > 0 && factorSubfactors.some((sf) => {
            const local = subfactorRatingsMap[sf.subfactor_id];
            return Boolean(local?.ai_suggested ?? sf.ai_suggested_rating);
        });
        return hasAISuggestions && factorSubfactors.some((sf) => {
            const local = subfactorRatingsMap[sf.subfactor_id];
            const aiSug = local?.ai_suggested ?? sf.ai_suggested_rating;
            const rating = local ? local.rating : sf.rating;
            return Boolean(aiSug && rating !== null && rating !== undefined && rating === aiSug);
        });
    }, [currentActiveFactor, evaluation.subfactors, subfactorRatingsMap]);

    // Índices para navegación Anterior / Siguiente entre factores relevantes
    const currentFactorIndex = useMemo(() => {
        if (!currentActiveFactor) return -1;
        return relevantFactors.findIndex((f) => f.factor_id === currentActiveFactor.factor_id);
    }, [relevantFactors, currentActiveFactor]);

    const hasPrevFactor = currentFactorIndex > 0;
    const hasNextFactor = currentFactorIndex >= 0 && currentFactorIndex < relevantFactors.length - 1;

    const handlePrevFactor = useCallback(() => {
        if (hasPrevFactor) {
            onSelectActiveFactor(relevantFactors[currentFactorIndex - 1].factor_id);
        }
    }, [hasPrevFactor, onSelectActiveFactor, relevantFactors, currentFactorIndex]);

    const handleNextFactor = useCallback(() => {
        if (hasNextFactor) {
            onSelectActiveFactor(relevantFactors[currentFactorIndex + 1].factor_id);
        }
    }, [hasNextFactor, onSelectActiveFactor, relevantFactors, currentFactorIndex]);

    // Atajos de teclado: ← y → para navegar entre factores relevantes
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isLeaveConfirmModalOpen) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'ArrowLeft' && hasPrevFactor) {
                e.preventDefault();
                handlePrevFactor();
            } else if (e.key === 'ArrowRight' && hasNextFactor) {
                e.preventDefault();
                handleNextFactor();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isLeaveConfirmModalOpen, hasPrevFactor, hasNextFactor, handlePrevFactor, handleNextFactor]);

    // ── Validaciones de Guardado Manual ──
    const handleManualSave = async () => {
        if (!hasUnsavedChanges) {
            addToast({
                type: 'info',
                message: 'No has realizado cambios en las calificaciones para guardar.',
            });
            return;
        }
        await onSaveRatings();
    };

    const handleContinueClick = () => {
        if (hasUnsavedChanges) {
            addToast({
                type: 'warning',
                message: `Tienes ${unsavedChangesCount} calificación(es) sin guardar. Presiona "Guardar Calificaciones" antes de avanzar a la Fase 3.`,
            });
            return;
        }
        onContinueToStep3();
    };

    const handleBackClick = () => {
        if (!isReadOnly && hasUnsavedChanges) {
            setIsLeaveConfirmModalOpen(true);
            return;
        }
        onBackToStep1();
    };

    const handleSaveAndBack = async () => {
        const saved = await onSaveRatings();
        if (saved) {
            setIsLeaveConfirmModalOpen(false);
            onBackToStep1();
        }
    };

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col animate-fadeIn gap-2 overflow-hidden">
            {/* ── BARRA SUPERIOR: Encabezado y Métricas de la Fase 2 ── */}
            <div
                className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] px-3 py-1.5 shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                data-tour="phase2-header"
            >
                <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] shrink-0 shadow-xs">
                        <CheckSquare size={16} />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-xs sm:text-sm font-black text-[var(--color-text-primary)] leading-tight truncate">
                            Fase 2: Calificación de Subfactores y Ponderación Media (PM)
                        </h2>
                        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                            Software: <strong className="text-[var(--color-text-primary)] font-mono">{evaluation.software_name}</strong> • {relevantFactors.length} factores relevantes (RN-01). Umbral: <strong className="text-[var(--color-primary)] font-mono">PM ≥ 3.0</strong>.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Contador y barra de progreso */}
                    <div className="flex items-center gap-2 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] px-2.5 py-1 rounded-[5px]">
                        <div className="text-right">
                            <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
                                {progressSummary.completedFactors} / {progressSummary.totalFactors}
                            </span>
                        </div>
                        <div className="w-16 bg-[var(--color-border-subtle)] h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-[var(--color-primary)] h-full transition-all duration-300"
                                style={{ width: `${progressSummary.percentage}%` }}
                            />
                        </div>
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onOpenHelp}
                        className="flex items-center gap-1 text-xs h-7 px-2"
                        title="Ver guía metodológica de la Fase 2"
                    >
                        <HelpCircle size={12} className="text-[var(--color-primary)]" />
                        <span className="hidden md:inline">Ayuda</span>
                    </Button>
                </div>
            </div>

            {(evaluation.software_repo_url || evaluation.repo_health_metrics) && (
                <div className="shrink-0">
                    <RepoHealthCard
                        repoUrl={evaluation.software_repo_url}
                        metrics={evaluation.repo_health_metrics}
                        onSync={onSyncRepoHealth}
                        isSyncing={syncingRepoHealth}
                        allowEditUrl={!isReadOnly}
                        compact
                    />
                </div>
            )}

            {/* ── Selector Móvil: Calificar Factor Activo vs Lista de Factores (< lg) ── */}
            <div className="flex lg:hidden items-center bg-[var(--color-bg-elevated)] p-1 rounded-[8px] border border-[var(--color-border-subtle)] shrink-0 shadow-xs">
                <button
                    type="button"
                    onClick={() => setMobileView('criteria')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer select-none',
                        mobileView === 'criteria'
                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                >
                    <CheckSquare size={13} className="shrink-0" />
                    <span className="truncate">Calificar (#{currentFactorIndex + 1}/{relevantFactors.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setMobileView('factors')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer select-none',
                        mobileView === 'factors'
                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                >
                    <Layers size={13} className="shrink-0" />
                    <span>Factores ({relevantFactors.length})</span>
                </button>
            </div>

            {/* ── CUERPO PRINCIPAL: 2 Columnas (Selector Lateral + Criterios del Factor) ── */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2 overflow-hidden">
                {/* ── COLUMNA 1: Selector de Factores Relevantes (4 cols) ── */}
                <div
                    className={clsx(
                        'lg:col-span-4 h-full min-h-0 flex-col bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-[8px] overflow-hidden',
                        mobileView === 'factors' ? 'flex flex-1' : 'hidden lg:flex'
                    )}
                    data-tour="relevant-factors-list"
                >
                    {/* Cabecera de la columna */}
                    <div className="shrink-0 px-3 py-2 bg-[var(--color-bg-page)] border-b border-[var(--color-border-default)] flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Layers size={14} className="text-[var(--color-primary)]" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-primary)]">
                                Factores Relevantes
                            </h3>
                            <button
                                type="button"
                                onClick={() => setMobileView('criteria')}
                                className="lg:hidden text-[10px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer ml-1"
                            >
                                → Ver activo
                            </button>
                        </div>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                            {relevantFactors.length} en total
                        </span>
                    </div>

                    {/* Lista con scroll interior */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
                        {relevantFactors.map((factor, idx) => {
                            const isSelected = factor.factor_id === activeFactorId;
                            const pmData = getFactorLocalPM(factor.factor_id);
                            const factorSubfactors = (evaluation.subfactors || []).filter(
                                (sf) => sf.factor_id === factor.factor_id
                            );
                            const factorHasUnsaved = factorSubfactors.some(
                                (sf) => subfactorRatingsMap[sf.subfactor_id]?.is_modified
                            );
                            const factorHasAISuggestions =
                                factorSubfactors.length > 0 &&
                                factorSubfactors.some((sf) => {
                                    const local = subfactorRatingsMap[sf.subfactor_id];
                                    return Boolean(local?.ai_suggested ?? sf.ai_suggested_rating);
                                });
                            const factorUsesAISuggestion =
                                factorHasAISuggestions &&
                                factorSubfactors.some((sf) => {
                                    const local = subfactorRatingsMap[sf.subfactor_id];
                                    const aiSug = local?.ai_suggested ?? sf.ai_suggested_rating;
                                    const rating = local ? local.rating : sf.rating;
                                    return Boolean(aiSug && rating !== null && rating !== undefined && rating === aiSug);
                                });

                            return (
                                <button
                                    key={factor.factor_id}
                                    type="button"
                                    onClick={() => {
                                        onSelectActiveFactor(factor.factor_id);
                                        setMobileView('criteria');
                                    }}
                                    className={clsx(
                                        'w-full text-left p-2 rounded-[6px] border transition-all text-xs flex items-center justify-between gap-2 cursor-pointer',
                                        isSelected
                                            ? 'bg-[var(--color-bg-elevated)] border-[var(--color-border-strong)] border-l-2 border-l-[var(--color-primary)] text-[var(--color-text-primary)] font-semibold shadow-xs'
                                            : 'bg-[var(--color-bg-page)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                                    )}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] shrink-0">
                                                #{idx + 1}
                                            </span>
                                            <span className="truncate font-medium text-xs leading-tight">
                                                {factor.factor_name}
                                            </span>
                                            {factorUsesAISuggestion && (
                                                <span title="Sugerencia de IA aplicada en subfactores" className="inline-flex shrink-0">
                                                    <Sparkles size={11} className="text-amber-400 shrink-0 inline" />
                                                </span>
                                            )}
                                            {factorHasUnsaved && (
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                                                    title="Este factor tiene cambios sin guardar"
                                                />
                                            )}
                                        </div>
                                        <span className="text-[10px] opacity-70 font-mono block truncate pl-4">
                                            {factor.dimension_name}
                                        </span>
                                    </div>

                                    {/* Indicador de PM o Pendiente */}
                                    <div className="shrink-0 text-right">
                                        {pmData.isComplete ? (
                                            <span
                                                className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] inline-flex items-center gap-1"
                                                title={`Ponderación Media: ${pmData.average.toFixed(1)} (${pmData.foda})`}
                                            >
                                                <span>PM: {pmData.average.toFixed(1)}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-mono text-[var(--color-text-tertiary)] flex items-center gap-1 px-1 py-0.5">
                                                <Clock size={10} />
                                                <span>Pendiente</span>
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── COLUMNA 2: Criterios y Afirmaciones del Factor Activo (8 cols) ── */}
                <div
                    className={clsx(
                        'lg:col-span-8 h-full min-h-0 flex-col bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-[8px] overflow-hidden',
                        mobileView === 'criteria' ? 'flex flex-1' : 'hidden lg:flex'
                    )}
                >
                    {currentActiveFactor ? (
                        <>
                            {/* Cabecera del Factor Activo */}
                            <div
                                className="shrink-0 px-2.5 sm:px-3 py-2 bg-[var(--color-bg-page)] border-b border-[var(--color-border-default)] flex flex-wrap items-center justify-between gap-1.5 sm:gap-2"
                                data-tour="factor-active-header"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                        <h3 className="text-xs sm:text-sm font-black text-[var(--color-text-primary)] truncate flex items-center gap-1.5">
                                            <span>{currentActiveFactor.factor_name}</span>
                                            {activeFactorUsesAISuggestion && (
                                                <span title="Sugerencia de IA aplicada en subfactores" className="inline-flex shrink-0">
                                                    <Sparkles size={12} className="text-amber-400 shrink-0" />
                                                </span>
                                            )}
                                        </h3>
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[4px] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] shrink-0">
                                            {currentActiveFactor.dimension_name}
                                        </span>
                                        {/* Botón en móvil para saltar a la lista de factores */}
                                        <button
                                            type="button"
                                            onClick={() => setMobileView('factors')}
                                            className="lg:hidden text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/25 hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer shrink-0"
                                            title="Ver lista de factores relevantes"
                                        >
                                            #{currentFactorIndex + 1}/{relevantFactors.length} en lista
                                        </button>
                                    </div>
                                    <p className="text-[10px] sm:text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate">
                                        {activeSubfactors.length} afirmaciones técnicas verificables a evaluar
                                    </p>
                                </div>

                                {/* Diagnóstico PM en Vivo y Estado de Cambios */}
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    {!isReadOnly && evaluation.ai_enabled && (onAISuggestFactorRatings || onAISuggestAllFactorRatings) && (
                                        <AISuggestSelector
                                            options={aiScopeOptions}
                                            selectedScope={aiSuggestScope}
                                            onScopeChange={(scope) => setAiSuggestScope(scope as 'factor' | 'all')}
                                            onRun={handleRunStep2AISuggest}
                                            isLoading={isAnySubfactorLoading}
                                            disabled={isComputing}
                                            allReadyForScope={
                                                aiSuggestScope === 'factor'
                                                    ? factorSuggestionsReady
                                                    : pendingRelevantFactorIds.length === 0
                                            }
                                            ariaLabel="Modo de sugerencia IA en Fase 2"
                                        />
                                    )}
                                    {activePM && activePM.isComplete ? (
                                        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] shadow-xs">
                                            <span className="font-mono text-xs font-bold">
                                                PM = {activePM.average.toFixed(1)} <span className="text-[10px] text-[var(--color-text-tertiary)] font-normal">/ 4.0</span>
                                            </span>
                                            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] uppercase">
                                                {activePM.foda}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] font-mono text-[var(--color-text-tertiary)] bg-[var(--color-bg-elevated)] px-2 sm:px-2.5 py-1 rounded-[5px] border border-[var(--color-border-subtle)] flex items-center gap-1.5">
                                            <Clock size={11} />
                                            <span>Pendiente</span>
                                        </div>
                                    )}

                                    {/* Estado de cambios del factor actual */}
                                    <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] text-[10px] font-mono shrink-0 shadow-xs">
                                        {isReadOnly ? (
                                            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)] font-medium">
                                                <Lock size={11} className="text-[var(--color-primary)] shrink-0" />
                                                <span className="hidden sm:inline">Consolidado (Solo lectura)</span>
                                                <span className="sm:hidden">Fijo</span>
                                            </span>
                                        ) : hasUnsavedChangesInCurrentFactor ? (
                                            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)] font-medium">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                <span className="hidden sm:inline">Cambios pendientes</span>
                                                <span className="sm:hidden">Modificado</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)] font-medium">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                                                <span className="hidden sm:inline">Calificaciones al día</span>
                                                <span className="sm:hidden">Al día</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Listado de Criterios en 2 Columnas Minimalistas */}
                            <div
                                className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-2.5 lg:p-3"
                                data-tour="criteria-list"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 sm:gap-2.5 content-start">
                                    {activeSubfactors.map((subfactor, index) => {
                                        const local = subfactorRatingsMap[subfactor.subfactor_id] || {
                                            rating: subfactor.rating ?? null,
                                            is_modified: false,
                                            ai_suggested: subfactor.ai_suggested_rating || undefined,
                                            ai_justification: subfactor.ai_rating_justification || undefined,
                                        };
                                        const showsSuggestion = Boolean(local.ai_justification);

                                        return (
                                            <div
                                                key={subfactor.subfactor_id}
                                                className={clsx(
                                                    'p-2.5 sm:p-3 bg-[var(--color-bg-page)] border rounded-[8px] flex flex-col justify-between gap-2 sm:gap-2.5 transition-all',
                                                    local.is_modified
                                                        ? 'border-[var(--color-border-strong)] shadow-xs'
                                                        : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                                )}
                                            >
                                                {/* Afirmación técnica */}
                                                <div className="flex items-start gap-2">
                                                    <span className="font-mono text-[10px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] px-1.5 py-0.5 rounded mt-0.5 shrink-0 select-none">
                                                        #{index + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium text-[var(--color-text-primary)] leading-snug">
                                                            {subfactor.description_snapshot}
                                                        </p>
                                                        {showsSuggestion && (
                                                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed break-words">
                                                                <span className="ai-platinum-text">
                                                                    Sugerencia IA{local.ai_suggested ? ` (opción ${local.ai_suggested})` : ''}: {local.ai_justification}
                                                                </span>
                                                                {!isReadOnly && local.ai_suggested && local.rating !== local.ai_suggested && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onRatingChange(subfactor.subfactor_id, local.ai_suggested!)}
                                                                        className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] border border-amber-400/50 bg-amber-500/10 text-[10px] font-semibold text-amber-500 hover:bg-amber-500/20 cursor-pointer transition-colors"
                                                                    >
                                                                        Confirmar {local.ai_suggested}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {!isReadOnly && evaluation.ai_enabled && onAISuggestSingleRating && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onAISuggestSingleRating(subfactor.subfactor_id)}
                                                                disabled={
                                                                    isComputing
                                                                    || Boolean(aiLoadingSubfactors?.[subfactor.subfactor_id])
                                                                    || showsSuggestion
                                                                }
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[9px] font-bold text-[var(--color-text-secondary)] hover:border-amber-400/60 hover:text-[var(--color-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                                                title={
                                                                    showsSuggestion
                                                                        ? 'Este subfactor ya tiene sugerencia de IA'
                                                                        : 'Sugerir calificación con IA solo para este subfactor'
                                                                }
                                                            >
                                                                <Sparkles
                                                                    size={10}
                                                                    className={clsx(
                                                                        'text-amber-400 shrink-0',
                                                                        aiLoadingSubfactors?.[subfactor.subfactor_id] ? 'animate-spin' : ''
                                                                    )}
                                                                />
                                                                <span>{showsSuggestion ? 'IA ✓' : 'IA'}</span>
                                                            </button>
                                                        )}
                                                        {local.is_modified && (
                                                            <span
                                                                className="text-[9px] font-mono font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded border border-[var(--color-border-subtle)] shrink-0 flex items-center gap-1"
                                                                title="Calificación modificada pendiente de guardar"
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                <span>Pendiente</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Selector Directo de Calificación (1 a 4) */}
                                                <div
                                                    className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5"
                                                    data-tour={index === 0 ? 'rating-selector' : undefined}
                                                >
                                                    {SUBFACTOR_RATING_OPTIONS.map((opt) => {
                                                        const isOptionActive = local.rating === opt.value;
                                                        const isAiSuggestedOption = !isOptionActive && local.ai_suggested === opt.value;

                                                        return (
                                                            <button
                                                                key={opt.value}
                                                                type="button"
                                                                disabled={isReadOnly}
                                                                onClick={() => !isReadOnly && onRatingChange(subfactor.subfactor_id, opt.value)}
                                                                className={clsx(
                                                                    'flex items-center justify-center gap-1.5 px-1.5 sm:px-2 py-1.5 rounded-[5px] border text-xs transition-all select-none min-w-0 min-h-[36px]',
                                                                    isReadOnly ? 'cursor-default' : 'cursor-pointer',
                                                                    isOptionActive
                                                                        ? opt.activeClass
                                                                        : isAiSuggestedOption
                                                                        ? 'bg-[var(--color-bg-elevated)] border-amber-400/70 border-dashed text-[var(--color-text-primary)] hover:border-amber-400'
                                                                        : isReadOnly
                                                                        ? 'bg-[var(--color-bg-elevated)]/60 border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] opacity-75'
                                                                        : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]'
                                                                )}
                                                                title={isReadOnly ? `${opt.title} (Modo solo lectura)` : opt.title}
                                                            >
                                                                <span
                                                                    className={clsx(
                                                                        'w-1.5 h-1.5 rounded-full border transition-all shrink-0',
                                                                        isOptionActive ? opt.dotClass : 'border-[var(--color-border-strong)]'
                                                                    )}
                                                                />
                                                                <span className="truncate text-[10px] sm:text-[11px] font-medium leading-none">
                                                                    {opt.shortLabel}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Barra de Navegación Rápida entre Factores */}
                            <div className="shrink-0 px-2.5 sm:px-3 py-1.5 bg-[var(--color-bg-page)] border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrevFactor}
                                    disabled={!hasPrevFactor}
                                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                >
                                    <ChevronLeft size={14} />
                                    <span className="hidden sm:inline">Factor Anterior</span>
                                    <span className="sm:hidden">Anterior</span>
                                </button>

                                <span className="text-[10px] font-mono font-medium text-[var(--color-text-tertiary)] flex items-center gap-2">
                                    <span>Factor {currentFactorIndex + 1} de {relevantFactors.length}</span>
                                    <span className="hidden xl:inline text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                                        Teclas: ← →
                                    </span>
                                </span>

                                <button
                                    type="button"
                                    onClick={handleNextFactor}
                                    disabled={!hasNextFactor}
                                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                >
                                    <span className="hidden sm:inline">Siguiente Factor</span>
                                    <span className="sm:hidden">Siguiente</span>
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[var(--color-bg-elevated)]">
                            <Layers size={32} className="text-[var(--color-text-tertiary)] mb-2" />
                            <p className="text-xs text-[var(--color-text-secondary)]">
                                Seleccione un factor de la columna izquierda para comenzar su calificación técnica.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BARRA DE NAVEGACIÓN INFERIOR (Wizard) con BOTÓN ÚNICO DE GUARDADO ── */}
            <div
                className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] px-2.5 sm:px-3 py-1.5 shadow-xs shrink-0 flex items-center justify-between gap-1.5 sm:gap-2"
                data-tour="phase2-actions"
            >
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleBackClick}
                    className="flex items-center gap-1 text-xs h-7.5 sm:h-8 px-2 sm:px-3 shrink-0"
                >
                    <ArrowLeft size={13} />
                    <span className="hidden sm:inline">Volver a Fase 1</span>
                    <span className="sm:hidden">Fase 1</span>
                </Button>

                <div className="hidden md:flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <span>Evaluados:</span>
                    <strong className="text-[var(--color-text-primary)] font-mono font-bold">
                        {progressSummary.completedFactors} de {progressSummary.totalFactors} factores
                    </strong>
                    {progressSummary.allDone && (
                        <span className="flex items-center gap-1.5 text-[var(--color-primary)] font-medium text-[11px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] px-2 py-0.5 rounded">
                            <CheckCircle2 size={12} /> Listos para Fase 3
                        </span>
                    )}
                </div>

                {/* Acciones Derechas: Botón Único de Guardar + Continuar */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {isReadOnly ? (
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)] shrink-0"
                            title="Las calificaciones del Paso 2 están consolidadas y no se pueden modificar tras pasar a la Fase 3"
                        >
                            <Lock size={12} className="text-[var(--color-primary)] shrink-0" />
                            <span className="hidden sm:inline">Modo solo lectura (Datos consolidados)</span>
                            <span className="sm:hidden">Solo lectura</span>
                        </div>
                    ) : (
                        /* ── BOTÓN ÚNICO DE GUARDADO MANUAL (RF-PUB-04) ── */
                        <Button
                            variant={hasUnsavedChanges ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={handleManualSave}
                            disabled={isComputing}
                            className="flex items-center gap-1 sm:gap-1.5 text-xs font-semibold h-7.5 sm:h-8 px-2 sm:px-3 shadow-xs"
                            data-tour="save-ratings-action"
                            title={
                                hasUnsavedChanges
                                    ? `Guardar ${unsavedChangesCount} cambio(s) pendiente(s)`
                                    : 'No hay cambios pendientes por guardar'
                            }
                        >
                            <Save size={13} />
                            <span className="hidden sm:inline">Guardar Calificaciones</span>
                            <span className="sm:hidden">Guardar</span>
                            {hasUnsavedChanges && (
                                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-current/15 text-inherit font-bold">
                                    {unsavedChangesCount}
                                </span>
                            )}
                        </Button>
                    )}

                    {/* Botón para avanzar o volver a la Fase 3 */}
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={isReadOnly ? onContinueToStep3 : handleContinueClick}
                        disabled={!isReadOnly && (isComputing || progressSummary.completedFactors === 0)}
                        className="flex items-center gap-1 text-xs font-bold h-7.5 sm:h-8 px-2.5 sm:px-3 shadow-xs"
                    >
                        <span className="hidden sm:inline">
                            {isReadOnly ? 'Volver a Fase 3' : 'Continuar a Fase 3'}
                        </span>
                        <span className="sm:hidden">Fase 3</span>
                        <ArrowRight size={13} />
                    </Button>
                </div>
            </div>

            {/* ── Modal de Confirmación al regresar a Fase 1 con cambios sin guardar ── */}
            <ConfirmModal
                isOpen={isLeaveConfirmModalOpen}
                onClose={() => setIsLeaveConfirmModalOpen(false)}
                onConfirm={() => {
                    setIsLeaveConfirmModalOpen(false);
                    onBackToStep1();
                }}
                variant="warning"
                title="Calificaciones sin guardar en Fase 2"
                message={`Tienes ${unsavedChangesCount} calificación(es) modificada(s) sin guardar. ¿Deseas regresar a la Fase 1 descartando los cambios recientes o prefieres guardarlos antes de salir?`}
                cancelText="Seguir Calificando"
                confirmText="Descartar y Volver a Fase 1"
            >
                <div className="mt-3 pt-2.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                        También puedes guardar tu progreso actual y regresar:
                    </span>
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleSaveAndBack}
                        disabled={isComputing}
                        className="flex items-center gap-1.5 text-xs font-semibold h-8 px-3 shrink-0"
                    >
                        <Save size={13} />
                        <span>Guardar y Volver a Fase 1</span>
                    </Button>
                </div>
            </ConfirmModal>
        </div>
    );
};

export default memo(Step2SubfactorRating);
