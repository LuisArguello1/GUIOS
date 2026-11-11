/**
 * features/landing/LandingPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de aterrizaje de GUIOS estilo Editorial de Lujo en Tema Oscuro.
 *
 * Arquitectura Scroll-Driven Unificada:
 * - Sección 1 (Hero): Video de niebla y letras 3D en fila horizontal.
 * - Sección 2 (Problema): Se monta desde abajo (translateY 100% -> 0%), las letras
 *   se despegan en arco y se ubican en columna vertical, y los 3 puntos se revelan
 *   uno a uno con disolución tipo humo.
 * - Sección 3 (Metodología): Se desliza horizontalmente desde la DERECHA
 *   (translateX 100% -> 0%) con el video del cuaderno científico en pantalla completa,
 *   cuya reproducción se controla al 100% con el scroll.
 * - Transición IA (Zoom-In Cinemático):
 *   Al finalizar el video, las letras 3D "IA" se materializan encima del libro,
 *   y al continuar el scroll la cámara realiza un zoom de acercamiento atravesándolas.
 * - Sección 4 (Motor de IA):
 *   Emerge en pantalla completa con el rigor científico de GUIOS (Scopus, DOIs,
 *   61 subfactores, inferencia asíncrona Celery+Redis y consola de telemetría interactiva).
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import LandingNavbar from './components/LandingNavbar';
import LandingHero from './components/LandingHero';
import LandingProblemSection from './components/LandingProblemSection';
import LandingKineticLetters from './components/LandingKineticLetters';
import LandingMethodologySection from './components/LandingMethodologySection';
import LandingIATransition from './components/LandingIATransition';
import LandingAIMotorSection from './components/LandingAIMotorSection';
import LandingFodaDictamenSection from './components/LandingFodaDictamenSection';
import LandingFooter from './components/LandingFooter';

export const LandingPage: React.FC = () => {
    // Dimensiones de la ventana
    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1440
    );
    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== 'undefined' ? window.innerHeight : 900
    );

    // Progreso de montaje de la Sección 2 (0 a 1)
    const [mountProgress, setMountProgress] = useState(0);

    // Progreso de los puntos smoke dentro de la Sección 2 (0 a 1)
    const [cardProgress, setCardProgress] = useState(0);

    // Progreso de montaje de la Sección 3 desde la derecha (0 a 1)
    const [methodMountProgress, setMethodMountProgress] = useState(0);

    // Progreso del scrubbing del video en la Sección 3 (0 a 1)
    const [methodPageProgress, setMethodPageProgress] = useState(0);

    // Transición Cinemática IA (Aparición encima del video: 0 a 1)
    const [iaAppearProgress, setIaAppearProgress] = useState(0);

    // Transición Cinemática IA (Zoom de acercamiento a través de las letras: 0 a 1)
    const [iaZoomProgress, setIaZoomProgress] = useState(0);

    // Progreso de montaje de la Sección 4: Motor de IA (0 a 1)
    const [aiMountProgress, setAiMountProgress] = useState(0);

    // Progreso del recorrido de los 3 pasos en la Sección 4 (0 a 1)
    const [aiStepProgress, setAiStepProgress] = useState(0);

    // Progreso de salida de la Sección 4: Motor de IA (0 a 1)
    const [aiExitProgress, setAiExitProgress] = useState(0);

    // Progreso de montaje de la Sección 5: Matriz FODA y Dictamen (0 a 1)
    const [fodaMountProgress, setFodaMountProgress] = useState(0);

    // Progreso de salida de la Sección 5: Matriz FODA hacia el Footer (0 a 1)
    const [fodaExitProgress, setFodaExitProgress] = useState(0);

    // Progreso de montaje del Footer con fondo de video niebla (0 a 1)
    const [footerMountProgress, setFooterMountProgress] = useState(0);

    // Parallax suave con el ratón
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const mouseRafRef = useRef<number | null>(null);

    useEffect(() => {
        document.documentElement.classList.add('dark');

        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const vh = window.innerHeight || 1;
                    const y = window.scrollY;

                    // 1. Fase 1: Montaje de Sección 2 (scrollY: 0 a 1 vh)
                    const mProg = Math.min(Math.max(y / vh, 0), 1);
                    setMountProgress(mProg);

                    // 2. Fase 2: Puntos tipo smoke en Sección 2 (scrollY: 1 vh a 3.5 vh)
                    const smokeTrackHeight = vh * 2.5;
                    const cProg = Math.min(Math.max((y - vh) / smokeTrackHeight, 0), 1);
                    setCardProgress(cProg);

                    // 3. Fase 3: Entrada de Sección 3 desde la derecha (scrollY: 3.5 vh a 4.5 vh)
                    const methodInStart = vh * 3.5;
                    const methodInTrack = vh * 1.0;
                    const methMount = Math.min(Math.max((y - methodInStart) / methodInTrack, 0), 1);
                    setMethodMountProgress(methMount);

                    // 4. Fase 4: Reproducción completa del video del libro (scrollY: 4.5 vh a 8.5 vh)
                    const pageStart = vh * 4.5;
                    const pageTrack = vh * 4.0;
                    const pProg = Math.min(Math.max((y - pageStart) / pageTrack, 0), 1);
                    setMethodPageProgress(pProg);

                    // 5. Fase 5: Aparición de las letras 3D "IA" encima del video (scrollY: 8.5 vh a 9.5 vh)
                    const iaAppearStart = vh * 8.5;
                    const iaAppearTrack = vh * 1.0;
                    const iaApp = Math.min(Math.max((y - iaAppearStart) / iaAppearTrack, 0), 1);
                    setIaAppearProgress(iaApp);

                    // 6. Fase 6: Zoom de acercamiento atravesando las letras "IA" (scrollY: 9.5 vh a 11.0 vh)
                    const iaZoomStart = vh * 9.5;
                    const iaZoomTrack = vh * 1.5;
                    const iaZm = Math.min(Math.max((y - iaZoomStart) / iaZoomTrack, 0), 1);
                    setIaZoomProgress(iaZm);

                    // 7. Fase 7: Montaje y revelación de la Sección 4: Motor de IA (scrollY: 9.8 vh a 11.0 vh)
                    const aiStart = vh * 9.8;
                    const aiTrack = vh * 1.2;
                    const aiMnt = Math.min(Math.max((y - aiStart) / aiTrack, 0), 1);
                    setAiMountProgress(aiMnt);

                    // 8. Fase 8: Recorrido de los 3 Pasos del Evaluador en la Sección de IA (scrollY: 11.0 vh a 15.5 vh)
                    const stepStart = vh * 11.0;
                    const stepTrack = vh * 4.5;
                    const stepProg = Math.min(Math.max((y - stepStart) / stepTrack, 0), 1);
                    setAiStepProgress(stepProg);

                    // 9. Fase 9: Desvanecimiento y elevación de salida del Motor de IA (scrollY: 15.5 vh a 16.5 vh)
                    const aiExitStart = vh * 15.5;
                    const aiExitTrack = vh * 1.0;
                    const aiExt = Math.min(Math.max((y - aiExitStart) / aiExitTrack, 0), 1);
                    setAiExitProgress(aiExt);

                    // 10. Fase 10: Salida de la Sección 5 desde abajo del Motor de IA (scrollY: 15.5 vh a 16.5 vh)
                    const fodaStart = vh * 15.5;
                    const fodaTrack = vh * 1.0;
                    const fodaMnt = Math.min(Math.max((y - fodaStart) / fodaTrack, 0), 1);
                    setFodaMountProgress(fodaMnt);

                    // 11. Fase 11: Desvanecimiento y elevación de la Sección 5 hacia el Footer (scrollY: 18.5 vh a 19.5 vh)
                    const fodaExitStart = vh * 18.5;
                    const fodaExitTrack = vh * 1.0;
                    const fodaExt = Math.min(Math.max((y - fodaExitStart) / fodaExitTrack, 0), 1);
                    setFodaExitProgress(fodaExt);

                    // 12. Fase 12: Salida del Footer con video de niebla desde abajo de la Sección 5 (scrollY: 18.5 vh a 19.5 vh)
                    const footerStart = vh * 18.5;
                    const footerTrack = vh * 1.0;
                    const footMnt = Math.min(Math.max((y - footerStart) / footerTrack, 0), 1);
                    setFooterMountProgress(footMnt);

                    ticking = false;
                });
                ticking = true;
            }
        };

        const handleResize = () => {
            setViewportWidth(window.innerWidth);
            setViewportHeight(window.innerHeight);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        // Disparo inicial
        handleScroll();
        handleResize();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            if (mouseRafRef.current !== null) {
                window.cancelAnimationFrame(mouseRafRef.current);
            }
        };
    }, []);

    // Manejador del efecto Parallax 3D interactivo optimizado con requestAnimationFrame y threshold
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // En móviles o pantallas táctiles no calcular tilt (evita re-renders durante el scroll táctil)
        if (window.innerWidth < 768) return;
        if (mouseRafRef.current !== null) return;

        const clientX = e.clientX;
        const clientY = e.clientY;
        const w = window.innerWidth;
        const h = window.innerHeight;

        mouseRafRef.current = window.requestAnimationFrame(() => {
            const x = (clientX / w - 0.5) * 10;
            const y = -(clientY / h - 0.5) * 10;
            setTilt((prev) => {
                const newX = Number(x.toFixed(2));
                const newY = Number(y.toFixed(2));
                // Si la diferencia es menor a 0.2, reutilizar el estado anterior para evitar re-render
                if (Math.abs(prev.x - newX) < 0.2 && Math.abs(prev.y - newY) < 0.2) {
                    return prev;
                }
                return { x: newX, y: newY };
            });
            mouseRafRef.current = null;
        });
    }, []);

    return (
        <div
            onMouseMove={handleMouseMove}
            className="min-h-screen w-full bg-black text-slate-100 font-sans relative overflow-x-hidden selection:bg-emerald-500/30 selection:text-emerald-200"
        >
            {/* Barra de navegación estirada a todo lo ancho con opciones limpias */}
            <LandingNavbar />

            {/* ── 1. Capa Cinética de Letras 3D (GUIOS) ── */}
            <LandingKineticLetters
                scrollProgress={mountProgress}
                exitProgress={methodMountProgress}
                viewportWidth={viewportWidth}
                viewportHeight={viewportHeight}
                mouseTilt={tilt}
            />

            {/* ── 2. Hero Section (Fondo de niebla y textos perfectamente posicionados) ── */}
            <LandingHero scrollProgress={mountProgress} />

            {/* ── 3. Sección 2: El Problema (Se monta desde abajo + Puntos libres con efecto SMOKE) ── */}
            <LandingProblemSection
                scrollProgress={mountProgress}
                cardProgress={cardProgress}
                exitProgress={methodMountProgress}
            />

            {/* ── 4. Sección 3: Metodología GUIOS (Se desliza desde la DERECHA + Video Libro) ── */}
            <LandingMethodologySection
                mountProgress={methodMountProgress}
                videoProgress={methodPageProgress}
                exitProgress={iaZoomProgress}
            />

            {/* ── 5. Transición Cinemática: Letras 3D "IA" con Zoom de Acercamiento ── */}
            <LandingIATransition
                appearProgress={iaAppearProgress}
                zoomProgress={iaZoomProgress}
                viewportWidth={viewportWidth}
                viewportHeight={viewportHeight}
                mouseTilt={tilt}
            />

            {/* ── 6. Sección 4: Motor de Inteligencia Artificial (Emergencia en Pantalla Completa + Recorrido Paso a Paso) ── */}
            <LandingAIMotorSection
                mountProgress={aiMountProgress}
                stepProgress={aiStepProgress}
                exitProgress={aiExitProgress}
                viewportWidth={viewportWidth}
            />

            {/* ── 7. Sección 5: Matriz FODA y Veredicto Vinculante Oficial (#dictamen) ── */}
            <LandingFodaDictamenSection
                mountProgress={fodaMountProgress}
                exitProgress={fodaExitProgress}
                viewportWidth={viewportWidth}
            />

            {/* ── 8. Footer Editorial de Lujo con Fondo de Video Niebla (#contacto) ── */}
            <LandingFooter
                mountProgress={footerMountProgress}
            />

            {/* ── 9. Pista Virtual de Scroll (2200vh total: Hero + Problema + Metodología + Zoom IA + Motor IA + FODA + Footer con holgura de asentamiento) ── */}
            <div className="relative w-full h-[2200vh] pointer-events-none">
                {/* Anclajes para navegación directa */}
                <div id="inicio" className="absolute top-0 left-0 w-full h-screen pointer-events-none" />
                <div id="problema" className="absolute top-[100vh] left-0 w-full h-screen pointer-events-none" />
                <div id="metodologia" className="absolute top-[450vh] left-0 w-full h-screen pointer-events-none" />
                <div id="motor-ia" className="absolute top-[1100vh] left-0 w-full h-screen pointer-events-none" />
                <div id="dictamen" className="absolute top-[1650vh] left-0 w-full h-screen pointer-events-none" />
                <div id="contacto" className="absolute top-[2000vh] left-0 w-full h-screen pointer-events-none" />
            </div>
        </div>
    );
};

export default LandingPage;
