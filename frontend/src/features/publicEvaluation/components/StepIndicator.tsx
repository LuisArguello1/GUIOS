/**
 * features/publicEvaluation/components/StepIndicator.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Indicador visual de progreso (Stepper) para las 3 fases / 6 pasos metodológicos GUIOS.
 */

import React, { memo } from 'react';
import { Sliders, CheckSquare, Award, Check, Lock } from 'lucide-react';
import { clsx } from 'clsx';

interface StepIndicatorProps {
    currentStep: number;
    onSelectStep?: (step: number) => void;
    completedSteps?: number[];
    isLocked?: boolean;
}

const STEPS = [
    {
        number: 1,
        title: 'Fase 1: Factores y Decisor',
        subtitle: 'Pasos 1-2: Ponderación ID e Importancia Relativa (IR)',
        icon: Sliders,
    },
    {
        number: 2,
        title: 'Fase 2: Calificación de Subfactores',
        subtitle: 'Pasos 3-4: Criterios técnicos y Ponderación Media (PM)',
        icon: CheckSquare,
    },
    {
        number: 3,
        title: 'Fase 3: Matriz FODA y Dictamen',
        subtitle: 'Pasos 5-6: Clasificación FODA y Recomendación Final',
        icon: Award,
    },
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({
    currentStep,
    onSelectStep,
    completedSteps = [],
    isLocked = false,
}) => {
    return (
        <nav aria-label="Progreso de Evaluación" className="w-full">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
                {STEPS.map((step) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.number;
                    const isCompleted = completedSteps.includes(step.number) || currentStep > step.number || isLocked;
                    const isStepLocked = (isLocked || currentStep === 3) && step.number < 3;
                    const isAccessible = isCompleted || isActive || Boolean(completedSteps.includes(step.number - 1));

                    return (
                        <button
                            key={step.number}
                            type="button"
                            disabled={!isAccessible}
                            onClick={() => isAccessible && onSelectStep?.(step.number)}
                            title={
                                isStepLocked
                                    ? 'Paso consolidado (Solo lectura): haz clic para ver los datos sin poder modificarlos'
                                    : undefined
                            }
                            className={clsx(
                                'flex items-center gap-1.5 sm:gap-2 md:gap-2.5 p-1.5 sm:p-2 md:p-2.5 rounded-[6px] border text-left transition-all duration-150',
                                isActive &&
                                'bg-[var(--color-bg-elevated)] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20 shadow-sm cursor-pointer',
                                isCompleted &&
                                !isActive &&
                                'bg-[var(--color-bg-elevated)]/60 border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/40 cursor-pointer',
                                !isActive &&
                                !isCompleted &&
                                'bg-[var(--color-bg-elevated)]/30 border-[var(--color-border-subtle)] opacity-50 cursor-not-allowed'
                            )}
                        >
                            <div
                                className={clsx(
                                    'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-[4px] md:rounded-[6px] flex items-center justify-center shrink-0 transition-colors',
                                    isActive && 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] font-bold',
                                    isCompleted && !isActive && 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)]',
                                    !isActive && !isCompleted && 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)]'
                                )}
                            >
                                {isStepLocked ? (
                                    <Lock size={12} className="md:w-3.5 md:h-3.5" />
                                ) : isCompleted && !isActive ? (
                                    <Check size={13} className="md:w-3.5 md:h-3.5" />
                                ) : (
                                    <Icon size={13} className="md:w-3.5 md:h-3.5" />
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-1 truncate leading-none mb-0.5">
                                    <span>Paso {step.number}</span>
                                    {isStepLocked && (
                                        <span className="hidden sm:inline text-[8px] px-1 py-0.2 rounded bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)]">
                                            Bloqueado • Ver
                                        </span>
                                    )}
                                </span>
                                <h3
                                    className={clsx(
                                        'text-[11px] sm:text-xs font-bold truncate leading-tight',
                                        isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                                    )}
                                >
                                    <span className="sm:hidden">Fase {step.number}</span>
                                    <span className="hidden sm:inline">{step.title}</span>
                                </h3>
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate hidden md:block">
                                    {step.subtitle}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
};

export default memo(StepIndicator);
