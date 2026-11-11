/**
 * features/publicEvaluation/components/tour/GuidedTour.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente modularizado de tutorial interactivo (Spotlight Tour).
 * Genera un overlay oscuro con máscara SVG recortada sobre el elemento enfocado,
 * permitiendo destacar visualmente cada zona del paso mientras enseña su función
 * con tooltips enriquecidos, controles de navegación y teclado.
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../../components/ui/Button';
import type { TourStep } from './step1TourSteps';

interface GuidedTourProps {
    isOpen: boolean;
    onClose: () => void;
    steps: TourStep[];
    onComplete?: () => void;
}

interface TargetBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
    isOpen,
    onClose,
    steps,
    onComplete,
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
    const [hasValidTarget, setHasValidTarget] = useState(false);
    const [wasOpen, setWasOpen] = useState(isOpen);

    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (isOpen) {
            setCurrentIndex(0);
            setTargetBox(null);
            setHasValidTarget(false);
        }
    }

    const currentStep = steps[currentIndex];
    const isFirstStep = currentIndex === 0;
    const isLastStep = currentIndex === steps.length - 1;

    // Calcular posición del elemento enfocado
    const updateTargetBox = useCallback(() => {
        if (!isOpen || !currentStep) return;

        // Si el paso requiere una acción previa (ej. cambiar de tab)
        if (currentStep.actionSelector) {
            const triggerEl = document.querySelector<HTMLElement>(currentStep.actionSelector);
            triggerEl?.click();
        }

        const measureTarget = () => {
            const el = document.querySelector(currentStep.targetSelector);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                const rect = el.getBoundingClientRect();
                const padding = 6;
                setTargetBox({
                    x: Math.max(0, rect.left - padding),
                    y: Math.max(0, rect.top - padding),
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                });
                setHasValidTarget(true);
            } else {
                setTargetBox({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                    width: 0,
                    height: 0,
                });
                setHasValidTarget(false);
            }
        };

        measureTarget();

        // Re-medir tras tiempos de animación de scroll suave o renderizado de tabs
        const t1 = setTimeout(measureTarget, 80);
        const t2 = setTimeout(measureTarget, 260);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [isOpen, currentStep]);

    // Recalcular en cambios de paso, resize o scroll
    useEffect(() => {
        if (!isOpen) return;

        const handleResizeOrScroll = () => {
            updateTargetBox();
        };

        const cleanup = updateTargetBox();

        window.addEventListener('resize', handleResizeOrScroll);
        window.addEventListener('scroll', handleResizeOrScroll, true);

        return () => {
            if (cleanup) cleanup();
            window.removeEventListener('resize', handleResizeOrScroll);
            window.removeEventListener('scroll', handleResizeOrScroll, true);
        };
    }, [isOpen, currentIndex, updateTargetBox]);

    // Controles por teclado (Escape, Flechas)
    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
                if (isLastStep) {
                    onClose();
                    onComplete?.();
                } else {
                    setCurrentIndex((prev) => Math.min(steps.length - 1, prev + 1));
                }
            } else if (e.key === 'ArrowLeft') {
                setCurrentIndex((prev) => Math.max(0, prev - 1));
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, isLastStep, steps.length, onClose, onComplete]);

    const handleNext = () => {
        if (isLastStep) {
            onClose();
            onComplete?.();
        } else {
            setCurrentIndex((prev) => Math.min(steps.length - 1, prev + 1));
        }
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
    };

    if (!isOpen || !currentStep || !targetBox) return null;

    // Calcular posición del Tooltip en pantalla
    const tooltipWidth = Math.min(420, typeof window !== 'undefined' ? window.innerWidth - 32 : 380);
    const tooltipHeight = 220; // Estimación segura
    const margin = 14;

    let tooltipLeft = targetBox.x + targetBox.width / 2 - tooltipWidth / 2;
    let tooltipTop = targetBox.y + targetBox.height + margin;

    if (!hasValidTarget) {
        tooltipLeft = (window.innerWidth - tooltipWidth) / 2;
        tooltipTop = (window.innerHeight - tooltipHeight) / 2;
    } else {
        let requestedPlacement = currentStep.placement || 'bottom';

        // Si se pide left/right pero el ancho del elemento no deja espacio lateral, usar top o bottom
        if (requestedPlacement === 'left' && targetBox.x < tooltipWidth + margin) {
            requestedPlacement = targetBox.y > tooltipHeight + margin ? 'top' : 'bottom';
        } else if (requestedPlacement === 'right' && window.innerWidth - (targetBox.x + targetBox.width) < tooltipWidth + margin) {
            requestedPlacement = targetBox.y > tooltipHeight + margin ? 'top' : 'bottom';
        }

        // Auto flip vertical si no cabe
        if (requestedPlacement === 'bottom' && targetBox.y + targetBox.height + margin + tooltipHeight > window.innerHeight) {
            if (targetBox.y > tooltipHeight + margin) {
                requestedPlacement = 'top';
            }
        } else if (requestedPlacement === 'top' && targetBox.y - tooltipHeight - margin < 0) {
            if (window.innerHeight - (targetBox.y + targetBox.height) > tooltipHeight + margin) {
                requestedPlacement = 'bottom';
            }
        }

        if (requestedPlacement === 'top') {
            tooltipTop = targetBox.y - tooltipHeight - margin;
        } else if (requestedPlacement === 'bottom') {
            tooltipTop = targetBox.y + targetBox.height + margin;
        } else if (requestedPlacement === 'left') {
            tooltipLeft = targetBox.x - tooltipWidth - margin;
            tooltipTop = targetBox.y + targetBox.height / 2 - tooltipHeight / 2;
        } else if (requestedPlacement === 'right') {
            tooltipLeft = targetBox.x + targetBox.width + margin;
            tooltipTop = targetBox.y + targetBox.height / 2 - tooltipHeight / 2;
        }

        // Auto-ajuste de límites dentro de la ventana (Safety bounds)
        tooltipLeft = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, tooltipLeft));
        tooltipTop = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, tooltipTop));
    }

    return createPortal(
        <div className="fixed inset-0 z-[10000] overflow-hidden select-none">
            {/* 1. Máscara SVG de Spotlight que oscurece el resto de la interfaz */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-auto"
                style={{ filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }}
            >
                <defs>
                    <mask id="tour-spotlight-mask">
                        {/* Fondo blanco: Todo queda oscurecido */}
                        <rect x="0" y="0" width="100%" height="100%" fill="white" />
                        {/* Agujero negro: Zona enfocada transparente si el elemento existe */}
                        {hasValidTarget && (
                            <rect
                                x={targetBox.x}
                                y={targetBox.y}
                                width={targetBox.width}
                                height={targetBox.height}
                                rx="8"
                                ry="8"
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>

                {/* Capa de overlay con el recorte */}
                <rect
                    x="0"
                    y="0"
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.72)"
                    mask="url(#tour-spotlight-mask)"
                    onClick={handleNext}
                />

                {/* Borde sutil brillante alrededor del elemento enfocado */}
                {hasValidTarget && (
                    <rect
                        x={targetBox.x}
                        y={targetBox.y}
                        width={targetBox.width}
                        height={targetBox.height}
                        rx="8"
                        ry="8"
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        className="transition-all duration-300"
                    />
                )}
            </svg>

            {/* 2. Tarjeta Tooltip Explicativa */}
            <div
                className={clsx(
                    'absolute w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] z-[10001] flex flex-col',
                    'bg-[var(--color-bg-elevated)] border border-[var(--color-primary)]/40',
                    'rounded-[8px] shadow-2xl p-4',
                    'text-[var(--color-text-primary)]',
                    'animate-in fade-in zoom-in-95 duration-150'
                )}
                style={{
                    left: `${tooltipLeft}px`,
                    top: `${tooltipTop}px`,
                }}
            >
                {/* Cabecera del Tooltip */}
                <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-[var(--color-border-subtle)]">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                        <span className="p-1 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] shrink-0 mt-0.5">
                            <Sparkles size={13} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-primary)] block truncate">
                                {currentStep.badge || `Paso ${currentIndex + 1} de ${steps.length}`}
                            </span>
                            <h4 className="text-xs sm:text-sm font-black text-[var(--color-text-primary)] leading-snug break-words">
                                {currentStep.title}
                            </h4>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1 rounded hover:bg-[var(--color-bg-page)] transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
                        title="Cerrar tutorial (Esc)"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Cuerpo explicativo */}
                <div className="py-2.5">
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {currentStep.description}
                    </p>
                </div>

                {/* Indicador de progreso por puntos */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
                    <div className="flex items-center gap-1">
                        {steps.map((_, idx) => (
                            <span
                                key={idx}
                                className={clsx(
                                    'h-1.5 rounded-full transition-all',
                                    idx === currentIndex
                                        ? 'w-5 bg-[var(--color-primary)]'
                                        : 'w-1.5 bg-[var(--color-border-strong)]/40'
                                )}
                            />
                        ))}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-1.5">
                        {!isFirstStep && (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="h-7 px-2 rounded-[4px] text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)] transition-colors flex items-center gap-0.5"
                            >
                                <ChevronLeft size={13} />
                                <span>Atrás</span>
                            </button>
                        )}

                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleNext}
                            className="h-7 px-3 text-xs font-bold flex items-center gap-1"
                        >
                            <span>{isLastStep ? 'Finalizar' : 'Siguiente'}</span>
                            {isLastStep ? <Check size={13} /> : <ChevronRight size={13} />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default memo(GuidedTour);
