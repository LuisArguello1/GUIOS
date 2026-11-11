/**
 * features/landing/components/TabletMockup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente TabletMockup:
 * Renderiza una captura de pantalla dentro de un marco de tablet en orientación horizontal.
 *
 * Especificaciones:
 * - Construido exclusivamente con JSX y CSS nativo (sin librerías de UI externas).
 * - Marco con bisel oscuro (#0b0b0f), bordes redondeados y cámara frontal centrada.
 * - Pantalla con aspect-ratio 16:10 y resplandor verde esmeralda (#10b981).
 * - La imagen se renderiza tal cual mediante <img> con object-fit: cover y object-position: top.
 */

import React, { memo } from 'react';
import './TabletMockup.css';

export interface TabletMockupProps {
    /** Ruta de la imagen de captura de pantalla */
    src: string;
    /** Texto alternativo para accesibilidad (opcional, tiene valor por defecto descriptivo) */
    alt?: string;
    /** Clases adicionales opcionales para el contenedor externo */
    className?: string;
}

export const TabletMockup: React.FC<TabletMockupProps> = memo(({
    src,
    alt = 'Captura de pantalla de la plataforma GUIOS',
    className = '',
}) => {
    return (
        <div className={`tablet-mockup-wrapper ${className}`}>
            <div className="tablet-mockup-frame">
                {/* Cámara frontal centrada en el bisel superior */}
                <div className="tablet-mockup-camera" aria-hidden="true" />

                {/* Pantalla de la tablet con proporción 16:9 / 16:10 */}
                <div className="tablet-mockup-screen">
                    <img
                        src={src}
                        alt={alt}
                        className="tablet-mockup-image"
                        loading="eager"
                        decoding="async"
                    />
                </div>
            </div>
        </div>
    );
});

export default TabletMockup;
