/**
 * features/landing/components/LandingHero.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Hero Section Editorial de Lujo.
 * - Fondo en bucle de video de niebla atmosférica (WebM con fallback MP4).
 * - Ocupa exactamente el 100% de la altura visible de la ventana (h-screen).
 * - Kicker y subtítulo posicionados con amplios márgenes verticales respecto
 *   a las letras 3D (para evitar cualquier solapamiento).
 * - Desvanecimiento suave al iniciar el scroll hacia la segunda sección.
 */

import React, { useRef, useEffect, memo } from 'react';
import nieblaWebm from '../../../assets/landing/video/niebla_loop.webm';
import nieblaMp4 from '../../../assets/landing/video/niebla_loop.mp4';

interface Props {
    scrollProgress: number; // 0 a 1
}

export const LandingHero: React.FC<Props> = memo(({ scrollProgress }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Ralentizar sutilmente el video de niebla para un efecto hipnótico
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.playbackRate = 0.85;
            videoRef.current.play().catch(() => {});
        }
    }, []);

    // Pausar el video cuando la sección ya no es visible para liberar recursos de GPU/CPU en móviles y laptops
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        if (scrollProgress >= 1) {
            if (!v.paused) v.pause();
        } else {
            if (v.paused) {
                v.play().catch(() => {});
            }
        }
    }, [scrollProgress >= 1]);

    // Desvanecimiento suave del texto editorial al iniciar el scroll
    const textOpacity = Math.max(0, 1 - scrollProgress * 3.5);
    const textTranslateY = -scrollProgress * 50;

    return (
        <section
            id="inicio"
            className="fixed inset-0 w-full h-screen overflow-hidden bg-black select-none z-10 pointer-events-none"
            style={{
                visibility: scrollProgress >= 1 ? 'hidden' : 'visible',
            }}
        >
            {/* ── 1. Fondo de Video en Bucle (Niebla Atmosférica optimizada con aceleración GPU) ── */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls={false}
                    preload="auto"
                    className="w-full h-full object-cover object-center scale-105 will-change-transform"
                    style={{
                        transform: `scale3d(${1.05 + scrollProgress * 0.08}, ${1.05 + scrollProgress * 0.08}, 1)`,
                    }}
                >
                    <source src={nieblaWebm} type="video/webm" />
                    <source src={nieblaMp4} type="video/mp4" />
                </video>
            </div>

            {/* ── 2. Halo de Luz / Spotlight Esmeralda Detrás de las Letras (Gradiente Radial de Alto Rendimiento sin Blur costoso) ── */}
            <div
                className="absolute top-[46%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[320px] max-w-full rounded-full pointer-events-none transition-opacity duration-300"
                style={{
                    opacity: textOpacity,
                    background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.16) 0%, rgba(16, 185, 129, 0.05) 50%, transparent 70%)',
                }}
            />

            {/* ── 3. Kicker Editorial Superior (Posicionado limpiamente arriba de las letras) ── */}
            <div
                className="absolute top-[30%] sm:top-[28%] left-1/2 -translate-x-1/2 text-center pointer-events-none w-full px-4 will-change-transform"
                style={{
                    opacity: textOpacity,
                    transform: `translate3d(0, ${textTranslateY}px, 0)`,
                }}
            >
                <span className="font-mono text-[11px] sm:text-xs font-bold tracking-[0.3em] uppercase text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]">
                    EVALUACIÓN Y AUDITORÍA TECNOLÓGICA
                </span>
            </div>

            {/* ── 4. Subtítulo Editorial Inferior (Posicionado limpiamente debajo de las letras) ── */}
            <div
                className="absolute top-[63%] sm:top-[64%] left-1/2 -translate-x-1/2 text-center pointer-events-none w-full max-w-2xl px-6 will-change-transform"
                style={{
                    opacity: textOpacity,
                    transform: `translate3d(0, ${textTranslateY}px, 0)`,
                }}
            >
                <p className="font-sans text-xs sm:text-sm md:text-base font-light tracking-[0.18em] text-slate-300 uppercase">
                    Marco Metodológico de Adopción de Software Libre
                </p>
            </div>

            {/* ── 5. Indicador Sutil de Scroll / Continuidad Inferior ── */}
            <div
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 transition-opacity duration-300 pointer-events-auto"
                style={{
                    opacity: Math.max(0, 1 - scrollProgress * 5),
                }}
            >
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-400">
                    Scroll
                </span>
                <div className="w-4 h-7 rounded-full border border-white/20 flex items-start justify-center p-1">
                    <div className="w-1 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                </div>
            </div>
        </section>
    );
});

export default LandingHero;
