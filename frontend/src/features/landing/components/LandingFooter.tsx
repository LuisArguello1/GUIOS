/**
 * features/landing/components/LandingFooter.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Footer Editorial de Lujo para GUIOS FLOSS.
 *
 * Características:
 * - Fondo cinemático con el video en bucle de la niebla atmosférica (WebM/MP4)
 *   en máxima definición y luminosidad visible (sin oscurecimientos excesivos).
 * - Pre-carga continua para que el video ya esté reproduciéndose fluidamente.
 * - Tarjetas con glassmorphism oscuro translúcido (bg-black/60 backdrop-blur-md)
 *   que aseguran legibilidad perfecta del texto mientras la niebla danza alrededor.
 * - Bloque de Call To Action institucional con accesos a /evaluar y /login.
 * - Grid de 4 columnas con identidad, metodología, entregables y veredictos.
 * - Colofón con derechos de autor y botón interactivo "Volver Arriba".
 */

import React, { useRef, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowUpRight,
    ArrowUp,
    LogIn,
    FileSpreadsheet,
    FileText,
    ShieldCheck,
    Cpu,
    ExternalLink,
    Sparkles,
} from 'lucide-react';
import nieblaWebm from '../../../assets/landing/video/niebla_loop.webm';
import nieblaMp4 from '../../../assets/landing/video/niebla_loop.mp4';
import useOrganizationStore from '../../../app/useOrganizationStore';

interface Props {
    mountProgress: number; // 0 a 1 (montaje deslizante desde abajo)
}

export const LandingFooter: React.FC<Props> = memo(({ mountProgress }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const topVideoRef = useRef<HTMLVideoElement>(null);
    const { organization, fetchOrganization } = useOrganizationStore();

    useEffect(() => {
        if (!organization) {
            fetchOrganization();
        }
    }, [organization, fetchOrganization]);

    // Si mountProgress es 0, mantenemos el video pausado fuera de pantalla para no saturar la GPU
    const isVisible = mountProgress > 0.001;
    const translateY = (1 - mountProgress) * 100;
    const opacity = Math.min(Math.max(mountProgress / 0.15, 0), 1);

    // Reproducción optimizada: pausar cuando no está en pantalla, reproducir cuando entra
    useEffect(() => {
        const v = videoRef.current;
        const v2 = topVideoRef.current;

        if (!isVisible) {
            if (v && !v.paused) v.pause();
            if (v2 && !v2.paused) v2.pause();
            return;
        }

        if (v) {
            v.playbackRate = 0.85;
            v.muted = true;
            if (v.paused) v.play().catch(() => {});
        }

        if (v2) {
            v2.playbackRate = 0.75;
            v2.muted = true;
            if (v2.paused) v2.play().catch(() => {});
        }
    }, [isVisible]);

    const orgDisplayName = organization?.name || 'UNIVERSIDAD ESTATAL DE MILAGRO';

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer
            id="contacto"
            className="fixed inset-0 w-full h-screen max-h-screen overflow-hidden bg-black z-40 select-none will-change-transform flex flex-col justify-between shadow-[0_-30px_70px_rgba(0,0,0,0.95)] border-t border-emerald-500/30"
            style={{
                opacity: isVisible ? opacity : 0,
                transform: `translate3d(0, ${translateY}%, 0)`,
                pointerEvents: mountProgress >= 0.95 ? 'auto' : 'none',
                visibility: isVisible ? 'visible' : 'hidden',
            }}
        >
            {/* ── 1. FONDO DE VIDEO DE NIEBLA EN BUCLE (Atmósfera integral en toda la pantalla) ── */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
                {/* Niebla inferior principal (oleaje ascendente) */}
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls={false}
                    preload="auto"
                    className="w-full h-full object-cover object-bottom scale-110 opacity-95 transition-opacity duration-500"
                >
                    <source src={nieblaWebm} type="video/webm" />
                    <source src={nieblaMp4} type="video/mp4" />
                </video>

                {/* Niebla superior difusa invertida (solo en desktop para no saturar GPUs móviles) */}
                <video
                    ref={topVideoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    controls={false}
                    preload="auto"
                    className="hidden md:block absolute -top-16 left-0 w-full h-[85%] object-cover object-bottom scale-y-[-1] opacity-40 mix-blend-screen pointer-events-none"
                >
                    <source src={nieblaWebm} type="video/webm" />
                    <source src={nieblaMp4} type="video/mp4" />
                </video>

                {/* Sutil viñeta para enmarcar el contenido sin oscurecer los contenedores */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45 pointer-events-none" />

                {/* Resplandores etéreos esmeralda y cian (Zero-cost radial gradients) */}
                <div
                    className="absolute top-1/4 left-1/4 w-[650px] h-[380px] rounded-full pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.12) 0%, rgba(16, 185, 129, 0.03) 50%, transparent 70%)',
                    }}
                />
                <div
                    className="absolute top-1/3 right-1/4 w-[550px] h-[360px] rounded-full pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(45, 212, 191, 0.08) 0%, rgba(45, 212, 191, 0.02) 50%, transparent 70%)',
                    }}
                />
                <div
                    className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.10) 0%, rgba(16, 185, 129, 0.02) 50%, transparent 70%)',
                    }}
                />
            </div>

            {/* ── 2. CONTENIDO PRINCIPAL DEL FOOTER (Área central flexible) ── */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-10 lg:px-12 pt-20 sm:pt-24 lg:pt-24 pb-3 sm:pb-4 flex-1 flex flex-col justify-start lg:justify-evenly overflow-y-auto lg:overflow-hidden gap-4 sm:gap-6">
                {/* ── 2.1 BLOQUE SUPERIOR HEROICO: CALL TO ACTION INSTITUCIONAL (Efecto Glass sin bordes de caja) ── */}
                <div className="p-3.5 sm:p-6 rounded-2xl bg-black/60 sm:bg-black/35 backdrop-blur-sm sm:backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.35)] shrink-0 transition-all duration-300">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
                                <span className="font-mono text-[9px] sm:text-[11px] font-bold tracking-[0.25em] uppercase text-emerald-400">
                                    CONVERGENCIA METODOLÓGICA & RIGOR TÉCNICO
                                </span>
                            </div>
                            <h2 className="text-lg sm:text-2xl lg:text-3xl font-sans font-light tracking-tight text-white mb-1.5 sm:mb-2 leading-snug">
                                Decisiones de Software Basadas en Evidencia, No en Supuestos.
                            </h2>
                            <p className="text-xs sm:text-[13px] text-slate-300 font-light leading-relaxed max-w-xl">
                                Automatice la auditoría técnica de 61 subfactores, calcule la literatura indexada y obtenga un dictamen vinculante con resolución formal para su organización.
                            </p>
                        </div>

                        {/* Botones de Acción Primaria */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0">
                            <Link
                                to="/evaluar"
                                className="relative group overflow-hidden px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black font-mono text-xs font-bold tracking-wider uppercase transition-all duration-300 shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] flex items-center justify-center gap-2 text-center cursor-pointer"
                            >
                                <span>Iniciar Evaluación Oficial</span>
                                <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </Link>

                            <Link
                                to="/login"
                                className="px-5 py-2.5 sm:py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white font-mono text-xs font-medium tracking-wider uppercase transition-all flex items-center justify-center gap-2 text-center"
                            >
                                <LogIn size={14} className="text-slate-400" />
                                <span>Acceso</span>
                            </Link>
                        </div>
                    </div>

                    {/* Pill de Telemetría de Estado del Motor */}
                    <div className="mt-3 pt-2.5 sm:mt-3.5 sm:pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-mono text-slate-400">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="flex items-center gap-1.5 text-emerald-300">
                                <Cpu size={12} className="text-emerald-400" /> Motor de IA en Cascada (Azure + Groq + Cohere)
                            </span>
                            <span className="text-white/20 hidden sm:inline">•</span>
                            <span className="text-slate-300">Catálogo: 61 Subfactores Indexados</span>
                            <span className="text-white/20 hidden sm:inline">•</span>
                            <span className="text-slate-300">Razón r_i y Cuartiles IL</span>
                        </div>
                        <span className="text-emerald-400/90 font-medium">
                            Protocolo Determinista Sin Alucinaciones
                        </span>
                    </div>
                </div>

                {/* ── 2.2 GRID ARQUITECTÓNICO DE 4 COLUMNAS (Efecto Glass sin bordes de caja) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 sm:gap-6 my-auto p-3.5 sm:p-6 rounded-2xl bg-black/60 sm:bg-black/35 backdrop-blur-sm sm:backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.35)] shrink-0">
                    {/* Columna 1: Identidad Institucional & Gobernanza (lg:col-span-4) */}
                    <div className="lg:col-span-4 flex flex-col justify-between space-y-2.5">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-lg font-black tracking-[0.2em] text-white uppercase">
                                    GUIOS
                                </span>
                                <span className="font-mono text-lg font-bold tracking-[0.2em] text-emerald-400 uppercase drop-shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                                    FLOSS
                                </span>
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1.5 font-bold">
                                {orgDisplayName}
                            </span>
                            <p className="text-xs text-slate-300 font-light leading-relaxed">
                                Marco metodológico formal para la evaluación cuantitativa, ponderación decisoria y dictamen vinculante de soluciones de software libre en el sector público y académico.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] backdrop-blur-sm text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                                <ShieldCheck size={12} className="text-emerald-400" /> ISO/IEC 25010
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-white/[0.06] backdrop-blur-sm text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                                <Sparkles size={12} className="text-emerald-400" /> Open Source Initiative
                            </span>
                        </div>
                    </div>

                    {/* Columna 2: Fases de la Metodología (lg:col-span-3) */}
                    <div className="lg:col-span-3 flex flex-col space-y-2">
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white pb-1">
                            Fases del Método
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-300 font-light">
                            <li className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-default">
                                <span className="text-emerald-400 font-mono text-[10px]">01.</span>
                                <span>Mapeo Bibliográfico y Decisor</span>
                            </li>
                            <li className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-default">
                                <span className="text-emerald-400 font-mono text-[10px]">02.</span>
                                <span>Calificación de 61 Subfactores</span>
                            </li>
                            <li className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-default">
                                <span className="text-emerald-400 font-mono text-[10px]">03.</span>
                                <span>Ponderación Media PM ≥ 3.0</span>
                            </li>
                            <li className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-default">
                                <span className="text-emerald-400 font-mono text-[10px]">04.</span>
                                <span>Matriz FODA 2x2 Clásica</span>
                            </li>
                            <li className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors cursor-default">
                                <span className="text-emerald-400 font-mono text-[10px]">05.</span>
                                <span>Resolución Oficial Vinculante</span>
                            </li>
                        </ul>
                    </div>

                    {/* Columna 3: Documentación & Entregables (lg:col-span-2) */}
                    <div className="lg:col-span-2 flex flex-col space-y-2">
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white pb-1">
                            Instrumentos
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-300 font-light">
                            <li>
                                <Link
                                    to="/evaluar"
                                    className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
                                >
                                    <FileText size={12} className="text-emerald-400" />
                                    <span>Dossier PDF Oficial</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/evaluar"
                                    className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
                                >
                                    <FileSpreadsheet size={12} className="text-emerald-400" />
                                    <span>Matriz Excel (.xlsx)</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/evaluar"
                                    className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
                                >
                                    <ExternalLink size={12} className="text-emerald-400" />
                                    <span>Catálogo Técnico</span>
                                </Link>
                            </li>
                            <li>
                                <Link
                                    to="/evaluar"
                                    className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
                                >
                                    <ExternalLink size={12} className="text-emerald-400" />
                                    <span>Plan de Mitigación</span>
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Columna 4: Veredictos Vinculantes (lg:col-span-3) */}
                    <div className="lg:col-span-3 flex flex-col space-y-2">
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-white pb-1">
                            Dictámenes Oficiales
                        </h4>
                        <div className="space-y-1.5 text-xs">
                            <div className="p-2.5 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all border-l-2 border-emerald-400">
                                <span className="font-mono text-[10px] font-bold text-emerald-400 block mb-0.5">
                                    RECOMENDACIÓN A
                                </span>
                                <span className="text-[11px] text-slate-300 leading-tight block">
                                    Adopción Favorable (PM ≥ 3.0, solo F u O).
                                </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all border-l-2 border-amber-400">
                                <span className="font-mono text-[10px] font-bold text-amber-400 block mb-0.5">
                                    RECOMENDACIÓN B
                                </span>
                                <span className="text-[11px] text-slate-300 leading-tight block">
                                    Adopción Condicionada (fallos solo en IR = 2).
                                </span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all border-l-2 border-rose-400">
                                <span className="font-mono text-[10px] font-bold text-rose-400 block mb-0.5">
                                    RECOMENDACIÓN C
                                </span>
                                <span className="text-[11px] text-slate-300 leading-tight block">
                                    Adopción Pospuesta (fallo con IR ≥ 3, o más fallos que aciertos).
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 2.3 COLOFÓN / BARRA INFERIOR A TODO LO ANCHO HASTA ABAJO DE LA VENTANA ── */}
            <div className="relative z-10 w-full bg-black/40 backdrop-blur-md border-t border-white/[0.06] py-2.5 sm:py-3.5 px-4 sm:px-10 lg:px-12 shrink-0">
                <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-slate-400 text-center sm:text-left">
                    <div>
                        <span>© {new Date().getFullYear()} GUIOS FLOSS • Sistema de Evaluación y Adopción de Software.</span>
                    </div>

                    <div className="text-center text-[10px] text-slate-400 hidden md:block">
                        Desarrollado bajo principios de Soberanía Tecnológica y Transparencia Algorítmica.
                    </div>

                    {/* Botón Volver Arriba */}
                    <button
                        type="button"
                        onClick={scrollToTop}
                        className="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer group"
                        title="Volver a la parte superior de la página"
                    >
                        <span>Volver Arriba</span>
                        <div className="w-5 h-5 rounded-full bg-white/[0.05] border border-white/10 group-hover:border-emerald-400/50 flex items-center justify-center transition-colors">
                            <ArrowUp size={11} className="transition-transform group-hover:-translate-y-0.5" />
                        </div>
                    </button>
                </div>
            </div>
        </footer>
    );
});

export default LandingFooter;
