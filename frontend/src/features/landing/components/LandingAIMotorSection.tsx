/**
 * features/landing/components/LandingAIMotorSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sección 4: Motor de Inteligencia Artificial (#motor-ia)
 *
 * Coreografía Scroll-Driven:
 * 1. Título y subtítulo centrados con elegancia en la parte superior.
 * 2. Para cada una de las 3 fases (Paso 1, 2 y 3):
 *    - La TabletMockup entra en el centro de la pantalla perfectamente equilibrada
 *      y en alta definición (sin colisionar con el texto superior ni con la barra inferior).
 *    - Conforme avanza el scroll, la tablet se desplaza con suavidad hacia la derecha
 *      hasta su posición final.
 *    - En el espacio que queda libre a la izquierda, aparece y se ubica el texto
 *      explicativo con rigor metodológico (sin códigos de requerimiento RN-001, RN-01, etc.).
 *    - Al continuar el scroll, la escena se disuelve y da paso a la siguiente tablet.
 */

import React, { useMemo, memo } from 'react';
import TabletMockup from './TabletMockup';
import paso1Img from '../../../assets/landing/img/paso1.webp';
import paso2Img from '../../../assets/landing/img/paso2.webp';
import paso3Img from '../../../assets/landing/img/paso3.webp';
import { Sparkles } from 'lucide-react';

interface Props {
    mountProgress: number;     // 0 a 1 (montaje de la sección tras el zoom de IA)
    stepProgress?: number;     // 0 a 1 (controla la entrada, traslación y paso de las 3 tablets)
    exitProgress?: number;     // 0 a 1 (desvanecimiento al pasar a la sección de FODA)
    viewportWidth?: number;
}

interface StepItem {
    num: string;
    kicker: string;
    title: string;
    desc: string;
    highlight: string;
    img: string;
    alt: string;
}

const STEPS: StepItem[] = [
    {
        num: '01',
        kicker: 'FASE 1: FACTORES Y DECISOR',
        title: 'Mapeo Bibliográfico y Calibración Decisora',
        desc: 'El motor de IA rastrea literatura técnica indexada y repositorios oficiales del software candidato y el sistema cuenta las fuentes verificables para calcular la razón de citación. Esa Importancia de la Literatura se combina con la del experto (Importancia Sugerida) y se calibra frente a la prioridad del Decisor institucional, fijando la Importancia Relativa y descartando solo los factores con IR = 1.',
        highlight: 'Filtro de Relevancia: avanzan a la auditoría técnica los factores con IR ≥ 2 (Opcional, Importante o Fundamental).',
        img: paso1Img,
        alt: 'Paso 1: Configuración de Factores y Ponderación de Decisor en GUIOS',
    },
    {
        num: '02',
        kicker: 'FASE 2: CALIFICACIÓN DE SUBFACTORES',
        title: 'Auditoría Técnica de Criterios y Ponderación Media',
        desc: 'Para cada factor seleccionado, la IA asiste en la auditoría individual de sus afirmaciones técnicas bajo una escala de 4 niveles (No cumple, Desconozco, Cumple parcialmente, Cumple), aportando justificaciones concisas que usted revisa y confirma. El sistema consolida la Ponderación Media del Factor y la contrasta frente al umbral de aptitud.',
        highlight: 'Ponderación Media: promedio simple de las calificaciones, redondeado a 1 decimal, frente al umbral de aptitud (PM ≥ 3.0).',
        img: paso2Img,
        alt: 'Paso 2: Calificación de Subfactores y Ponderación Media en GUIOS',
    },
    {
        num: '03',
        kicker: 'FASE 3: MATRIZ FODA Y DICTAMEN FINAL',
        title: 'Matriz FODA y Emisión del Dictamen Vinculante',
        desc: 'Los factores calificados se clasifican en los cuatro cuadrantes FODA según su ámbito operativo y el umbral de aptitud. La cascada de IA (Azure OpenAI como modelo primario con contingencia en Groq, Cohere y motor heurístico local) redacta el Resumen Ejecutivo formal y formula el Plan de Mitigación específico para la Alta Dirección, formalizando la Recomendación Oficial vinculante.',
        highlight: 'Dictamen: recomendación A, B o C calculada por reglas deterministas, con resumen ejecutivo y plan de mitigación.',
        img: paso3Img,
        alt: 'Paso 3: Matriz FODA y Dictamen Final Institucional en GUIOS',
    },
];

export const LandingAIMotorSection: React.FC<Props> = memo(({
    mountProgress,
    stepProgress = 0,
    exitProgress = 0,
    viewportWidth = 1440,
}) => {
    // Transición de entrada suave de la sección general
    const baseOpacity = Math.min(Math.max((mountProgress - 0.1) / 0.9, 0), 1);
    const exitFade = Math.max(1 - exitProgress * 1.5, 0);
    const sectionOpacity = baseOpacity * exitFade;
    const sectionScale = 0.96 + 0.04 * baseOpacity;

    const isDesktop = viewportWidth >= 1024;
    const containerWidth = Math.min(viewportWidth - 80, 1280);
    // Distancia exacta para trasladar la tablet al centro horizontal del viewport
    const offsetToCenter = isDesktop ? containerWidth * 0.22 : 0;

    // ── Cálculo Cinemático Independiente para cada uno de los 3 Pasos ──
    const stepsAnimation = useMemo(() => {
        const stepSegment = 1.0 / 3.0; // ~0.333

        return STEPS.map((_, idx) => {
            const stepStart = idx * stepSegment;

            // Progreso local de este paso: 0 a 1
            const localProgress = Math.min(
                Math.max((stepProgress - stepStart) / stepSegment, 0),
                1
            );

            // 1. Visibilidad general del paso
            let stepOpacity = 0;
            if (localProgress <= 0.12) {
                stepOpacity = localProgress / 0.12;
            } else if (localProgress < 0.85) {
                stepOpacity = 1;
            } else if (idx < 2) {
                stepOpacity = Math.max(1 - (localProgress - 0.85) / 0.15, 0);
            } else {
                stepOpacity = 1;
            }

            // 2. Transición de la Tablet:
            // - De 0.0 a 0.12: La tablet está en el centro, perfectamente equilibrada.
            // - De 0.12 a 0.55: La tablet se desplaza hacia la derecha a su posición final.
            // - De 0.55 a 1.0: La tablet se queda en su posición final fija.
            let dockProgress = 0;
            if (localProgress <= 0.12) {
                dockProgress = 0;
            } else if (localProgress >= 0.55) {
                dockProgress = 1;
            } else {
                const rawDock = (localProgress - 0.12) / 0.43;
                dockProgress =
                    rawDock < 0.5
                        ? 4 * rawDock * rawDock * rawDock
                        : 1 - Math.pow(-2 * rawDock + 2, 3) / 2;
            }

            // Escala calibrada: 1.15 al entrar (nunca colisiona con el texto ni con la barra de tareas) -> 1.0 al atracar
            const tabletTranslateX = (1 - dockProgress) * -offsetToCenter;
            const tabletScale = isDesktop
                ? 1.0 + (1 - dockProgress) * 0.16
                : 1.0 + (1 - dockProgress) * 0.06;

            // 3. Aparición del Texto en el Espacio Vacío:
            let textOpacity = 0;
            let textTranslateX = 0;
            if (dockProgress > 0.20) {
                const textProgress = Math.min((dockProgress - 0.20) / 0.80, 1);
                textOpacity = textProgress;
                textTranslateX = (1 - textProgress) * -25;
            }

            return {
                stepOpacity,
                dockProgress,
                tabletTranslateX,
                tabletScale,
                textOpacity,
                textTranslateX,
            };
        });
    }, [stepProgress, isDesktop, offsetToCenter]);

    // Si la sección no está montada o ya salió completamente, no renderizar
    if (mountProgress <= 0.01 || exitProgress >= 0.99) {
        return null;
    }

    return (
        <section
            id="motor-ia"
            className="fixed inset-0 w-full h-screen max-h-screen overflow-hidden bg-black z-30 select-none will-change-transform flex flex-col justify-between"
            style={{
                opacity: sectionOpacity,
                transform: `scale(${sectionScale}) translate3d(0, ${-exitProgress * 20}%, 0)`,
                pointerEvents: (mountProgress > 0.4 && exitProgress < 0.5) ? 'auto' : 'none',
            }}
        >
            {/* ── MALLA RADIAL OBSIDIANA CON SUTIL RESPLANDOR ESMERALDA (Cero coste de blur shader) ── */}
            <div
                className="absolute top-1/4 -right-20 w-[550px] h-[550px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.01) 50%, transparent 70%)',
                }}
            />
            <div
                className="absolute -bottom-20 -left-20 w-[450px] h-[450px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(6, 78, 59, 0.06) 0%, rgba(6, 78, 59, 0.015) 50%, transparent 70%)',
                }}
            />

            {/* ── CONTENIDO PRINCIPAL CENTRADO Y AJUSTADO AL VIEWPORT (pt-20 sm:pt-24 lg:pt-24) ── */}
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-10 lg:px-12 pt-20 sm:pt-24 lg:pt-24 pb-2 sm:pb-4 h-full flex flex-col justify-between overflow-hidden">
                {/* 1. Título y Subtítulo Centrados y Compactos en la Parte Superior (Sin colisión con Navbar en móviles) */}
                <div className="text-center max-w-2xl mx-auto pt-1 pb-1 shrink-0 z-30 relative">
                    <h2 className="text-sm sm:text-2xl lg:text-3xl font-sans font-light tracking-tight text-white mb-1 sm:mb-1.5 leading-snug">
                        Evidencia Bibliográfica sin Alucinaciones y Dictamen Autónomo.
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-light leading-relaxed max-w-xl mx-auto line-clamp-2 sm:line-clamp-none">
                        El motor de IA elimina la subjetividad organizacional: escanea literatura indexada, audita los 61 subfactores del catálogo y emite un veredicto vinculante con mitigación determinista.
                    </p>
                </div>

                {/* 2. Escenario Central: Espacio Vacío a la Izquierda + Tablet Mockup Dinámica */}
                <div className="relative w-full flex-1 flex items-center justify-center my-auto min-h-0 overflow-visible">
                    {STEPS.map((step, idx) => {
                        const anim = stepsAnimation[idx];

                        // Ocultar del DOM si el paso no está activo
                        if (anim.stepOpacity <= 0.005) {
                            return null;
                        }

                        return (
                            <div
                                key={step.num}
                                className="absolute inset-0 w-full h-full flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-3 sm:gap-6 lg:gap-10 will-change-transform"
                                style={{
                                    opacity: anim.stepOpacity,
                                    pointerEvents: anim.stepOpacity > 0.5 ? 'auto' : 'none',
                                }}
                            >
                                {/* ── COLUMNA IZQUIERDA: TEXTO QUE APARECE EN EL ESPACIO VACÍO ── */}
                                <div
                                    className="w-full lg:w-[42%] max-w-[460px] flex flex-col justify-center will-change-transform shrink-0"
                                    style={{
                                        opacity: anim.textOpacity,
                                        transform: `translate3d(${anim.textTranslateX}px, 0, 0)`,
                                        pointerEvents: anim.textOpacity > 0.5 ? 'auto' : 'none',
                                    }}
                                >
                                    {/* Kicker y Número */}
                                    <div className="flex items-center gap-2 mb-1 sm:mb-2">
                                        <span className="font-mono text-[11px] sm:text-xs font-bold text-emerald-400 tracking-wider">
                                            {step.num}.
                                        </span>
                                        <div className="h-[1px] w-5 sm:w-6 bg-emerald-500/40" />
                                        <span className="font-mono text-[9px] sm:text-[11px] font-bold tracking-[0.2em] uppercase text-emerald-400">
                                            {step.kicker}
                                        </span>
                                    </div>

                                    {/* Título de la Fase */}
                                    <h3 className="font-mono text-xs sm:text-base font-bold uppercase tracking-wider text-white mb-1 sm:mb-2">
                                        {step.title}
                                    </h3>

                                    {/* Descripción Metodológica Factual (Limpia sin requerimientos RN-001) */}
                                    <p className="text-[11px] sm:text-[13px] text-slate-300 font-light leading-relaxed mb-2 sm:mb-3.5 line-clamp-3 sm:line-clamp-none">
                                        {step.desc}
                                    </p>

                                    {/* Highlight de la regla técnica (Alto contraste sin coste de backdrop-blur) */}
                                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-black/85 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] sm:text-[11px] flex items-start gap-2 sm:gap-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                                        <Sparkles size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                                        <span className="leading-snug">{step.highlight}</span>
                                    </div>
                                </div>

                                {/* ── COLUMNA DERECHA: TABLET MOCKUP QUE VIAJA DESDE EL CENTRO ── */}
                                <div className="w-full lg:w-[58%] flex items-center justify-center shrink-0">
                                    <div
                                        className="w-full relative flex items-center justify-center will-change-transform"
                                        style={{
                                            transform: `translate3d(${anim.tabletTranslateX}px, 0, 0) scale(${anim.tabletScale})`,
                                            transformOrigin: 'center center',
                                            zIndex: anim.dockProgress < 0.6 ? 25 : 10,
                                        }}
                                    >
                                        <TabletMockup
                                            src={step.img}
                                            alt={step.alt}
                                            className="w-full max-w-[280px] sm:max-w-[420px] lg:max-w-[570px] xl:max-w-[610px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
});

export default LandingAIMotorSection;
