/**
 * features/landing/components/LandingFodaDictamenSection.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Sección 5: Matriz FODA y Dictamen Final Institucional (#dictamen)
 *
 * Propósito:
 * Mostrar qué entrega el sistema como resultado final de una evaluación formal.
 *
 * Estructura:
 * - Columna Izquierda: Componente FodaPuzzle interactivo en formato 2x2 tipo rompecabezas rústico.
 *   Permite hacer clic en cada cuadrante (F, O, D, A) para ver su desglose metodológico.
 * - Columna Derecha: Visualización ejecutiva de los 3 Veredictos Vinculantes:
 *   🟢 Recomendación A | Adopción Favorable (Cumplimiento PM ≥ 3.0, solo F u O).
 *   🟡 Recomendación B | Adopción Condicionada (Debilidades/amenazas solo en IR = 2).
 *   🔴 Recomendación C | Adopción Pospuesta (Debilidades/amenazas en factores de impacto alto IR ≥ 3).
 */

import React, { useState, memo } from 'react';
import FodaPuzzle, { type FodaPieceId } from './FodaPuzzle';
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    ArrowUpRight,
    FileSpreadsheet,
    FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
    mountProgress: number; // 0 a 1 (montaje de la sección al hacer scroll)
    exitProgress?: number; // 0 a 1 (salida hacia el footer)
    viewportWidth?: number;
}

interface FodaDetail {
    title: string;
    scope: 'Ámbito Interno' | 'Ámbito Externo';
    threshold: string;
    desc: string;
    impact: string;
}

const FODA_DETAILS: Record<FodaPieceId, FodaDetail> = {
    F: {
        title: 'Fortalezas (F)',
        scope: 'Ámbito Interno',
        threshold: 'Ponderación Media PM ≥ 3.0',
        desc: 'Capacidades organizacionales sólidas, infraestructura preparada y madurez técnica institucional para operar el software sin fricción.',
        impact: 'Si todos los factores relevantes son Fortalezas u Oportunidades, se emite la Recomendación A.',
    },
    O: {
        title: 'Oportunidades (O)',
        scope: 'Ámbito Externo',
        threshold: 'Ponderación Media PM ≥ 3.0',
        desc: 'Beneficios del ecosistema libre: interoperabilidad con estándares abiertos, comunidad activa, independencia tecnológica y ahorro de licencias.',
        impact: 'Maximiza el retorno de inversión y la soberanía de datos.',
    },
    D: {
        title: 'Debilidades (D)',
        scope: 'Ámbito Interno',
        threshold: 'Ponderación Media PM < 3.0',
        desc: 'Fricciones internas de la institución: resistencia cultural al cambio, necesidad de capacitación forzada o carencia de soporte técnico local.',
        impact: 'Si recae en factores de impacto alto (IR ≥ 3), detona la Recomendación C.',
    },
    A: {
        title: 'Amenazas (A)',
        scope: 'Ámbito Externo',
        threshold: 'Ponderación Media PM < 3.0',
        desc: 'Riesgos del entorno tecnológico: incompatibilidad con formatos legados privativos o discontinuación de versiones comunitarias.',
        impact: 'Exige formulación obligatoria de un Plan de Mitigación táctico.',
    },
};

export const LandingFodaDictamenSection: React.FC<Props> = memo(({
    mountProgress,
    exitProgress = 0,
    viewportWidth = 1440,
}) => {
    const [selectedPiece, setSelectedPiece] = useState<FodaPieceId>('F');
    const [activeVerdictTab, setActiveVerdictTab] = useState<'A' | 'B' | 'C'>('A');
    const [mobileTab, setMobileTab] = useState<'matriz' | 'dictamen'>('matriz');

    if (mountProgress <= 0.005 || exitProgress >= 0.99) {
        return null;
    }

    // La sección emerge deslizándose verticalmente desde abajo (translateY 100% -> 0%)
    const translateY = (1 - mountProgress) * 100;
    // Al salir, la sección se desplaza hacia arriba (-100%) al unísono con la entrada del footer desde abajo
    const exitTranslateY = -exitProgress * 100;
    const baseOpacity = Math.min(Math.max(mountProgress / 0.15, 0), 1);
    const exitFade = Math.max(1 - exitProgress * 1.2, 0);
    const opacity = baseOpacity * exitFade;

    // Progreso cinemático de ensamblado de las piezas:
    // Conforme la sección asciende y se asienta (mountProgress de 0.25 a 0.95),
    // las 4 piezas viajan desde los cuatro extremos hasta unirse con encaje perfecto.
    const assembleProgress = Math.min(Math.max((mountProgress - 0.20) / 0.75, 0), 1);

    const currentFoda = FODA_DETAILS[selectedPiece];

    // Tamaño responsive del rompecabezas (180px en celulares para dejar margen limpio)
    const puzzleSize = viewportWidth < 640 ? 180 : viewportWidth < 1024 ? 240 : 300;

    return (
        <section
            id="dictamen"
            className="fixed inset-0 w-full h-screen max-h-screen overflow-hidden bg-black z-35 select-none will-change-transform flex flex-col justify-between shadow-[0_-30px_70px_rgba(0,0,0,0.95)] border-t border-emerald-500/20"
            style={{
                opacity,
                transform: `translate3d(0, calc(${translateY}% + ${exitTranslateY}%), 0)`,
                pointerEvents: (mountProgress >= 0.8 && exitProgress < 0.2) ? 'auto' : 'none',
                visibility: opacity > 0.001 ? 'visible' : 'hidden',
            }}
        >
            {/* ── MALLA RADIAL Y LUCES ATMOSFÉRICAS (Zero-cost radial gradients) ── */}
            <div
                className="absolute top-1/3 -left-20 w-[550px] h-[550px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, rgba(16, 185, 129, 0.01) 50%, transparent 70%)',
                }}
            />
            <div
                className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.035) 0%, rgba(245, 158, 11, 0.008) 50%, transparent 70%)',
                }}
            />

            {/* ── CONTENIDO PRINCIPAL CENTRADO (pt-20 sm:pt-24 lg:pt-24) ── */}
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-10 lg:px-12 pt-20 sm:pt-24 lg:pt-24 pb-2 sm:pb-4 h-full flex flex-col justify-between overflow-y-auto lg:overflow-hidden">
                {/* 1. Cabecera Centrada y Compacta */}
                <div className="text-center max-w-2xl mx-auto pt-1 pb-1 shrink-0 z-30 relative">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="w-4 h-[1px] bg-emerald-400/50" />
                        <span className="font-mono text-[9px] sm:text-[11px] font-bold tracking-[0.25em] uppercase text-emerald-400">
                            RESULTADO FINAL VINCULANTE
                        </span>
                        <span className="w-4 h-[1px] bg-emerald-400/50" />
                    </div>
                    <h2 className="text-lg sm:text-2xl lg:text-3xl font-sans font-light tracking-tight text-white mb-1 leading-snug">
                        Matriz FODA y Veredicto Institucional Oficial
                    </h2>
                    <p className="text-[10px] sm:text-xs text-slate-400 font-light leading-relaxed max-w-xl mx-auto line-clamp-2 sm:line-clamp-none">
                        El sistema consolida la auditoría en una matriz 2x2 y emite una resolución formal vinculante, categorizada en tres dictámenes normativos orientados a la toma de decisiones.
                    </p>

                    {/* Selector de Pestaña Exclusivo para Móviles (< lg) */}
                    <div className="flex lg:hidden items-center justify-center p-1 rounded-xl bg-white/[0.05] border border-white/[0.08] max-w-xs mx-auto mt-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setMobileTab('matriz')}
                            className={`flex-1 py-1 px-3 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                mobileTab === 'matriz'
                                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Matriz FODA
                        </button>
                        <button
                            type="button"
                            onClick={() => setMobileTab('dictamen')}
                            className={`flex-1 py-1 px-3 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                mobileTab === 'dictamen'
                                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Dictámenes A/B/C
                        </button>
                    </div>
                </div>

                {/* 2. Escenario Central en Dos Columnas (En móvil muestra la pestaña activa; en lg: muestra ambas) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-10 items-center my-auto py-2 flex-1 min-h-0">
                    {/* ── COLUMNA IZQUIERDA: ROMPECABEZAS CLÁSICO FODA ── */}
                    <div className={`${mobileTab === 'matriz' ? 'flex' : 'hidden'} lg:flex lg:col-span-5 flex-col items-center justify-center`}>
                        <div className="relative flex flex-col items-center">
                            {/* Componente FodaPuzzle Clásico SVG */}
                            <FodaPuzzle
                                size={puzzleSize}
                                gap={0}
                                assembleProgress={assembleProgress}
                                selectedPiece={selectedPiece}
                                onSelect={(piece) => setSelectedPiece(piece)}
                            />

                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1.5 sm:mt-2">
                                Toca una pieza para explorar su criterio
                            </span>
                        </div>

                        {/* Ficha Descriptiva del Cuadrante Seleccionado (Obsidian Card sin backdrop-blur costoso) */}
                        <div className="w-full max-w-[380px] mt-2 sm:mt-3 p-2.5 sm:p-3 rounded-xl bg-neutral-950/90 border border-white/[0.08] shadow-lg">
                            <div className="flex items-center justify-between border-b border-white/[0.06] pb-1.5 mb-1.5">
                                <span className="font-mono text-xs font-bold text-emerald-300">
                                    {currentFoda.title}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 px-2 py-0.5 rounded bg-white/[0.04]">
                                    {currentFoda.scope}
                                </span>
                            </div>
                            <div className="text-[10px] font-mono text-emerald-400/90 mb-1">
                                {currentFoda.threshold}
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-300 font-light leading-relaxed">
                                {currentFoda.desc}
                            </p>
                            <div className="text-[10px] text-slate-400 mt-1 sm:mt-1.5 pt-1 sm:pt-1.5 border-t border-white/[0.05] italic">
                                {currentFoda.impact}
                            </div>
                        </div>
                    </div>

                    {/* ── COLUMNA DERECHA: LOS 3 VEREDICTOS VINCULANTES ── */}
                    <div className={`${mobileTab === 'dictamen' ? 'flex' : 'hidden'} lg:flex lg:col-span-7 flex-col justify-center space-y-2 sm:space-y-3`}>
                        {/* Selector de Veredictos (Pestañas Rápidas) */}
                        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mr-1">
                                Dictámenes:
                            </span>
                            <button
                                type="button"
                                onClick={() => setActiveVerdictTab('A')}
                                className={`px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                                    activeVerdictTab === 'A'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                                        : 'text-slate-400 hover:text-white border border-transparent'
                                }`}
                            >
                                Recomendación A
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveVerdictTab('B')}
                                className={`px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                                    activeVerdictTab === 'B'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                                        : 'text-slate-400 hover:text-white border border-transparent'
                                }`}
                            >
                                Recomendación B
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveVerdictTab('C')}
                                className={`px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                                    activeVerdictTab === 'C'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                                        : 'text-slate-400 hover:text-white border border-transparent'
                                }`}
                            >
                                Recomendación C
                            </button>
                        </div>

                        {/* Tarjeta 1: Recomendación A */}
                        <div
                            onClick={() => setActiveVerdictTab('A')}
                            className={`p-2.5 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                                activeVerdictTab === 'A'
                                    ? 'bg-emerald-950/25 border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.12)]'
                                    : 'bg-black/40 border-white/[0.06] opacity-75 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                    <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-300">
                                        Recomendación A | Adopción Favorable
                                    </h4>
                                </div>
                                <span className="font-mono text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    PM ≥ 3.0
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-300 font-light leading-relaxed pl-5 sm:pl-6">
                                Cumplimiento verificado. Todos los factores relevantes son <strong className="text-emerald-300 font-medium">Fortalezas</strong> u <strong className="text-emerald-300 font-medium">Oportunidades</strong> (sin debilidades ni amenazas). Se recomienda adoptar sin observaciones.
                            </p>
                        </div>

                        {/* Tarjeta 2: Recomendación B */}
                        <div
                            onClick={() => setActiveVerdictTab('B')}
                            className={`p-2.5 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                                activeVerdictTab === 'B'
                                    ? 'bg-amber-950/25 border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.12)]'
                                    : 'bg-black/40 border-white/[0.06] opacity-75 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                                    <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-300">
                                        Recomendación B | Adopción Condicionada
                                    </h4>
                                </div>
                                <span className="font-mono text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    IR = 2 Opcional
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-300 font-light leading-relaxed pl-5 sm:pl-6">
                                Se detectan debilidades o amenazas exclusivamente en factores de importancia relativa opcional (<span className="text-amber-300 font-mono">IR = 2</span>) y no superan en número a las fortalezas y oportunidades. La adopción es viable con un plan de acción preventivo.
                            </p>
                        </div>

                        {/* Tarjeta 3: Recomendación C */}
                        <div
                            onClick={() => setActiveVerdictTab('C')}
                            className={`p-2.5 sm:p-3.5 rounded-xl border transition-all cursor-pointer ${
                                activeVerdictTab === 'C'
                                    ? 'bg-rose-950/25 border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.12)]'
                                    : 'bg-black/40 border-white/[0.06] opacity-75 hover:opacity-100'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <XCircle size={15} className="text-rose-400 shrink-0" />
                                    <h4 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-300">
                                        Recomendación C | Adopción Pospuesta
                                    </h4>
                                </div>
                                <span className="font-mono text-[9px] sm:text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    IR ≥ 3 Crítico
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-300 font-light leading-relaxed pl-5 sm:pl-6">
                                Hay debilidades o amenazas en factores de alto impacto (<span className="text-rose-300 font-mono">IR ≥ 3</span>), o bien estas superan en número a las fortalezas y oportunidades. Se sugiere analizar la adopción y posponerla hasta contar con recursos o planes de mitigación.
                            </p>
                        </div>

                        {/* Botón de Acción Directa para Iniciar Evaluación */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-0 text-xs font-mono text-slate-400 border-t border-white/[0.06]">
                            <div className="flex items-center gap-3 text-[10px] sm:text-[11px]">
                                <span className="flex items-center gap-1.5 text-slate-300">
                                    <FileText size={13} className="text-emerald-400" /> Dossier PDF
                                </span>
                                <span className="text-white/20">•</span>
                                <span className="flex items-center gap-1.5 text-slate-300">
                                    <FileSpreadsheet size={13} className="text-emerald-400" /> Matriz Excel
                                </span>
                            </div>

                            <Link
                                to="/evaluar"
                                className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.35)] cursor-pointer"
                            >
                                <span>Iniciar Evaluación Oficial</span>
                                <ArrowUpRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
});

export default LandingFodaDictamenSection;
