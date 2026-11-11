/**
 * features/landing/components/FodaPuzzle.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Componente FodaPuzzle:
 * Matriz FODA en formato 2x2 como rompecabezas clásico vectorial (SVG puro).
 *
 * Características:
 * - 4 piezas: F (arriba-izq), O (arriba-der), D (abajo-izq), A (abajo-der).
 * - Lengüetas clásicas redondas de rompecabezas con encaje exacto:
 *   - F: Lengüeta hacia la derecha (hacia O) y hacia abajo (hacia D).
 *   - O: Hueco a la izquierda (recibe F) y hueco abajo (recibe A).
 *   - D: Hueco arriba (recibe F) y lengüeta a la derecha (hacia A).
 *   - A: Lengüeta hacia arriba (hacia O) y hueco a la izquierda (recibe D).
 * - Relleno sólido #33DAA5, contorno blanco (#FFFFFF) de 2.5px con stroke-linejoin="round".
 * - Letras blancas (#FFFFFF) gruesas (800) y nítidas centradas en cada cuadrante.
 * - Animación de ensamblado: cada pieza se desliza desde diferentes posiciones y rotaciones
 *   para unirse y formar el rompecabezas completo.
 * - Hover interactivo una vez ensamblado (desplazamiento de 6px hacia afuera).
 * - Accesibilidad completa: role="button", tabIndex, aria-label y teclado (Enter/Espacio).
 * - Respeta prefers-reduced-motion.
 */

import React, { useCallback, useEffect, useState, memo } from 'react';

export type FodaPieceId = 'F' | 'O' | 'D' | 'A';

export interface FodaPuzzleProps {
    /** Tamaño del SVG en píxeles (ancho y alto). Por defecto 400 */
    size?: number;
    /** Separación en píxeles entre las piezas cuando están armadas (por defecto 0) */
    gap?: number;
    /** Progreso de ensamblado de 0 (piezas dispersas) a 1 (rompecabezas armado) */
    assembleProgress?: number;
    /** Si debe auto-ensamblarse con animación al montarse (por defecto true si assembleProgress no se pasa) */
    autoAssemble?: boolean;
    /** Callback disparado al hacer click o presionar Enter/Espacio en una pieza */
    onSelect?: (piece: FodaPieceId) => void;
    /** Pieza actualmente seleccionada */
    selectedPiece?: FodaPieceId | null;
    /** Clases CSS adicionales */
    className?: string;
}

// ── TRAYECTORIAS VECTORIALES EXACTAS (ViewBox 200x200, centro en 100,100) ──
// Cada unión cuenta con el negativo matemático inverso exacto para encajar con tolerancia cero.

const PIECE_PATHS: Record<FodaPieceId, string> = {
    // F (Arriba-Izquierda):
    // Inicia en (0,0) -> línea a (100,0) -> lengüeta clásica hacia la derecha (+X en O) ->
    // centro (100,100) -> lengüeta clásica hacia abajo (+Y en D) -> (0,100) -> sube a (0,0)
    F: 'M 0 0 L 100 0 L 100 36 C 100 38, 102.5 41, 106 41 C 109.5 41, 111 36, 117 36 C 123.5 36, 127 43, 127 50 C 127 57, 123.5 64, 117 64 C 111 64, 109.5 59, 106 59 C 102.5 59, 100 62, 100 64 L 100 100 L 64 100 C 62 100, 59 102.5, 59 106 C 59 109.5, 64 111, 64 117 C 64 123.5, 57 127, 50 127 C 43 127, 36 123.5, 36 117 C 36 111, 41 109.5, 41 106 C 41 102.5, 38 100, 36 100 L 0 100 L 0 0 Z',

    // O (Arriba-Derecha):
    // Inicia en (100,0) -> (200,0) -> (200,100) -> hueco inferior (recibe lengüeta de A hacia arriba) ->
    // centro (100,100) -> hueco izquierdo (recibe lengüeta de F) -> (100,0)
    O: 'M 100 0 L 200 0 L 200 100 L 164 100 C 162 100, 159 97.5, 159 94 C 159 90.5, 164 89, 164 83 C 164 76.5, 157 73, 150 73 C 143 73, 136 76.5, 136 83 C 136 89, 141 90.5, 141 94 C 141 97.5, 138 100, 136 100 L 100 100 L 100 64 C 100 62, 102.5 59, 106 59 C 109.5 59, 111 64, 117 64 C 123.5 64, 127 57, 127 50 C 127 43, 123.5 36, 117 36 C 111 36, 109.5 41, 106 41 C 102.5 41, 100 38, 100 36 L 100 0 Z',

    // D (Abajo-Izquierda):
    // Inicia en (0,100) -> hueco superior (recibe lengüeta de F) -> centro (100,100) ->
    // lengüeta derecha (+X en A) -> (100,200) -> (0,200) -> sube a (0,100)
    D: 'M 0 100 L 36 100 C 38 100, 41 102.5, 41 106 C 41 109.5, 36 111, 36 117 C 36 123.5, 43 127, 50 127 C 57 127, 64 123.5, 64 117 C 64 111, 59 109.5, 59 106 C 59 102.5, 62 100, 64 100 L 100 100 L 100 136 C 100 138, 102.5 141, 106 141 C 109.5 141, 111 136, 117 136 C 123.5 136, 127 143, 127 150 C 127 157, 123.5 164, 117 164 C 111 164, 109.5 159, 106 159 C 102.5 159, 100 162, 100 164 L 100 200 L 0 200 L 0 100 Z',

    // A (Abajo-Derecha):
    // Inicia en (100,100) -> lengüeta superior hacia arriba (-Y en O) -> (200,100) ->
    // (200,200) -> (100,200) -> hueco izquierdo (recibe lengüeta de D) -> centro (100,100)
    A: 'M 100 100 L 136 100 C 138 100, 141 97.5, 141 94 C 141 90.5, 136 89, 136 83 C 136 76.5, 143 73, 150 73 C 157 73, 164 76.5, 164 83 C 164 89, 159 90.5, 159 94 C 159 97.5, 162 100, 164 100 L 200 100 L 200 200 L 100 200 L 100 164 C 100 162, 102.5 159, 106 159 C 109.5 159, 111 164, 117 164 C 123.5 164, 127 157, 127 150 C 127 143, 123.5 136, 117 136 C 111 136, 109.5 141, 106 141 C 102.5 141, 100 138, 100 136 L 100 100 Z',
};

// Configuración de posición, textos y cinemática de dispersión
const PIECE_CONFIG: Record<
    FodaPieceId,
    {
        label: string;
        fullName: string;
        textPos: [number, number];
        dir: [number, number];            // Vector de hover hacia afuera (-1 a 1)
        scatterOffset: [number, number];  // Vector de dispersión inicial [dx, dy]
        scatterRotate: number;             // Grados de rotación cuando está dispersa
        origin: [number, number];          // Centro del cuadrante para la rotación
    }
> = {
    F: {
        label: 'F',
        fullName: 'Fortalezas',
        textPos: [45, 55],
        dir: [-1, -1],
        scatterOffset: [-70, -55],
        scatterRotate: -15,
        origin: [50, 50],
    },
    O: {
        label: 'O',
        fullName: 'Oportunidades',
        textPos: [155, 55],
        dir: [1, -1],
        scatterOffset: [75, -60],
        scatterRotate: 14,
        origin: [150, 50],
    },
    D: {
        label: 'D',
        fullName: 'Debilidades',
        textPos: [45, 155],
        dir: [-1, 1],
        scatterOffset: [-65, 65],
        scatterRotate: 12,
        origin: [50, 150],
    },
    A: {
        label: 'A',
        fullName: 'Amenazas',
        textPos: [155, 155],
        dir: [1, 1],
        scatterOffset: [70, 60],
        scatterRotate: -14,
        origin: [150, 150],
    },
};

export const FodaPuzzle: React.FC<FodaPuzzleProps> = memo(({
    size = 400,
    gap = 0,
    assembleProgress,
    autoAssemble = true,
    onSelect,
    selectedPiece,
    className = '',
}) => {
    const [hoveredPiece, setHoveredPiece] = useState<FodaPieceId | null>(null);
    const [internalAssemble, setInternalAssemble] = useState(
        assembleProgress !== undefined ? assembleProgress : (autoAssemble ? 0 : 1)
    );

    // Auto-ensamblado si no está controlado externamente por scroll
    useEffect(() => {
        if (assembleProgress === undefined && autoAssemble) {
            const timer = setTimeout(() => {
                setInternalAssemble(1);
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [assembleProgress, autoAssemble]);

    // Usar el progreso externo si está definido, o el interno
    const currentProgress = assembleProgress !== undefined ? assembleProgress : internalAssemble;

    const handlePieceClick = useCallback(
        (id: FodaPieceId) => {
            if (onSelect) {
                onSelect(id);
            }
        },
        [onSelect]
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent, id: FodaPieceId) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handlePieceClick(id);
            }
        },
        [handlePieceClick]
    );

    const pieceIds: FodaPieceId[] = ['F', 'O', 'D', 'A'];

    // Easing suave para la interpolación de ensamblado
    const p = Math.min(Math.max(currentProgress, 0), 1);
    // Smoothstep cúbico: 3p^2 - 2p^3
    const smoothFactor = p * p * (3 - 2 * p);
    const scatterFactor = 1 - smoothFactor;
    const isAssembled = p >= 0.85;

    return (
        <div
            className={`relative flex items-center justify-center select-none ${className}`}
            style={{ width: size, height: size }}
        >
            <svg
                viewBox="0 0 200 200"
                width={size}
                height={size}
                className="overflow-visible"
                role="region"
                aria-label="Matriz FODA Rompecabezas Clásico"
            >
                {/* ── PIEZAS DEL ROMPECABEZAS ── */}
                {pieceIds.map((id) => {
                    const cfg = PIECE_CONFIG[id];
                    const isHovered = hoveredPiece === id;
                    const isSelected = selectedPiece === id;

                    // Desplazamiento exterior en hover (6px) cuando ya está ensamblado + gap base
                    const hoverDist = isHovered && isAssembled ? 6 : 0;
                    const totalOffset = (gap + hoverDist) * smoothFactor;

                    // Traslación compuesta: Dispersión -> Posición Ensamblada + Hover
                    const tx = cfg.scatterOffset[0] * scatterFactor + cfg.dir[0] * totalOffset;
                    const ty = cfg.scatterOffset[1] * scatterFactor + cfg.dir[1] * totalOffset;
                    const rot = cfg.scatterRotate * scatterFactor;

                    // Transición CSS: cuando es controlado por scroll usamos 'none' para seguimiento a 60fps instantáneo;
                    // cuando se dispara por auto-ensamblado usamos un ease elástico.
                    const transitionStyle =
                        assembleProgress !== undefined
                            ? 'none'
                            : 'transform 0.75s cubic-bezier(0.16, 1, 0.3, 1)';

                    return (
                        <g
                            key={id}
                            role="button"
                            tabIndex={0}
                            aria-label={cfg.fullName}
                            aria-pressed={isSelected}
                            onClick={() => handlePieceClick(id)}
                            onKeyDown={(e) => handleKeyDown(e, id)}
                            onMouseEnter={() => setHoveredPiece(id)}
                            onMouseLeave={() => setHoveredPiece(null)}
                            onFocus={() => setHoveredPiece(id)}
                            onBlur={() => setHoveredPiece(null)}
                            className="cursor-pointer outline-none group motion-reduce:transition-none focus-visible:outline-dashed focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-4 will-change-transform"
                            style={{
                                transform: `translate3d(${tx}px, ${ty}px, 0) rotate(${rot}deg)`,
                                transformOrigin: `${cfg.origin[0]}px ${cfg.origin[1]}px`,
                                transition: transitionStyle,
                            }}
                        >
                            {/* Halo luminoso al estar seleccionada */}
                            {isSelected && (
                                <path
                                    d={PIECE_PATHS[id]}
                                    fill="none"
                                    stroke="#FFFFFF"
                                    strokeWidth="6"
                                    strokeLinejoin="round"
                                    opacity="0.35"
                                    className="motion-reduce:animate-none animate-pulse"
                                />
                            )}

                            {/* Cuerpo de la pieza: Relleno sólido #33DAA5 y filo blanco #FFFFFF */}
                            <path
                                d={PIECE_PATHS[id]}
                                fill="#33DAA5"
                                stroke="#FFFFFF"
                                strokeWidth="2.5"
                                strokeLinejoin="round"
                                className="transition-all duration-200 group-hover:brightness-105"
                            />

                            {/* Letra blanca gruesa (800) nítida centrada en el cuadrante */}
                            <text
                                x={cfg.textPos[0]}
                                y={cfg.textPos[1]}
                                fill="#FFFFFF"
                                fontSize="30"
                                fontFamily="system-ui, -apple-system, sans-serif"
                                fontWeight="800"
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="pointer-events-none select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]"
                            >
                                {cfg.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EJEMPLO DE USO / DEMO INTERACTIVA
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const FodaPuzzleExample: React.FC = () => {
    const [selected, setSelected] = useState<FodaPieceId>('F');
    const [gap, setGap] = useState<number>(0);
    const [progress, setProgress] = useState<number>(1);

    const rearmar = () => {
        setProgress(0);
        setTimeout(() => setProgress(1), 80);
    };

    return (
        <div className="flex flex-col items-center p-6 bg-neutral-950 rounded-2xl border border-white/10 text-white max-w-lg mx-auto">
            <h3 className="text-base font-bold mb-4 font-mono uppercase text-emerald-400">
                Demostración FodaPuzzle Clásico
            </h3>

            <FodaPuzzle
                size={320}
                gap={gap}
                assembleProgress={progress}
                selectedPiece={selected}
                onSelect={(p) => setSelected(p)}
                className="my-4"
            />

            <div className="flex flex-col gap-3 mt-4 w-full text-xs font-mono">
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={rearmar}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold uppercase tracking-wider hover:bg-emerald-400 transition-colors"
                    >
                        Animar Ensamblado
                    </button>
                    <span>Pieza Activa: <strong>{selected}</strong></span>
                </div>

                <label className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                    <span>Separación (gap): {gap}px</span>
                    <input
                        type="range"
                        min={0}
                        max={16}
                        value={gap}
                        onChange={(e) => setGap(Number(e.target.value))}
                        className="cursor-pointer"
                    />
                </label>
            </div>
        </div>
    );
};

export default FodaPuzzle;
