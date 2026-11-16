/**
 * features/publicEvaluation/components/steps/Step1FactorsConfig.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fase 1 (Pasos 1 y 2): Configuración de Factores e Importancia del Decisor (ID).
 * Rediseñado: Navegación por dimensión y factor por factor, sin sobrecarga visual,
 * sin cards pesadas, sin sliders, con radio buttons directos y cabiendo 100% en pantalla.
 */

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import {
    Sparkles,
    HelpCircle,
    ArrowRight,
    ArrowLeft,
    Layers,
    Cpu,
    Building2,
    Coins,
    ChevronRight,
    ChevronLeft,
    BookOpen,
    Lock,
} from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../../components/ui/Button';
import FactorSourcesModal from '../../../guios/evaluations/components/detail/FactorSourcesModal';
import AISuggestSelector from '../ui/AISuggestSelector';
import type { EvaluationDetail, EvaluationFactorItem } from '../../../../api/evaluationService';
import type { LocalDecisorState } from '../../hooks/usePublicEvaluation';

interface Step1FactorsConfigProps {
    evaluation: EvaluationDetail;
    decisorMap: Record<number, LocalDecisorState>;
    getCalculatedIR: (factorId: number, systemicImportance: number) => number;
    onDecisorChange: (factorId: number, idValue: number) => void;
    onScopeChange: (factorId: number, scope: 'internal' | 'external') => void;
    onAISuggestImportance?: (factorId: number) => void;
    onAISuggestBatchImportance?: (factorIds: number[]) => void;
    aiLoadingFactors?: Record<number, boolean>;
    onSaveDecisor: () => Promise<boolean>;
    isComputing: boolean;
    onOpenHelp: () => void;
    onBackToStep0?: () => void;
    isReadOnly?: boolean;
    onContinueToStep2?: () => void;
}

const IR_LABELS: Record<number, { text: string; badgeClass: string }> = {
    1: {
        text: 'Irrelevante (Descartado)',
        badgeClass: 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]',
    },
    2: {
        text: 'Opcional (Pasa a Fase 2)',
        badgeClass: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]',
    },
    3: {
        text: 'Importante (Pasa a Fase 2)',
        badgeClass: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border-[var(--color-border-subtle)] font-medium',
    },
    4: {
        text: 'Fundamental (Pasa a Fase 2)',
        badgeClass: 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border-[var(--color-border-strong)] font-bold',
    },
};


const QUALITATIVE_LEVELS: Record<number, string> = {
    1: 'Irrelevante',
    2: 'Opcional',
    3: 'Importante',
    4: 'Fundamental',
};

const ID_OPTIONS = [
    { value: 1, label: '1 - Irrelevante', desc: 'No prioritario' },
    { value: 2, label: '2 - Opcional', desc: 'Deseable pero no crítico para la institución' },
    { value: 3, label: '3 - Importante', desc: 'Alta prioridad • Relevante para los objetivos' },
    { value: 4, label: '4 - Fundamental', desc: 'Crítico e indispensable para la adopción' },
];

const DIMENSION_ICONS: Record<string, React.ElementType> = {
    Tecnológica: Cpu,
    Organizacional: Building2,
    Económica: Coins,
};

export const Step1FactorsConfig: React.FC<Step1FactorsConfigProps> = ({
    evaluation,
    decisorMap,
    getCalculatedIR,
    onDecisorChange,
    onScopeChange,
    onAISuggestImportance,
    onAISuggestBatchImportance,
    aiLoadingFactors,
    onSaveDecisor,
    isComputing,
    onOpenHelp,
    onBackToStep0,
    isReadOnly = false,
    onContinueToStep2,
}) => {
    // 1. Agrupar factores por Dimensión
    const groupedDimensions = useMemo(() => {
        const groups: Record<string, EvaluationFactorItem[]> = {};
        (evaluation.factors || []).forEach((factor) => {
            const dimName = factor.dimension_name || 'General';
            if (!groups[dimName]) {
                groups[dimName] = [];
            }
            groups[dimName].push(factor);
        });
        return groups;
    }, [evaluation.factors]);

    const dimensionNames = useMemo(() => Object.keys(groupedDimensions), [groupedDimensions]);

    // La selección guardada puede quedar fuera del catálogo; la vista usa el primer valor válido.
    const [chosenDimension, setChosenDimension] = useState<string | null>(null);
    const [chosenFactorId, setChosenFactorId] = useState<number | null>(null);
    const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);
    const [mobileView, setMobileView] = useState<'detail' | 'list'>('detail');
    const [aiSuggestScope, setAiSuggestScope] = useState<'factor' | 'dimension' | 'all'>('factor');

    const activeDimension =
        chosenDimension && dimensionNames.includes(chosenDimension)
            ? chosenDimension
            : dimensionNames[0] || 'Tecnológica';

    const currentDimensionFactors = useMemo(() => {
        return groupedDimensions[activeDimension] || [];
    }, [groupedDimensions, activeDimension]);

    const selectedFactorId = currentDimensionFactors.some((factor) => factor.factor_id === chosenFactorId)
        ? chosenFactorId
        : (currentDimensionFactors[0]?.factor_id ?? null);

    // Factor actualmente seleccionado
    const activeFactor = useMemo(() => {
        return (
            currentDimensionFactors.find((f) => f.factor_id === selectedFactorId) ||
            currentDimensionFactors[0] ||
            null
        );
    }, [currentDimensionFactors, selectedFactorId]);

    // Índices para navegación
    const activeFactorIndexInDim = useMemo(() => {
        if (!activeFactor) return 0;
        return currentDimensionFactors.findIndex((f) => f.factor_id === activeFactor.factor_id);
    }, [currentDimensionFactors, activeFactor]);

    const activeDimIndex = useMemo(() => {
        return dimensionNames.indexOf(activeDimension);
    }, [dimensionNames, activeDimension]);

    // Métricas globales de relevancia
    const metrics = useMemo(() => {
        let relevantCount = 0;
        let discardedCount = 0;
        (evaluation.factors || []).forEach((f) => {
            const ir = getCalculatedIR(f.factor_id, f.systemic_importance_snapshot);
            if (ir > 1) {
                relevantCount++;
            } else {
                discardedCount++;
            }
        });
        return {
            relevantCount,
            discardedCount,
            total: evaluation.factors?.length || 0,
        };
    }, [evaluation.factors, getCalculatedIR]);

    // Métricas por dimensión
    const dimensionMetrics = useMemo(() => {
        const result: Record<string, { relevant: number; total: number }> = {};
        Object.entries(groupedDimensions).forEach(([dim, factors]) => {
            let relevant = 0;
            factors.forEach((f) => {
                const ir = getCalculatedIR(f.factor_id, f.systemic_importance_snapshot);
                if (ir > 1) relevant++;
            });
            result[dim] = { relevant, total: factors.length };
        });
        return result;
    }, [groupedDimensions, getCalculatedIR]);

    // Datos del factor activo
    const activeLocalState: LocalDecisorState = useMemo(() => {
        if (!activeFactor) {
            return {
                id_value: 1,
                scope: 'internal',
                is_modified: false,
            };
        }
        return (
            decisorMap[activeFactor.factor_id] || {
                id_value: activeFactor.decisor_importance ?? 1,
                scope: activeFactor.scope_used || 'internal',
                is_modified: false,
                ai_suggested: activeFactor.ai_suggested_id || undefined,
                ai_justification: activeFactor.ai_id_justification || undefined,
            }
        );
    }, [activeFactor, decisorMap]);

    const activeCurrentIR = useMemo(() => {
        if (!activeFactor) return 1;
        return getCalculatedIR(activeFactor.factor_id, activeFactor.systemic_importance_snapshot);
    }, [activeFactor, getCalculatedIR]);

    const activeIRMeta = IR_LABELS[activeCurrentIR] || IR_LABELS[1];
    const isFactorRelevant = activeCurrentIR > 1;
    const isConfigurableScope = activeFactor ? activeFactor.factor_name.toLowerCase().includes('soporte') : false;

    // Handlers de navegación
    const handlePrevFactor = useCallback(() => {
        if (activeFactorIndexInDim > 0) {
            setChosenFactorId(currentDimensionFactors[activeFactorIndexInDim - 1].factor_id);
        } else if (activeDimIndex > 0) {
            const prevDim = dimensionNames[activeDimIndex - 1];
            const prevDimFactors = groupedDimensions[prevDim] || [];
            setChosenDimension(prevDim);
            if (prevDimFactors.length > 0) {
                setChosenFactorId(prevDimFactors[prevDimFactors.length - 1].factor_id);
            }
        }
    }, [activeFactorIndexInDim, currentDimensionFactors, activeDimIndex, dimensionNames, groupedDimensions]);

    const handleNextFactor = useCallback(() => {
        if (activeFactorIndexInDim < currentDimensionFactors.length - 1) {
            setChosenFactorId(currentDimensionFactors[activeFactorIndexInDim + 1].factor_id);
        } else if (activeDimIndex < dimensionNames.length - 1) {
            const nextDim = dimensionNames[activeDimIndex + 1];
            const nextDimFactors = groupedDimensions[nextDim] || [];
            setChosenDimension(nextDim);
            if (nextDimFactors.length > 0) {
                setChosenFactorId(nextDimFactors[0].factor_id);
            }
        }
    }, [activeFactorIndexInDim, currentDimensionFactors, activeDimIndex, dimensionNames, groupedDimensions]);

    const isFirstFactorOverall = activeDimIndex === 0 && activeFactorIndexInDim === 0;
    const isLastFactorOverall =
        activeDimIndex === dimensionNames.length - 1 &&
        activeFactorIndexInDim === currentDimensionFactors.length - 1;

    // Atajos de teclado: ← / → para navegar factores y 1-4 para calificar ID
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isSourcesModalOpen) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'ArrowLeft' && !isFirstFactorOverall) {
                e.preventDefault();
                handlePrevFactor();
            } else if (e.key === 'ArrowRight' && !isLastFactorOverall) {
                e.preventDefault();
                handleNextFactor();
            } else if (!isReadOnly && activeFactor && ['1', '2', '3', '4'].includes(e.key)) {
                e.preventDefault();
                onDecisorChange(activeFactor.factor_id, Number(e.key));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        isSourcesModalOpen,
        isFirstFactorOverall,
        isLastFactorOverall,
        handlePrevFactor,
        handleNextFactor,
        isReadOnly,
        activeFactor,
        onDecisorChange,
    ]);

    const literatureSearchActive = evaluation.ai_status === 'searching';
    const literatureSearchFailed = evaluation.ai_enabled && evaluation.ai_status === 'failed';

    const hasFactorAISuggestion = useCallback(
        (factor: EvaluationFactorItem) => {
            const local = decisorMap[factor.factor_id];
            return Boolean(
                (local?.ai_justification && local?.ai_suggested)
                || (factor.ai_id_justification && factor.ai_suggested_id)
            );
        },
        [decisorMap]
    );

    const dimensionPendingFactorIds = useMemo(
        () =>
            currentDimensionFactors
                .filter((f) => !hasFactorAISuggestion(f))
                .map((f) => f.factor_id),
        [currentDimensionFactors, hasFactorAISuggestion]
    );

    const allPendingFactorIds = useMemo(
        () =>
            (evaluation.factors || [])
                .filter((f) => !hasFactorAISuggestion(f))
                .map((f) => f.factor_id),
        [evaluation.factors, hasFactorAISuggestion]
    );

    const aiScopeOptions = useMemo(
        () => [
            {
                value: 'factor',
                label: 'Factor actual',
                pendingCount: activeFactor ? (hasFactorAISuggestion(activeFactor) ? 0 : 1) : 0,
            },
            {
                value: 'dimension',
                label: `Dimensión ${activeDimension}`,
                pendingCount: dimensionPendingFactorIds.length,
            },
            {
                value: 'all',
                label: 'Todos los factores',
                pendingCount: allPendingFactorIds.length,
            },
        ],
        [activeFactor, hasFactorAISuggestion, activeDimension, dimensionPendingFactorIds.length, allPendingFactorIds.length]
    );

    const isAnyFactorAILoading = useMemo(
        () => Object.values(aiLoadingFactors || {}).some(Boolean),
        [aiLoadingFactors]
    );

    const handleRunStep1AISuggest = useCallback(() => {
        if (aiSuggestScope === 'factor') {
            if (activeFactor && onAISuggestImportance) {
                onAISuggestImportance(activeFactor.factor_id);
            }
            return;
        }
        if (aiSuggestScope === 'dimension') {
            onAISuggestBatchImportance?.(dimensionPendingFactorIds);
            return;
        }
        onAISuggestBatchImportance?.(allPendingFactorIds);
    }, [
        aiSuggestScope,
        activeFactor,
        onAISuggestImportance,
        onAISuggestBatchImportance,
        dimensionPendingFactorIds,
        allPendingFactorIds,
    ]);

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col animate-fadeIn gap-2 overflow-hidden">
            {/* ── BARRA SUPERIOR: Pestañas de Dimensión y Resumen de Métricas ── */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] px-2.5 sm:px-3 py-1.5 shadow-xs shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                {/* Selector de Dimensiones (Pills) */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 sm:pb-0" data-tour="dimension-tabs">
                    {dimensionNames.map((dimName) => {
                        const Icon = DIMENSION_ICONS[dimName] || Layers;
                        const isDimActive = activeDimension === dimName;
                        const dimInfo = dimensionMetrics[dimName] || { relevant: 0, total: 0 };

                        return (
                            <button
                                key={dimName}
                                type="button"
                                onClick={() => {
                                    setChosenDimension(dimName);
                                    const dimFactors = groupedDimensions[dimName] || [];
                                    if (dimFactors.length > 0) {
                                        setChosenFactorId(dimFactors[0].factor_id);
                                    }
                                }}
                                className={clsx(
                                    'flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-[6px] text-xs font-bold transition-all cursor-pointer whitespace-nowrap border shrink-0',
                                    isDimActive
                                        ? 'bg-[var(--color-primary-soft-bg)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-xs'
                                        : 'bg-[var(--color-bg-page)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]'
                                )}
                            >
                                <Icon size={13} className={isDimActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'} />
                                <span>{dimName}</span>
                                <span
                                    className={clsx(
                                        'text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold',
                                        isDimActive
                                            ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                                            : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)]'
                                    )}
                                >
                                    {dimInfo.relevant}/{dimInfo.total}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Métricas Globales y Botón de Ayuda */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 text-xs" data-tour="metrics-summary">
                    <div className="flex items-center gap-1.5 sm:gap-2 font-mono">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] text-[10px] sm:text-[11px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                            <span>{metrics.relevantCount} Relevantes</span>
                        </span>
                        {metrics.discardedCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)] text-[10px] sm:text-[11px] font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border-strong)] shrink-0" />
                                <span>{metrics.discardedCount} Descartados</span>
                            </span>
                        )}
                    </div>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onOpenHelp}
                        className="flex items-center gap-1 text-[11px] h-6.5 px-2"
                        title="Ver criterios metodológicos de la Fase 1"
                    >
                        <HelpCircle size={12} className="text-[var(--color-primary)]" />
                        <span className="hidden sm:inline">Guía</span>
                    </Button>
                </div>
            </div>

            {literatureSearchFailed && (
                <div className="px-3 py-1 bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] rounded-[6px] text-xs text-[var(--color-warning-text)] shrink-0">
                    No se completó la búsqueda remota de literatura. Se aplicaron los valores base del catálogo metodológico.
                </div>
            )}

            {/* ── Selector Móvil: Factor Activo vs Lista de Factores (< lg) ── */}
            <div className="flex lg:hidden items-center bg-[var(--color-bg-elevated)] p-1 rounded-[8px] border border-[var(--color-border-subtle)] shrink-0 shadow-xs">
                <button
                    type="button"
                    onClick={() => setMobileView('detail')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer select-none',
                        mobileView === 'detail'
                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                >
                    <Sparkles size={13} className="shrink-0" />
                    <span className="truncate">Factor Activo ({activeFactorIndexInDim + 1}/{currentDimensionFactors.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-[6px] text-xs font-bold transition-all cursor-pointer select-none',
                        mobileView === 'list'
                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                >
                    <Layers size={13} className="shrink-0" />
                    <span>Lista ({currentDimensionFactors.length})</span>
                </button>
            </div>

            {/* ── CUERPO PRINCIPAL: MASTER-DETAIL EN UNA SOLA PANTALLA ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 min-h-0 items-stretch overflow-hidden">
                {/* ── COLUMNA IZQUIERDA: Selector de Factores de la Dimensión (4 de 12 cols con scroll interno) ── */}
                <div
                    className={clsx(
                        'lg:col-span-4 flex-col min-h-0 lg:h-full lg:overflow-hidden',
                        mobileView === 'list' ? 'flex flex-1' : 'hidden lg:flex'
                    )}
                    data-tour="factors-list"
                >
                    <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-[8px] p-2.5 shadow-xs flex flex-col h-full min-h-0 overflow-hidden">
                        {/* Cabecera del Listado */}
                        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-1.5 shrink-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                    Factores • {activeDimension}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setMobileView('detail')}
                                    className="lg:hidden text-[10px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    → Ver activo
                                </button>
                            </div>
                            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                                {activeFactorIndexInDim + 1} de {currentDimensionFactors.length}
                            </span>
                        </div>

                        {/* Listado de Factores (Clickable con Scroll Vertical Interno) */}
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 my-1.5 pr-1.5">
                            {currentDimensionFactors.map((factor, idx) => {
                                const isSelected = factor.factor_id === activeFactor?.factor_id;
                                const ir = getCalculatedIR(factor.factor_id, factor.systemic_importance_snapshot);
                                const isRel = ir > 1;
                                const factorLocal = decisorMap[factor.factor_id];
                                const hasAISuggestion = evaluation.ai_enabled && factorLocal?.ai_suggested;
                                const isUsingAISuggestion = Boolean(hasAISuggestion && factorLocal.id_value === factorLocal.ai_suggested);

                                return (
                                    <button
                                        key={factor.factor_id}
                                        type="button"
                                        onClick={() => {
                                            setChosenFactorId(factor.factor_id);
                                            setMobileView('detail');
                                        }}
                                        className={clsx(
                                            'w-full text-left px-2.5 py-1.5 rounded-[6px] border transition-all flex items-center justify-between gap-2 cursor-pointer',
                                            isSelected
                                                ? 'bg-[var(--color-bg-elevated)] border-[var(--color-border-strong)] border-l-2 border-l-[var(--color-primary)] text-[var(--color-text-primary)] shadow-xs'
                                                : 'bg-[var(--color-bg-page)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                        )}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                                    {idx + 1}.
                                                </span>
                                                <h4
                                                    className={clsx(
                                                        'text-xs truncate font-medium text-[var(--color-text-primary)]'
                                                    )}
                                                >
                                                    {factor.factor_name}
                                                </h4>
                                                {isUsingAISuggestion && (
                                                    <span title="Sugerencia de IA aplicada" className="inline-flex shrink-0">
                                                        <Sparkles size={12} className="text-amber-400 shrink-0" />
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)] mt-0.5 font-mono truncate">
                                                <span title="Importancia Sugerida por catálogo / literatura">
                                                    Sug: <strong className="text-[var(--color-text-secondary)]">{QUALITATIVE_LEVELS[factor.systemic_importance_snapshot] || 'Opcional'}</strong>
                                                </span>
                                                <span>•</span>
                                                <span title="Importancia del Decisor seleccionada">
                                                    ID: <strong className="text-[var(--color-text-secondary)]">{factorLocal?.id_value ?? factor.decisor_importance ?? 1}</strong>
                                                </span>
                                                <span>•</span>
                                                <span title="Alcance del factor">
                                                    {(factorLocal?.scope || factor.scope_used) === 'external' ? 'Externo' : 'Interno'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Badge IR */}
                                        <div className="shrink-0 flex items-center gap-1">
                                            <span
                                                className={clsx(
                                                    'font-mono text-[10px] px-1.5 py-0.2 rounded border',
                                                    isRel
                                                        ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] font-medium'
                                                        : 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)]'
                                                )}
                                            >
                                                IR: {ir}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Pie del Listado */}
                        <div className="pt-1.5 border-t border-[var(--color-border-subtle)] text-[10px] text-[var(--color-text-tertiary)] flex items-center justify-between shrink-0 font-mono">
                            <span>Total Dimensión: {currentDimensionFactors.length}</span>
                            <span>Criterio: Relevante si IR &gt; 1</span>
                        </div>
                    </div>
                </div>

                {/* ── COLUMNA DERECHA: Inspector Enfocado en 2 Columnas (8 de 12 cols) ── */}
                <div
                    className={clsx(
                        'lg:col-span-8 flex-col min-h-0 lg:h-full lg:overflow-hidden',
                        mobileView === 'detail' ? 'flex flex-1' : 'hidden lg:flex'
                    )}
                >
                    {activeFactor ? (
                        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-[8px] p-2.5 sm:p-3.5 shadow-xs flex flex-col h-full min-h-0 overflow-hidden">
                            {/* 1. Cabecera con Nombre y Relevancia */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--color-border-subtle)] pb-2 shrink-0" data-tour="factor-header">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] shrink-0">
                                        Dimensión {activeFactor.dimension_name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setMobileView('list')}
                                        className="lg:hidden text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/25 hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer shrink-0"
                                        title="Ver todos los factores de esta dimensión"
                                    >
                                        {activeFactorIndexInDim + 1}/{currentDimensionFactors.length} en lista
                                    </button>
                                    <h3 className="text-xs sm:text-sm md:text-base font-bold text-[var(--color-text-primary)] truncate">
                                        {activeFactor.factor_name}
                                    </h3>
                                </div>

                                {/* Badge IR Resultante */}
                                <div className="shrink-0 flex items-center gap-2">
                                    <span
                                        className={clsx(
                                            'inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-[4px] text-[11px] sm:text-xs font-mono border shadow-2xs',
                                            activeIRMeta.badgeClass
                                        )}
                                    >
                                        {isFactorRelevant ? (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                                        ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border-strong)] shrink-0" />
                                        )}
                                        <span>IR: {activeCurrentIR} — {activeIRMeta.text}</span>
                                    </span>
                                </div>
                            </div>

                            {/* 2. Cuerpo Principal en 2 COLUMNAS: Izquierda (Decisor en Filas) y Derecha (Metadatos & IA) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5 flex-1 min-h-0 my-2 overflow-y-auto md:overflow-hidden pr-0.5">
                                {/* Sub-Columna 1: Importancia del Decisor (ID) con Radio Buttons en FILAS Estiradas */}
                                <div className="p-2.5 sm:p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[6px] flex flex-col min-h-0 md:h-full overflow-hidden shrink-0" data-tour="decisor-selector">
                                    <div className="shrink-0 pb-1 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <label className="block text-xs font-bold text-[var(--color-text-primary)]">
                                                {isReadOnly ? 'Imp. Decisor (Solo lectura • Bloqueado):' : 'Imp. Decisor (Interactiva):'}
                                            </label>
                                            <span className="text-[10px] font-mono text-[var(--color-text-secondary)] font-medium px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
                                                ID: {activeLocalState.id_value} ({QUALITATIVE_LEVELS[activeLocalState.id_value]})
                                            </span>
                                        </div>
                                        {!isReadOnly && evaluation.ai_enabled && (onAISuggestImportance || onAISuggestBatchImportance) && (
                                            <div className="flex items-center justify-between gap-2 pt-0.5">
                                                <AISuggestSelector
                                                    options={aiScopeOptions}
                                                    selectedScope={aiSuggestScope}
                                                    onScopeChange={(scope) =>
                                                        setAiSuggestScope(scope as 'factor' | 'dimension' | 'all')
                                                    }
                                                    onRun={handleRunStep1AISuggest}
                                                    isLoading={isAnyFactorAILoading}
                                                    disabled={isComputing || literatureSearchActive}
                                                    allReadyForScope={
                                                        aiSuggestScope === 'factor'
                                                            ? Boolean(activeLocalState.ai_justification)
                                                            : aiSuggestScope === 'dimension'
                                                            ? dimensionPendingFactorIds.length === 0
                                                            : allPendingFactorIds.length === 0
                                                    }
                                                    ariaLabel="Modo de sugerencia IA en Fase 1"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Radio buttons colocados en FILAS verticales con descripción explicativa y estirados */}
                                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 sm:gap-2 py-1">
                                        {ID_OPTIONS.map((opt) => {
                                            const isChecked = activeLocalState.id_value === opt.value;

                                            return (
                                                <label
                                                    key={opt.value}
                                                    className={clsx(
                                                        'shrink-0 min-h-[40px] sm:min-h-[42px] flex items-center gap-2.5 px-3 py-1.5 sm:py-2 rounded-[5px] border transition-all select-none',
                                                        isReadOnly ? 'cursor-default' : 'cursor-pointer',
                                                        isChecked
                                                            ? 'bg-[var(--color-bg-elevated)] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20 shadow-xs'
                                                            : isReadOnly
                                                            ? 'bg-[var(--color-bg-elevated)]/60 border-[var(--color-border-subtle)] opacity-75'
                                                            : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]'
                                                    )}
                                                >
                                                    <input
                                                        type="radio"
                                                        name={`decisor_id_${activeFactor.factor_id}`}
                                                        value={opt.value}
                                                        checked={isChecked}
                                                        disabled={isReadOnly}
                                                        onChange={() => !isReadOnly && onDecisorChange(activeFactor.factor_id, opt.value)}
                                                        className={clsx(
                                                            'w-4 h-4 text-[var(--color-primary)] accent-[var(--color-primary)] shrink-0',
                                                            isReadOnly ? 'cursor-default' : 'cursor-pointer'
                                                        )}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span
                                                            className="text-xs font-semibold leading-tight text-[var(--color-text-primary)]"
                                                        >
                                                            {opt.label}
                                                        </span>
                                                        <span
                                                            className="text-[10px] mt-0.5 leading-snug text-[var(--color-text-tertiary)]"
                                                        >
                                                            {opt.desc}
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                        {activeLocalState.ai_justification && (
                                            <p className="mt-1 text-[11px] leading-relaxed break-words">
                                                <Sparkles size={12} className="mr-1 inline text-amber-400" />
                                                <span className="ai-platinum-text">Sugerencia IA: {activeLocalState.ai_justification}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div
                                        className="p-2 rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[11px] font-mono flex items-center gap-2 mt-2 shrink-0 transition-colors text-[var(--color-text-secondary)]"
                                    >
                                        {isFactorRelevant ? (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                                                <span className="truncate">Pasa a Fase 2 (IR = {activeCurrentIR} {QUALITATIVE_LEVELS[activeCurrentIR]})</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border-strong)] shrink-0" />
                                                <span className="truncate">Descartado (IR = 1 Irrelevante)</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Sub-Columna 2: Información Técnica del Factor Estirada y Asistencia IA */}
                                <div className="p-2.5 sm:p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[6px] flex flex-col justify-between min-h-0 md:h-full shrink-0" data-tour="factor-info">
                                    <div className="shrink-0 pb-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                                Información del Factor:
                                            </span>
                                            <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                                                {activeFactor.subfactors_count_snapshot} subfactores en catálogo
                                            </span>
                                        </div>
                                    </div>

                                    {/* 1. Parámetros Metodológicos Estirados para Ocupar Todo el Espacio Disponible */}
                                    <div className="flex-1 min-h-0 flex flex-col justify-between gap-1.5 sm:gap-2 py-1">
                                        {/* Imp. Sugerida */}
                                        <div className="flex-1 min-h-[38px] sm:min-h-[42px] flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] transition-colors">
                                            <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-xs text-[var(--color-text-secondary)]">
                                                <span className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)] shrink-0" />
                                                <span className="font-semibold text-[var(--color-text-primary)]">Imp. Sugerida:</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <span className="font-mono font-medium text-[11px] sm:text-xs text-[var(--color-text-primary)]">
                                                    {QUALITATIVE_LEVELS[activeFactor.systemic_importance_snapshot] || 'Opcional'} ({activeFactor.citations_count} citas)
                                                </span>
                                                {((activeFactor.ai_literature_sources && activeFactor.ai_literature_sources.length > 0) || activeFactor.citations_count > 0) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSourcesModalOpen(true)}
                                                        className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono font-semibold px-1.5 sm:px-2 py-0.5 rounded bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-text-on-primary)] transition-colors cursor-pointer border border-[var(--color-primary)]/30"
                                                        title="Ver artículos y literatura científica indexada (OpenAlex / DOIs)"
                                                    >
                                                        <BookOpen size={11} />
                                                        <span>Ver fuentes</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Imp. Decisor */}
                                        <div className="flex-1 min-h-[38px] sm:min-h-[42px] flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] transition-colors">
                                            <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-xs text-[var(--color-text-secondary)]">
                                                <span className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)] shrink-0" />
                                                <span className="font-semibold text-[var(--color-text-primary)]">Imp. Decisor:</span>
                                            </div>
                                            <span className="font-mono font-medium text-xs text-[var(--color-text-primary)]">
                                                {QUALITATIVE_LEVELS[activeLocalState.id_value]} ({activeLocalState.id_value})
                                            </span>
                                        </div>

                                        {/* Imp. Relativa */}
                                        <div className="flex-1 min-h-[38px] sm:min-h-[42px] flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] transition-colors">
                                            <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-xs text-[var(--color-text-secondary)]">
                                                <span className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)] shrink-0" />
                                                <span className="font-semibold text-[var(--color-text-primary)]">Imp. Relativa:</span>
                                            </div>
                                            <span className={clsx('font-mono font-medium text-[11px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded border', activeIRMeta.badgeClass)}>
                                                {QUALITATIVE_LEVELS[activeCurrentIR]} (IR = {activeCurrentIR})
                                            </span>
                                        </div>

                                        {/* Alcance */}
                                        <div className="flex-1 min-h-[38px] sm:min-h-[42px] flex items-center justify-between px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-[5px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] transition-colors">
                                            <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-xs text-[var(--color-text-secondary)]">
                                                <span className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)] shrink-0" />
                                                <span className="font-semibold text-[var(--color-text-primary)]">Alcance:</span>
                                            </div>
                                            {isConfigurableScope && !isReadOnly ? (
                                                <select
                                                    value={activeLocalState.scope}
                                                    onChange={(e) =>
                                                        onScopeChange(activeFactor.factor_id, e.target.value as 'internal' | 'external')
                                                    }
                                                    className="text-xs font-semibold rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] px-2 py-1 focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                                    title="Ámbito configurable para este factor"
                                                >
                                                    <option value="internal">Interno (Equipo Propio)</option>
                                                    <option value="external">Externo (Comunidad/Proveedores)</option>
                                                </select>
                                            ) : (
                                                <span className="font-mono font-medium text-xs text-[var(--color-text-primary)]">
                                                    {activeLocalState.scope === 'internal' ? 'Interno' : 'Externo'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Subfactores en catálogo */}
                                        <div className="flex-1 min-h-[38px] sm:min-h-[44px] flex items-center justify-between px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-[5px] bg-[var(--color-bg-elevated)]/60 border border-[var(--color-border-subtle)] text-xs transition-colors">
                                            <div className="flex items-center gap-1.5 sm:gap-2 font-medium text-xs text-[var(--color-text-tertiary)]">
                                                <span className="text-[var(--color-text-tertiary)] font-bold text-base leading-none">•</span>
                                                <span>Subfactores en catálogo:</span>
                                            </div>
                                            <span className="font-mono font-bold text-xs text-[var(--color-text-secondary)]">
                                                {activeFactor.subfactors_count_snapshot}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Barra Inferior de Navegación del Inspector */}
                            <div className="pt-2 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-1.5 sm:gap-2 shrink-0">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handlePrevFactor}
                                    disabled={isFirstFactorOverall}
                                    className="flex items-center gap-1 text-xs h-7.5 sm:h-7 px-2 sm:px-2.5"
                                >
                                    <ChevronLeft size={13} />
                                    <span className="hidden sm:inline">Factor Anterior</span>
                                    <span className="sm:hidden">Anterior</span>
                                </Button>

                                <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono text-center truncate px-1">
                                    <span className="hidden sm:inline">Factor </span>
                                    {activeFactorIndexInDim + 1} de {currentDimensionFactors.length}
                                    <span className="hidden md:inline"> en {activeDimension}</span>
                                    <span className="hidden xl:inline text-[9px] ml-2 px-1.5 py-0.5 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                                        {isReadOnly ? 'Teclas: ← →' : 'Teclas: ← → • 1-4'}
                                    </span>
                                </span>

                                {isLastFactorOverall ? (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => (isReadOnly ? onContinueToStep2?.() : onSaveDecisor())}
                                        disabled={!isReadOnly && (isComputing || metrics.relevantCount === 0 || literatureSearchActive)}
                                        className="flex items-center gap-1 text-xs h-7.5 sm:h-7 px-2.5 sm:px-3 font-bold uppercase tracking-wider"
                                    >
                                        <span className="hidden sm:inline">
                                            {isReadOnly ? 'Ver Fase 2 (Solo lectura)' : 'Continuar a Calificación'}
                                        </span>
                                        <span className="sm:hidden">{isReadOnly ? 'Fase 2' : 'Continuar'}</span>
                                        <ArrowRight size={13} />
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleNextFactor}
                                        className="flex items-center gap-1 text-xs h-7.5 sm:h-7 px-2 sm:px-2.5"
                                    >
                                        <span className="hidden sm:inline">
                                            {activeFactorIndexInDim === currentDimensionFactors.length - 1
                                                ? `Siguiente Dimensión`
                                                : `Siguiente Factor`}
                                        </span>
                                        <span className="sm:hidden">Siguiente</span>
                                        <ChevronRight size={13} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] p-6 flex flex-col items-center justify-center h-full text-center text-xs text-[var(--color-text-tertiary)]">
                            <Layers size={24} className="mb-2 opacity-50" />
                            <span>Seleccione un factor del panel izquierdo para configurar su importancia</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BARRA INFERIOR GLOBAL: Volver y Guardar ── */}
            <div className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] px-2.5 sm:px-3 py-1.5 shadow-xs flex items-center justify-between gap-2 sm:gap-3 shrink-0" data-tour="step1-actions">
                <div className="flex items-center gap-2">
                    {onBackToStep0 && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onBackToStep0}
                            className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] h-7.5 sm:h-7 px-2 sm:px-2.5"
                        >
                            <ArrowLeft size={12} />
                            <span className="hidden sm:inline">Datos del Software</span>
                            <span className="sm:hidden">Paso 0</span>
                        </Button>
                    )}
                    <span className="text-[11px] text-[var(--color-text-secondary)] hidden md:inline">
                        Factores a calificar en Fase 2:{' '}
                        <strong className="text-[var(--color-text-primary)] font-mono">{metrics.relevantCount} de {metrics.total}</strong>
                    </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                    {isReadOnly && (
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)] shrink-0"
                            title="Los datos del Paso 1 están bloqueados porque ya se avanzó a la Fase 3"
                        >
                            <Lock size={12} className="text-[var(--color-primary)] shrink-0" />
                            <span className="hidden sm:inline">Modo solo lectura (Datos consolidados)</span>
                            <span className="sm:hidden">Solo lectura</span>
                        </div>
                    )}

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => (isReadOnly ? onContinueToStep2?.() : onSaveDecisor())}
                        disabled={!isReadOnly && (isComputing || metrics.relevantCount === 0 || literatureSearchActive)}
                        className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-1.5 shadow-xs h-7.5 sm:h-7"
                    >
                        <span>
                            {isReadOnly
                                ? 'Ir a Fase 2'
                                : literatureSearchActive
                                ? 'Esperando literatura...'
                                : isComputing
                                ? 'Guardando factores...'
                                : 'Continuar a Calificación'}
                        </span>
                        <ArrowRight size={14} />
                    </Button>
                </div>
            </div>

            {/* Modal de Literatura Científica y Fuentes Indexadas */}
            <FactorSourcesModal
                isOpen={isSourcesModalOpen}
                onClose={() => setIsSourcesModalOpen(false)}
                factor={activeFactor}
            />
        </div>
    );
};

export default memo(Step1FactorsConfig);
