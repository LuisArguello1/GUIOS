/**
 * features/publicEvaluation/components/PublicNavbar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Barra de navegación superior del módulo público de evaluación.
 * Muestra el nombre oficial de la Organización del sistema, alternador de tema
 * (Modo Claro / Modo Oscuro) y navegación pública ocupando el ancho completo.
 */

import React, { memo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layers, HelpCircle, PlusCircle, LogIn, Sun, Moon, Cpu, Sparkles } from 'lucide-react';
import Button from '../../../components/ui/Button';
import useThemeStore from '../../../app/useThemeStore';
import useOrganizationStore from '../../../app/useOrganizationStore';
import type { EvaluationDetail } from '../../../api/evaluationService';

interface PublicNavbarProps {
    evaluation: EvaluationDetail | null;
    onOpenHelp: () => void;
    onResetEvaluation: () => void;
    onStartTour?: () => void;
    showTourButton?: boolean;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({
    evaluation,
    onOpenHelp,
    onResetEvaluation,
    onStartTour,
    showTourButton,
}) => {
    const { theme, toggleTheme } = useThemeStore();
    const { organization, fetchOrganization } = useOrganizationStore();

    useEffect(() => {
        if (!organization) {
            fetchOrganization();
        }
    }, [organization, fetchOrganization]);

    const orgDisplayName = organization?.name || evaluation?.org_name || 'UNIVERSIDAD ESTATAL DE MILAGRO';

    return (
        <header className="sticky top-0 z-20 bg-[var(--color-bg-elevated)]/95 backdrop-blur-md border-b border-[var(--color-border-default)] px-3 sm:px-6 py-2">
            <div className="w-full flex items-center justify-between gap-2 sm:gap-3">
                {/* ── Lado Izquierdo: Nombre de la Organización e Identidad GUIOS ── */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Link
                        to="/"
                        className="flex items-center gap-2 sm:gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
                        title="Volver a la Portada Principal"
                    >
                        <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] shrink-0 shadow-xs">
                            <Layers size={18} />
                        </div>
                        <div className="min-w-0">
                            <span className="font-black text-xs sm:text-sm tracking-tight text-[var(--color-text-primary)] uppercase truncate block" title={orgDisplayName}>
                                {orgDisplayName}
                            </span>
                            <p className="text-[10px] font-bold text-[var(--color-primary)] font-mono tracking-wider uppercase -mt-0.5 truncate">
                                GUIOS PRO • Evaluación de Software Libre
                            </p>
                        </div>
                    </Link>

                    {/* Contexto de la Evaluación Activa si existe */}
                    {evaluation && (
                        <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-[var(--color-border-subtle)] min-w-0">
                            <span className="text-[11px] text-[var(--color-text-tertiary)]">Software:</span>
                            <span className="font-bold text-[11px] text-[var(--color-text-primary)] bg-[var(--color-bg-page)] px-2 py-0.5 rounded-[3px] border border-[var(--color-border-subtle)] font-mono truncate max-w-[160px]">
                                {evaluation.software_name} {evaluation.software_version && `v${evaluation.software_version}`}
                            </span>
                            {evaluation.ai_enabled && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-[3px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/25">
                                    <Cpu size={10} /> IA Activa
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Lado Derecho: Acciones, Switch de Tema y Acceso Admin ── */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Botón de Alternancia de Tema (Sun / Moon) */}
                    <button
                        onClick={toggleTheme}
                        className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] border border-transparent hover:border-[var(--color-border-subtle)]"
                        aria-label="Alternar tema"
                        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    {/* Botón de Tutorial Guiado Interactivo */}
                    {showTourButton && onStartTour && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onStartTour}
                            className="flex items-center gap-1.5 text-xs h-8 px-2.5 text-[var(--color-primary)] border-[var(--color-primary)]/40 hover:border-[var(--color-primary)] bg-[var(--color-primary-soft-bg)]/40 hover:bg-[var(--color-primary-soft-bg)] transition-all font-semibold"
                            title="Iniciar tutorial interactivo de esta pantalla"
                        >
                            <Sparkles size={13} className="text-[var(--color-primary)]" />
                            <span className="hidden sm:inline text-xs font-bold">Tutorial</span>
                        </Button>
                    )}

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onOpenHelp}
                        className="flex items-center gap-1.5 text-xs h-8 px-2.5"
                        title="Consultar guía metodológica y glosario de términos"
                    >
                        <HelpCircle size={13} className="text-[var(--color-primary)]" />
                        <span className="hidden sm:inline text-xs">Ayuda</span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onResetEvaluation}
                        className="flex items-center gap-1.5 text-xs h-8 px-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        title="Iniciar una nueva sesión de evaluación"
                    >
                        <PlusCircle size={13} />
                        <span className="hidden sm:inline text-xs">Nueva</span>
                    </Button>

                    <Link
                        to="/login"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold h-8 px-2.5 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)] transition-all"
                        title="Ingreso para administradores del catálogo y auditores"
                    >
                        <LogIn size={13} />
                        <span className="hidden md:inline">Administración</span>
                    </Link>
                </div>
            </div>
        </header>
    );
};

export default memo(PublicNavbar);
