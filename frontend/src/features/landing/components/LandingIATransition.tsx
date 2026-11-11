/**
 * features/landing/components/LandingIATransition.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de Transición Cinemática de las Letras 3D "IA".
 *
 * Coreografía Scroll-Driven:
 * 1. Fase Aparición (appearProgress 0 -> 1):
 *    - Las letras 3D "I" y "A" emergen suavemente flotando encima del video del libro.
 *    - Brillo esmeralda volumétrico, tipografía de cristal y reacción dinámica al ratón (3D Tilt).
 *
 * 2. Fase Zoom-In (zoomProgress 0 -> 1):
 *    - Cámara atraviesa las letras: escalan de 1.0x a 9.5x con desenfoque óptico de profundidad (bokeh).
 *    - Las letras se separan ligeramente hacia los laterales conforme vuelan hacia el espectador.
 *    - Se desvanecen al cruzar el plano de la cámara, revelando el Motor de IA.
 */

import React, { memo } from 'react';
import letterI from '../../../assets/landing/img/I.webp';
import letterA from '../../../assets/landing/img/A.webp';

interface Props {
    appearProgress: number; // 0 a 1 (Aparición encima del video)
    zoomProgress: number;   // 0 a 1 (Zoom de acercamiento a través de las letras)
    viewportWidth: number;
    viewportHeight: number;
    mouseTilt?: { x: number; y: number };
}

export const LandingIATransition: React.FC<Props> = memo(({
    appearProgress,
    zoomProgress,
    viewportWidth,
    viewportHeight,
    mouseTilt = { x: 0, y: 0 },
}) => {
    // Si no está en rango de visibilidad, no renderizar nada para ahorrar GPU
    if (appearProgress <= 0.01 || zoomProgress >= 0.98) {
        return null;
    }

    const isMobile = viewportWidth < 768;
    const isTablet = viewportWidth >= 768 && viewportWidth < 1024;

    // 1. Cálculo de Escala Cinemática y Opacidad
    // Curva cúbica para el zoom: inicia suave y acelera como un vuelo espacial
    const zoomScale = 1.0 + Math.pow(zoomProgress, 2.4) * 8.5;
    const baseScale = isMobile ? 0.65 : isTablet ? 0.85 : 1.0;
    const currentScale = baseScale * (0.7 + appearProgress * 0.3) * zoomScale;

    // Desvanecimiento óptico: se mantiene 100% visible y empieza a disolverse al pasar el 35% del zoom
    const fadeOut = zoomProgress < 0.35 ? 1 : Math.max(1 - (zoomProgress - 0.35) / 0.55, 0);
    const overallOpacity = Math.min(Math.max(appearProgress, 0), 1) * fadeOut;

    // Desenfoque de lente macro (Depth of Field bokeh) adaptativo
    const maxBokeh = isMobile ? 6 : 12;
    const blurAmount = Math.min(zoomProgress * 14, maxBokeh);

    // 2. Coordenadas y dispersión lateral durante el vuelo de cámara
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight * 0.48;
    const baseSpacing = isMobile ? 70 : isTablet ? 110 : 150;
    // Las letras se abren sutilmente hacia los lados para dar paso al observador
    const spreadMultiplier = 1.0 + zoomProgress * 1.8;
    const letterSpacing = (baseSpacing / 2) * spreadMultiplier;

    // 3. Inclinación 3D con el cursor del ratón (desactivada en móvil y suavemente amortiguada durante el zoom)
    const tiltDamping = isMobile ? 0 : Math.max(0, 1 - zoomProgress * 1.5);
    const tiltX = (mouseTilt.x || 0) * tiltDamping;
    const tiltY = (mouseTilt.y || 0) * tiltDamping;

    return (
        <div
            className="fixed inset-0 pointer-events-none z-40 overflow-hidden select-none flex items-center justify-center will-change-transform"
            style={{
                opacity: overallOpacity,
                filter: blurAmount > 0.5 ? `blur(${blurAmount.toFixed(1)}px)` : 'none',
            }}
        >
            {/* ── AURA VOLUMÉTRICA ESMERALDA EN EL CENTRO ── */}
            <div
                className="absolute w-[450px] sm:w-[600px] h-[450px] sm:h-[600px] rounded-full pointer-events-none transition-all duration-300"
                style={{
                    background:
                        'radial-gradient(circle, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.08) 45%, transparent 70%)',
                    transform: `scale(${zoomScale * 0.8})`,
                    opacity: 1 - zoomProgress * 0.9,
                }}
            />

            {/* ── LETRA "I" 3D ── */}
            <div
                className="absolute top-0 left-0 flex items-center justify-center will-change-transform"
                style={{
                    transform: `translate3d(${centerX - letterSpacing}px, ${centerY}px, 0) translate(-50%, -50%) scale(${currentScale}) perspective(1000px) rotateX(${tiltY}deg) rotateY(${tiltX}deg)`,
                }}
            >
                <img
                    src={letterI}
                    alt="Letra I"
                    className="w-28 sm:w-36 md:w-44 lg:w-52 h-auto object-contain filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.85)]"
                    loading="eager"
                />
            </div>

            {/* ── LETRA "A" 3D ── */}
            <div
                className="absolute top-0 left-0 flex items-center justify-center will-change-transform"
                style={{
                    transform: `translate3d(${centerX + letterSpacing}px, ${centerY}px, 0) translate(-50%, -50%) scale(${currentScale}) perspective(1000px) rotateX(${tiltY}deg) rotateY(${tiltX}deg)`,
                }}
            >
                <img
                    src={letterA}
                    alt="Letra A"
                    className="w-28 sm:w-36 md:w-44 lg:w-52 h-auto object-contain filter drop-shadow-[0_16px_32px_rgba(0,0,0,0.85)]"
                    loading="eager"
                />
            </div>

            {/* ── LEYENDA EDITORIAL DE INMERSIÓN (Visible al aparecer, se disuelve antes del zoom) ── */}
            {zoomProgress < 0.28 && (
                <div
                    className="absolute text-center flex flex-col items-center gap-2 pointer-events-none transition-all duration-300"
                    style={{
                        top: `${centerY + (isMobile ? 100 : 140)}px`,
                        opacity: Math.max(0, (appearProgress - 0.4) / 0.6) * (1 - zoomProgress * 3.5),
                        transform: `translateY(${zoomProgress * -20}px)`,
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <span className="w-6 h-[1px] bg-emerald-400/50" />
                        <span className="font-mono text-[10px] sm:text-xs font-bold tracking-[0.35em] uppercase text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]">
                            NÚCLEO COGNITIVO GUIOS
                        </span>
                        <span className="w-6 h-[1px] bg-emerald-400/50" />
                    </div>
                    <span className="font-sans text-xs sm:text-sm font-light text-slate-300 tracking-wide">
                        Inmersión al Motor de Inteligencia Científica
                    </span>
                </div>
            )}
        </div>
    );
});

export default LandingIATransition;
