/**
 * features/landing/components/LandingProblemSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sección 2: El Desafío de la Adopción FLOSS (#problema)
 *
 * Diseño Editorial de Alta Costura:
 * - CERO cajas, cuadros o borders genéricos: la información flota libremente
 *   en el espacio escénico como un manifiesto editorial puro.
 * - Sin controles inferiores ni botones de píldora.
 * - Sin el texto "01 / EL DESAFÍO INSTITUCIONAL".
 * - Transición tipo SMOKE (Humo y Niebla):
 *   Al scrollear, los 3 puntos del problema se materializan uno por uno en el
 *   mismo punto focal, disolviéndose y condensándose en la niebla.
 * - El punto 3 permanece completamente legible y accesible al final del recorrido.
 */

import React, { memo } from 'react';
import { ArrowDownRight } from 'lucide-react';

interface ProblemPoint {
    id: string;
    num: string;
    kicker: string;
    title: string;
    desc: string;
    consequence: string;
}

const PROBLEM_POINTS: ProblemPoint[] = [
    {
        id: 'evaluacion-subjetiva',
        num: '01',
        kicker: 'CRITERIO INSUFICIENTE',
        title: 'Evaluaciones Subjetivas y Falacia del Costo Cero',
        desc: 'La decisión se precipita únicamente porque la licencia no exige pago inicial. Se omite deliberadamente la estimación del Costo Total de Propiedad (TCO), el ciclo de madurez del código y la infraestructura real de soporte requerida.',
        consequence: 'Sobrecostos severos en consultoría externa, capacitación forzada e integraciones imprevistas no presupuestadas.',
    },
    {
        id: 'costos-incompatibilidad',
        num: '02',
        kicker: 'FRICCIÓN TÉCNICA',
        title: 'Costos Ocultos e Incompatibilidad de Formatos',
        desc: 'Fallas críticas al auditar la interoperabilidad con estándares privativos heredados y bases de datos históricas. Se generan bloqueos sistemáticos al intercambiar formatos propietarios con entidades y proveedores externos.',
        consequence: 'Parches improvisados, silos de datos aislados y alta resistencia al cambio en los operadores institucionales.',
    },
    {
        id: 'sin-metodo',
        num: '03',
        kicker: 'RIESGO ESTRUCTURAL',
        title: 'Migración a Ciegas sin Método Formal Vinculante',
        desc: 'Nueve de cada diez entidades migran sin una ponderación cuantitativa de factores. La adopción se convierte en una apuesta intuitiva carente de respaldo bibliográfico y evidencia científica irrefutable.',
        consequence: 'Orfandad técnica y vulnerabilidad irreversible ante la discontinuación o desvío de librerías críticas.',
    },
];

interface Props {
    scrollProgress: number; // 0 (Hero) a 1 (Sección 2 montada al 100%)
    cardProgress: number;   // 0 a 1 (Controla el flujo de humo entre los 3 puntos)
    exitProgress?: number;  // 0 a 1 (Salida al entrar la Sección 3 Metodología)
}

export const LandingProblemSection: React.FC<Props> = memo(({
    scrollProgress,
    cardProgress,
    exitProgress = 0,
}) => {
    // Si la sección no está en rango de interacción ni visibilidad, desmontar del DOM para ahorrar memoria y GPU
    if (scrollProgress <= 0.001 || exitProgress >= 0.999) {
        return null;
    }

    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    const maxSmokeBlur = isMobile ? 8 : 20;

    // Montaje cinemático de la sección sobre el Hero
    const translateY = (1 - scrollProgress) * 100;
    const contentOpacity = Math.min(Math.max((scrollProgress - 0.2) / 0.8, 0), 1);

    // Salida coordinada hacia la izquierda al entrar la Metodología
    const exitOpacity = Math.max(1 - exitProgress * 1.2, 0);
    const exitTranslateX = -exitProgress * 30;

    // Cálculo dinámico del efecto Smoke para cada uno de los 3 puntos:
    // Punto 0: visible de 0.00 a 0.38 (máximo en 0.12)
    // Punto 1: visible de 0.28 a 0.72 (máximo en 0.50)
    // Punto 2: visible de 0.62 a 1.00 (máximo de 0.80 a 1.00 para que se lea con total calma)
    const getSmokeState = (idx: number) => {
        let opacity = 0;
        let blur = maxSmokeBlur;
        let scale = 1.04;
        let yOffset = 20;

        if (idx === 0) {
            if (cardProgress <= 0.22) {
                opacity = 1;
                blur = 0;
                scale = 1.0;
                yOffset = 0;
            } else if (cardProgress < 0.38) {
                const p = (cardProgress - 0.22) / 0.16; // 0 a 1
                opacity = Math.max(0, 1 - p);
                blur = p * maxSmokeBlur;
                scale = 1.0 + p * 0.04;
                yOffset = -p * 25; // Disipación hacia arriba como humo
            }
        } else if (idx === 1) {
            if (cardProgress > 0.26 && cardProgress < 0.44) {
                const p = (cardProgress - 0.26) / 0.18; // Entrando
                opacity = p;
                blur = (1 - p) * maxSmokeBlur;
                scale = 0.96 + p * 0.04;
                yOffset = (1 - p) * 25;
            } else if (cardProgress >= 0.44 && cardProgress <= 0.58) {
                opacity = 1;
                blur = 0;
                scale = 1.0;
                yOffset = 0;
            } else if (cardProgress > 0.58 && cardProgress < 0.74) {
                const p = (cardProgress - 0.58) / 0.16; // Saliendo
                opacity = Math.max(0, 1 - p);
                blur = p * maxSmokeBlur;
                scale = 1.0 + p * 0.04;
                yOffset = -p * 25;
            }
        } else if (idx === 2) {
            if (cardProgress > 0.62 && cardProgress < 0.78) {
                const p = (cardProgress - 0.62) / 0.16; // Entrando
                opacity = p;
                blur = (1 - p) * maxSmokeBlur;
                scale = 0.96 + p * 0.04;
                yOffset = (1 - p) * 25;
            } else if (cardProgress >= 0.78) {
                // Se mantiene al 100% hasta el final del scroll para poder leerse holgadamente
                opacity = 1;
                blur = 0;
                scale = 1.0;
                yOffset = 0;
            }
        }

        return { opacity, blur, scale, yOffset, isVisible: opacity > 0.01 };
    };

    return (
        <section
            id="problema"
            className="fixed inset-0 w-full h-screen max-h-screen overflow-hidden bg-black/95 backdrop-blur-md z-20 flex flex-col justify-center pt-20 sm:pt-24 lg:pt-24 px-4 sm:px-10 lg:px-16 select-none will-change-transform"
            style={{
                transform: `translate3d(${exitTranslateX}%, ${translateY}%, 0)`,
                opacity: contentOpacity * exitOpacity,
                pointerEvents: (scrollProgress > 0.4 && exitProgress < 0.4) ? 'auto' : 'none',
                boxShadow: '0 -4px 30px rgba(16,185,129,0.2), 0 -25px 60px rgba(0,0,0,0.95)',
            }}
        >
            {/* Atmósfera de niebla orgánica de fondo con Gradiente Radial de cero cómputo GPU */}
            <div
                className="absolute top-1/3 right-1/4 w-[650px] h-[650px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.045) 0%, rgba(16, 185, 129, 0.012) 50%, transparent 70%)',
                }}
            />

            <div
                className="relative z-10 w-full max-w-7xl mx-auto flex flex-col justify-center h-full max-h-[calc(100vh-4.5rem)] sm:max-h-[calc(100vh-5.5rem)] py-2 transition-all duration-300 overflow-y-auto lg:overflow-visible"
                style={{
                    opacity: contentOpacity,
                }}
            >
                {/* ── GRID PRINCIPAL: COLUMNA IZQUIERDA LIBRE (PARA GUIOS) + TEXTO EDITORIAL ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-10 items-center">
                    
                    {/* Espacio reservado para las letras cinéticas GUIOS a la izquierda */}
                    <div className="hidden lg:flex lg:col-span-3 xl:col-span-3 flex-col items-center justify-center pointer-events-none">
                        <div className="h-64 sm:h-80 w-full flex items-center justify-center opacity-0">
                            <span className="font-mono text-xs">GUIOS COLUMN</span>
                        </div>
                    </div>

                    {/* Manifiesto Editorial Puro (Sin cajas ni borders de tarjetas) */}
                    <div className="lg:col-span-9 xl:col-span-9 flex flex-col justify-center gap-3 sm:gap-6">
                        
                        {/* Cabecera Principal */}
                        <div>
                            <h2 className="text-xl sm:text-3xl lg:text-5xl font-sans font-light tracking-tight text-white leading-tight">
                                La Ilusión del <span className="font-semibold text-emerald-400">Costo Cero</span>:
                                <br />
                                <span className="text-slate-400 font-light text-base sm:text-2xl lg:text-3xl">
                                    Por qué fracasan las migraciones a ciegas.
                                </span>
                            </h2>
                        </div>

                        {/* Métrica 90%: Formato Editorial Libre (Sin caja rectangular rígida) */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-8 pb-2.5 sm:pb-3 border-b border-white/[0.07]">
                            <div className="flex items-baseline gap-1 shrink-0">
                                <span className="text-3xl sm:text-5xl lg:text-6xl font-sans font-extralight tracking-tighter text-white">
                                    90
                                </span>
                                <span className="text-xl sm:text-3xl font-sans font-light text-emerald-400">
                                    %
                                </span>
                                <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-slate-400 leading-tight block">
                                    Sin Marco<br />Formal
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-sm text-slate-300 font-light leading-relaxed max-w-2xl">
                                Nueve de cada diez entidades adoptan software libre sin una metodología cuantitativa,
                                transformando una promesa de ahorro en una crisis de soporte e interoperabilidad.
                            </p>
                        </div>

                        {/* ── ESCENARIO EDITORIAL DINÁMICO TIPO SMOKE (SIN CAJAS NI BORDERS) ── */}
                        <div className="relative w-full min-h-[220px] sm:min-h-[200px] lg:min-h-[220px] flex items-center">
                            {PROBLEM_POINTS.map((pt, idx) => {
                                const smoke = getSmokeState(idx);
                                if (!smoke.isVisible) return null;

                                return (
                                    <div
                                        key={pt.id}
                                        className="absolute inset-0 flex flex-col justify-center will-change-transform will-change-filter pointer-events-none"
                                        style={{
                                            opacity: smoke.opacity,
                                            transform: `translate3d(0, ${smoke.yOffset}px, 0) scale(${smoke.scale})`,
                                            filter: smoke.blur > 0.5 ? `blur(${smoke.blur.toFixed(1)}px)` : 'none',
                                        }}
                                    >
                                        {/* Marca de agua tipográfica numeral (Efecto editorial flotante) */}
                                        <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
                                            <span className="font-mono text-2xl sm:text-4xl font-extralight text-emerald-400/30">
                                                {pt.num}
                                            </span>
                                            <span className="h-[1px] w-5 sm:w-6 bg-emerald-500/30" />
                                            <span className="font-mono text-[9px] sm:text-xs font-bold tracking-[0.25em] uppercase text-emerald-400">
                                                {pt.kicker}
                                            </span>
                                        </div>

                                        {/* Título de impacto libre de contenedor */}
                                        <h3 className="text-base sm:text-2xl lg:text-3xl font-sans font-normal text-white mb-2 sm:mb-3 tracking-tight leading-snug">
                                            {pt.title}
                                        </h3>

                                        {/* Texto narrativo */}
                                        <p className="text-xs sm:text-sm md:text-base text-slate-300 font-light leading-relaxed max-w-3xl mb-2 sm:mb-3">
                                            {pt.desc}
                                        </p>

                                        {/* Llamado de impacto institucional (Estilo cita editorial) */}
                                        <div className="flex items-start gap-2 text-slate-400">
                                            <ArrowDownRight size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                            <p className="text-[11px] sm:text-sm font-light leading-snug text-slate-300 italic">
                                                {pt.consequence}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
});

export default LandingProblemSection;
