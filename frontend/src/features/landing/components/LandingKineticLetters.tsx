/**
 * features/landing/components/LandingKineticLetters.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa cinética de letras 3D compartida entre el Hero y la Sección de Problema.
 *
 * Ajustes de espaciado:
 * - En el Hero: espaciado horizontal ampliado significativamente (185px) con escala 0.88,
 *   garantizando que las letras NUNCA se vean amontonadas o pegadas.
 * - En Sección 2: espaciado vertical holgado (115px) y centrado.
 * - Sin líneas verdes y sin textos diminutos: letras escultóricas puras en 3D.
 */

import React, { useMemo, memo } from 'react';

// Letras 3D esculpidas de alta definición
import letterG from '../../../assets/landing/img/G.webp';
import letterU from '../../../assets/landing/img/U.webp';
import letterI from '../../../assets/landing/img/I.webp';
import letterO from '../../../assets/landing/img/O.webp';
import letterS from '../../../assets/landing/img/S.webp';

interface KineticLetter {
    char: string;
    img: string;
}

const LETTERS: KineticLetter[] = [
    { char: 'G', img: letterG },
    { char: 'U', img: letterU },
    { char: 'I', img: letterI },
    { char: 'O', img: letterO },
    { char: 'S', img: letterS },
];

interface Props {
    scrollProgress: number; // 0 (Hero) a 1 (Problema montado al 100%)
    exitProgress?: number;  // 0 a 1 (Salida al entrar la Sección 3 Metodología)
    viewportWidth: number;
    viewportHeight: number;
    mouseTilt?: { x: number; y: number };
}

export const LandingKineticLetters: React.FC<Props> = memo(({
    scrollProgress,
    exitProgress = 0,
    viewportWidth,
    viewportHeight,
    mouseTilt = { x: 0, y: 0 },
}) => {
    // Si la Metodología ya entró por completo, desmontar las letras del DOM
    if (exitProgress >= 0.98) {
        return null;
    }

    const isMobile = viewportWidth < 768;
    const isTablet = viewportWidth >= 768 && viewportWidth < 1024;

    // En móviles/tablets, una vez que las letras se han disuelto completamente, desmontar del DOM
    if ((isMobile || isTablet) && scrollProgress >= 0.55) {
        return null;
    }

    // Desvanecimiento y vuelo de salida hacia la izquierda al entrar la Sección 3
    const exitOpacity = Math.max(0, 1 - exitProgress * 1.3);
    const exitTranslateX = -exitProgress * 220;

    // En pantallas móviles/tablets (< 1024px), las letras se disuelven suavemente al entrar a la Sección 2
    // para no solaparse con el texto editorial en pantallas estrechas. En desktop se mantienen en la columna izquierda.
    const mobileFade = isMobile || isTablet ? Math.max(0, 1 - scrollProgress * 2.2) : 1;
    const effectiveOpacity = exitOpacity * mobileFade;

    // Cálculo de posiciones de vuelo dinámicas para cada una de las 5 letras
    const letterTransforms = useMemo(() => {
        // Estado A: Hero (Fila horizontal centrada con amplio espacio entre letras)
        const heroCenterX = viewportWidth / 2;
        const heroCenterY = viewportHeight * 0.46;
        // Espaciado horizontal amplio para que respiren con elegancia
        const heroSpacingX = isMobile ? 68 : isTablet ? 120 : 185;
        const heroScale = isMobile ? 0.44 : isTablet ? 0.68 : 0.88;

        // Estado B: Sección Problema (Columna vertical holgada a la izquierda)
        const targetX = isMobile
            ? viewportWidth * 0.12
            : isTablet
            ? viewportWidth * 0.14
            : Math.max(90, viewportWidth * 0.13);
        const targetCenterY = viewportHeight * 0.5;
        // Espaciado vertical holgado (115px en desktop)
        const targetSpacingY = isMobile
            ? Math.min(68, (viewportHeight - 160) / 5)
            : Math.min(115, (viewportHeight - 160) / 4.4);
        const targetScale = isMobile ? 0.32 : isTablet ? 0.42 : 0.46;

        return LETTERS.map((_, i) => {
            const indexOffset = i - 2; // -2, -1, 0, 1, 2

            // Posición inicial en Hero
            const startX = heroCenterX + indexOffset * heroSpacingX;
            const startY = heroCenterY;

            // Posición final en Problema
            const endX = targetX;
            const endY = targetCenterY + indexOffset * targetSpacingY;

            // Escalonamiento cinemático de despegue
            const delay = i * 0.08;
            const duration = 0.62;
            const rawP = Math.min(Math.max((scrollProgress - delay) / duration, 0), 1);

            // Easing cúbico de alta inercia
            const easeP =
                rawP < 0.5
                    ? 4 * rawP * rawP * rawP
                    : 1 - Math.pow(-2 * rawP + 2, 3) / 2;

            // Arco parabólico en el aire
            const arcOffset = Math.sin(easeP * Math.PI) * (30 - Math.abs(indexOffset) * 8);

            // Interpolación de coordenadas
            const x = startX + (endX - startX) * easeP;
            const y = startY + (endY - startY) * easeP - arcOffset;
            const scale = heroScale + (targetScale - heroScale) * easeP;

            // Rotación sutil durante el vuelo
            const flightRotation = Math.sin(easeP * Math.PI) * (indexOffset * 6);

            // Tilt del cursor (en móviles se fija en 0 para evitar costos de GPU innecesarios)
            const tiltFactor = isMobile ? 0 : Math.max(0, 1 - scrollProgress * 0.8);
            const tiltX = mouseTilt.x * tiltFactor;
            const tiltY = mouseTilt.y * tiltFactor;

            return {
                x,
                y,
                scale,
                rotation: flightRotation,
                tiltX,
                tiltY,
            };
        });
    }, [scrollProgress, viewportWidth, viewportHeight, isMobile, isTablet, mouseTilt]);

    return (
        <div
            className="fixed inset-0 pointer-events-none z-30 overflow-hidden select-none transition-opacity duration-200"
            style={{
                opacity: effectiveOpacity,
                transform: `translate3d(${exitTranslateX}px, 0, 0)`,
                visibility: effectiveOpacity > 0.001 ? 'visible' : 'hidden',
            }}
        >
            {/* ── Las 5 Letras 3D (Optimizadas con Aceleración por Hardware) ── */}
            {LETTERS.map((item, idx) => {
                const tf = letterTransforms[idx];
                const floatClass =
                    scrollProgress <= 0.05
                        ? `animate-letter-float-${idx}`
                        : scrollProgress >= 0.95
                        ? `animate-letter-float-${idx}`
                        : '';

                return (
                    <div
                        key={item.char}
                        className="absolute top-0 left-0 flex items-center justify-center will-change-transform"
                        style={{
                            transform: `translate3d(${tf.x}px, ${tf.y}px, 0) translate(-50%, -50%) rotate(${tf.rotation}deg) scale(${tf.scale}) perspective(1000px) rotateX(${tf.tiltY}deg) rotateY(${tf.tiltX}deg)`,
                        }}
                    >
                        {/* Halo de luz esmeralda detrás de cada letra (Gradiente Radial de Cero Costo en Blur GPU) */}
                        <div
                            className="absolute -inset-6 rounded-full pointer-events-none"
                            style={{
                                background:
                                    scrollProgress > 0.8
                                        ? 'radial-gradient(circle, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.06) 50%, transparent 70%)'
                                        : 'radial-gradient(circle, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.05) 50%, transparent 70%)',
                            }}
                        />

                        {/* Imagen de la letra 3D con sombra optimizada */}
                        <div className={`relative ${floatClass}`}>
                            <img
                                src={item.img}
                                alt={`Letra ${item.char}`}
                                className="w-24 sm:w-32 md:w-36 lg:w-40 xl:w-44 h-auto object-contain filter drop-shadow-[0_16px_30px_rgba(0,0,0,0.85)]"
                                loading="eager"
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

export default LandingKineticLetters;
