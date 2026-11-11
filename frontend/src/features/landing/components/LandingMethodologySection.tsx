/**
 * features/landing/components/LandingMethodologySection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sección 3: Metodología GUIOS (#metodologia)
 *
 * Cinemática Scroll-Driven:
 * - Deslizamiento suave desde la DERECHA (translateX 100% -> 0%).
 * - Video del Cuaderno Científico en Pantalla Completa sin estorbos ni letras encima.
 * - Posicionado limpiamente por DEBAJO de la barra de navegación (pt-20).
 * - Reproducción 100% controlada por el SCROLL (Scrubbing ultra-fluido con LERP a 60fps).
 */

import React, { useRef, useEffect, memo } from 'react';
import libroMp4 from '../../../assets/landing/video/libro.mp4';
import libroWebm from '../../../assets/landing/video/libro.webm';

interface Props {
    mountProgress: number; // 0 (fuera a la derecha) a 1 (montado en pantalla)
    videoProgress: number; // 0 a 1 (reproducción del video de 0% a 100%)
    exitProgress?: number; // 0 a 1 (desvanecimiento por zoom de transición hacia el motor de IA)
}

export const LandingMethodologySection: React.FC<Props> = memo(({
    mountProgress,
    videoProgress,
    exitProgress = 0,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Referencias para el motor de interpolación suave (LERP)
    const targetTimeRef = useRef(0);
    const currentTimeRef = useRef(0);
    const isSeekingRef = useRef(false);
    const lastSeekStampRef = useRef(0);

    // Desvanecimiento suave cuando las letras IA inician el zoom
    const exitOpacity = Math.max(1 - exitProgress * 1.5, 0);

    // Estado activo: el motor LERP solo se ejecuta cuando la sección está dentro del campo visual
    const isVisible = mountProgress > 0.001 && exitOpacity > 0.001;
    const isActiveScrubbing = mountProgress > 0.05 && exitProgress < 0.95;

    // 1. Entrada desde la derecha: translateX de 100% a 0%
    const translateX = (1 - mountProgress) * 100;

    // 2. Mapear videoProgress (0 a 1) al tiempo objetivo del video
    useEffect(() => {
        const video = videoRef.current;
        const duration = video?.duration || 16.05;
        // Mapear de 0 al final exacto del video
        const target = Math.min(
            Math.max(videoProgress * duration, 0),
            Math.max(duration - 0.02, 0)
        );
        targetTimeRef.current = target;
    }, [videoProgress]);

    // 3. Motor LERP en requestAnimationFrame para scrubbing de video ultra-fluido (solo activo cuando la sección es visible)
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Si la sección no está en rango activo de scrubbing, detener RAF y pausar
        if (!isActiveScrubbing) {
            if (!video.paused) video.pause();
            return;
        }

        video.pause();

        const onSeeking = () => {
            isSeekingRef.current = true;
            lastSeekStampRef.current = performance.now();
        };

        const onSeeked = () => {
            isSeekingRef.current = false;
        };

        const onLoaded = () => {
            video.pause();
        };

        video.addEventListener('seeking', onSeeking);
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('loadedmetadata', onLoaded);

        let rafId: number;

        const updatePlayhead = () => {
            const target = targetTimeRef.current;
            const current = currentTimeRef.current;
            const diff = target - current;
            const now = performance.now();

            // Desbloqueo de seguridad si el navegador tarda en disparar 'seeked'
            if (isSeekingRef.current && now - lastSeekStampRef.current > 120) {
                isSeekingRef.current = false;
            }

            // Interpolación exponencial suave (factor 0.22 para máxima reactividad sin tirones)
            if (Math.abs(diff) > 0.004) {
                const smoothed = current + diff * 0.22;
                currentTimeRef.current = smoothed;

                // Throttle de seeking (mínimo ~28ms entre seeks): previene saturación de colas en decodificadores de GPU
                if (!isSeekingRef.current && video.readyState >= 2 && (now - lastSeekStampRef.current > 28)) {
                    try {
                        video.currentTime = smoothed;
                        lastSeekStampRef.current = now;
                    } catch {
                        // Ignorar errores transitorios si el elemento no está listo
                    }
                }
            } else if (!isSeekingRef.current && Math.abs(video.currentTime - target) > 0.02 && video.readyState >= 2) {
                video.currentTime = target;
                currentTimeRef.current = target;
            }

            rafId = requestAnimationFrame(updatePlayhead);
        };

        rafId = requestAnimationFrame(updatePlayhead);

        return () => {
            cancelAnimationFrame(rafId);
            video.removeEventListener('seeking', onSeeking);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('loadedmetadata', onLoaded);
        };
    }, [isActiveScrubbing]);

    return (
        <section
            className={`fixed inset-0 w-full h-screen max-h-screen overflow-hidden bg-black z-30 select-none will-change-transform ${
                mountProgress > 0.05 && exitOpacity > 0.08 ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
            style={{
                transform: `translate3d(${translateX}%, 0, 0)`,
                opacity: exitOpacity,
                visibility: isVisible ? 'visible' : 'hidden',
                boxShadow: '-25px 0 90px rgba(0,0,0,0.98), -2px 0 25px rgba(16,185,129,0.3)',
            }}
        >
            {/* ── CONTENEDOR DEL VIDEO POSICIONADO POR DEBAJO DEL NAVBAR (pt-20 = 80px) ── */}
            <div className="w-full h-full pt-20 flex items-center justify-center overflow-hidden bg-black">
                <video
                    ref={videoRef}
                    muted
                    playsInline
                    controls={false}
                    autoPlay={false}
                    preload="auto"
                    disablePictureInPicture
                    className="w-full h-full object-contain pointer-events-none will-change-transform"
                >
                    <source src={libroWebm} type="video/webm" />
                    <source src={libroMp4} type="video/mp4" />
                </video>
            </div>
        </section>
    );
});

export default LandingMethodologySection;
