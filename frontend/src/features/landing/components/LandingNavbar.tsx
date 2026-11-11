/**
 * features/landing/components/LandingNavbar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barra de navegación de la Landing Page estilo Editorial de Lujo.
 * - Estirada completamente a todo lo ancho de la ventana (w-full).
 * - Mismo color del fondo del video (#000000 con blur sutil).
 * - Opciones sin cuadrito/caja de fondo, únicamente con una franja fina debajo verde.
 * - Identidad oficial de la organización y accesos directos al evaluador y login.
 */

import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import {
    Menu,
    X,
    ArrowUpRight,
    LogIn,
} from 'lucide-react';
import { clsx } from 'clsx';
import useOrganizationStore from '../../../app/useOrganizationStore';

interface NavSection {
    id: string;
    label: string;
    href: string;
    desc: string;
}

export const NAV_SECTIONS: NavSection[] = [
    {
        id: 'inicio',
        label: 'Inicio',
        href: '#inicio',
        desc: 'Portada y propuesta de valor central',
    },
    {
        id: 'problema',
        label: 'El Problema',
        href: '#problema',
        desc: 'Por qué fallan las adopciones de software sin un método formal',
    },
    {
        id: 'metodologia',
        label: 'Metodología GUIOS',
        href: '#metodologia',
        desc: 'El proceso en 6 pasos',
    },
    {
        id: 'motor-ia',
        label: 'Motor de IA',
        href: '#motor-ia',
        desc: 'Búsqueda bibliográfica autónoma y cálculo dinámico de cuartiles',
    },
    {
        id: 'dictamen',
        label: 'Matriz FODA y Dictamen',
        href: '#dictamen',
        desc: 'Explicación de los veredictos A, B y C',
    },
    {
        id: 'contacto',
        label: 'Institucional',
        href: '#contacto',
        desc: 'Marco normativo y contacto institucional',
    },
];

export const LandingNavbar: React.FC = memo(() => {
    const { organization, fetchOrganization } = useOrganizationStore();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('inicio');

    useEffect(() => {
        if (!organization) {
            fetchOrganization();
        }

        const onScroll = () => {
            const vh = window.innerHeight || 900;
            const y = window.scrollY;
            if (y < vh * 0.8) {
                setActiveSection('inicio');
            } else if (y < vh * 3.8) {
                setActiveSection('problema');
            } else if (y < vh * 9.8) {
                setActiveSection('metodologia');
            } else if (y < vh * 15.5) {
                setActiveSection('motor-ia');
            } else if (y < vh * 18.5) {
                setActiveSection('dictamen');
            } else {
                setActiveSection('contacto');
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [organization, fetchOrganization]);

    const orgDisplayName = organization?.name || 'UNIVERSIDAD ESTATAL DE MILAGRO';

    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        const targetId = href.replace('#', '');
        const vh = window.innerHeight || 900;

        if (targetId === 'inicio') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setActiveSection('inicio');
        } else if (targetId === 'problema') {
            window.scrollTo({ top: vh, behavior: 'smooth' });
            setActiveSection('problema');
        } else if (targetId === 'metodologia') {
            window.scrollTo({ top: vh * 4.5, behavior: 'smooth' });
            setActiveSection('metodologia');
        } else if (targetId === 'motor-ia') {
            window.scrollTo({ top: vh * 11.0, behavior: 'smooth' });
            setActiveSection('motor-ia');
        } else if (targetId === 'dictamen') {
            window.scrollTo({ top: vh * 16.8, behavior: 'smooth' });
            setActiveSection('dictamen');
        } else if (targetId === 'contacto') {
            window.scrollTo({ top: vh * 20.0, behavior: 'smooth' });
            setActiveSection('contacto');
        } else {
            const elem = document.getElementById(targetId);
            if (elem) {
                elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            setActiveSection(targetId);
        }
        setMobileMenuOpen(false);
    };

    return (
        <header className="fixed top-0 left-0 right-0 w-full z-50 bg-black/35 backdrop-blur-sm border-b border-white/[0.06]">
            {/* Contenedor que se estira al 100% del ancho de la ventana */}
            <div className="w-full px-4 sm:px-10 lg:px-12 h-16 sm:h-20 flex items-center justify-between gap-4 sm:gap-6">
                {/* ── 1. LOGO E IDENTIDAD INSTITUCIONAL: GUIOS FLOSS Y ORGANIZACIÓN ── */}
                <div className="flex items-center min-w-0">
                    <Link
                        to="/"
                        className="flex flex-col justify-center group focus:outline-none"
                        title="GUIOS FLOSS — Sistema de Evaluación y Adopción de Software"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-lg sm:text-xl font-black tracking-[0.22em] text-white uppercase transition-colors group-hover:text-emerald-400">
                                GUIOS
                            </span>
                            <span className="font-mono text-lg sm:text-xl font-bold tracking-[0.22em] text-emerald-400 uppercase drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]">
                                FLOSS
                            </span>
                        </div>
                        <span
                            className="text-[10px] sm:text-[11px] font-medium text-slate-400 tracking-wider uppercase truncate max-w-[220px] sm:max-w-[320px] md:max-w-[420px] leading-tight mt-0.5 transition-colors group-hover:text-slate-300"
                            title={orgDisplayName}
                        >
                            {orgDisplayName}
                        </span>
                    </Link>
                </div>

                {/* ── 2. NAVEGACIÓN PRINCIPAL: SIN CUADRITO, SOLO FRANJA FINA VERDE DEBAJO ── */}
                <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
                    {NAV_SECTIONS.map((sec) => {
                        const isActive = activeSection === sec.id;
                        return (
                            <a
                                key={sec.id}
                                href={sec.href}
                                onClick={(e) => handleNavClick(e, sec.href)}
                                title={sec.desc}
                                className={clsx(
                                    'relative py-2 text-xs xl:text-sm font-medium tracking-wide transition-colors duration-200 cursor-pointer select-none group',
                                    isActive
                                        ? 'text-white font-semibold'
                                        : 'text-slate-300 hover:text-white'
                                )}
                            >
                                <span>{sec.label}</span>
                                {/* Franja fina debajo verde */}
                                <span
                                    className={clsx(
                                        'absolute -bottom-1 left-0 right-0 h-[2px] bg-emerald-400 rounded-full transition-all duration-200',
                                        isActive
                                            ? 'opacity-100 scale-x-100'
                                            : 'opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100'
                                    )}
                                />
                            </a>
                        );
                    })}
                </nav>

                {/* ── 3. ACCIONES Y ACCESO INSTITUCIONAL (CTA) ── */}
                <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <Link
                        to="/login"
                        className="px-2 py-1.5 text-xs font-mono font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                    >
                        <LogIn size={13} className="text-slate-400" />
                        <span>Acceso</span>
                    </Link>

                    <Link
                        to="/evaluar"
                        className="relative group overflow-hidden px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-mono text-xs font-bold tracking-wider uppercase transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center gap-2 border border-emerald-400/40"
                    >
                        <span className="relative z-10 flex items-center gap-1.5">
                            <span>Evaluar Software</span>
                            <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </span>
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </Link>
                </div>

                {/* ── 4. BOTÓN MENÚ MÓVIL ── */}
                <div className="lg:hidden flex items-center gap-2">
                    <Link
                        to="/evaluar"
                        className="px-2.5 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-mono font-bold tracking-wider"
                    >
                        Evaluar
                    </Link>
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-lg bg-white/[0.05] border border-white/10 text-slate-300 hover:text-white transition-colors focus:outline-none"
                        aria-label="Alternar navegación"
                    >
                        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* ── MENÚ MÓVIL DESPLEGABLE ── */}
            {mobileMenuOpen && (
                <div className="lg:hidden bg-black/95 backdrop-blur-2xl border-b border-white/10 px-6 pt-3 pb-6 space-y-3 animate-fadeIn">
                    <div className="pb-2 border-b border-white/[0.08]">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 block mb-0.5">
                            Organización Oficial
                        </span>
                        <span className="text-xs font-bold text-white block">
                            {orgDisplayName}
                        </span>
                    </div>

                    <div className="space-y-1">
                        {NAV_SECTIONS.map((sec) => (
                            <a
                                key={sec.id}
                                href={sec.href}
                                onClick={(e) => handleNavClick(e, sec.href)}
                                className="block py-2.5 text-sm font-medium text-slate-300 hover:text-white border-b border-white/[0.04] transition-colors"
                            >
                                <span className="block">{sec.label}</span>
                                <span className="text-[11px] text-slate-400 block mt-0.5">{sec.desc}</span>
                            </a>
                        ))}
                    </div>

                    <div className="pt-3 flex flex-col gap-2">
                        <Link
                            to="/evaluar"
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-mono text-xs font-bold uppercase tracking-wider text-center flex items-center justify-center gap-2"
                        >
                            <span>Comenzar Evaluación de Software</span>
                            <ArrowUpRight size={14} />
                        </Link>
                        <Link
                            to="/login"
                            onClick={() => setMobileMenuOpen(false)}
                            className="w-full py-2 rounded-lg bg-white/[0.05] border border-white/10 text-slate-300 font-mono text-xs font-medium text-center flex items-center justify-center gap-1.5"
                        >
                            <LogIn size={13} />
                            <span>Acceso Institucional</span>
                        </Link>
                    </div>
                </div>
            )}
        </header>
    );
});

export default LandingNavbar;
