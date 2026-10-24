/**
 * frontend/src/features/dashboard/components/DashboardKpiCards.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuadrícula de tarjetas de KPIs ejecutivos para la metodología GUIOS.
 * Usa variables de diseño institucionales y micro-animaciones discretas.
 */

import React from 'react';
import {
    ClipboardCheck,
    TrendingUp,
    ShieldCheck,
    Cpu,
} from 'lucide-react';
import type { DashboardKpis } from '../../../api/dashboardService';

interface DashboardKpiCardsProps {
    kpis: DashboardKpis;
}

export const DashboardKpiCards: React.FC<DashboardKpiCardsProps> = ({ kpis }) => {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* KPI 1: Volumen de Evaluaciones */}
            <div className="relative overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs transition hover:border-[var(--color-primary)]/40">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Cartera Evaluada
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <ClipboardCheck className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-black text-[var(--color-text-primary)]">
                        {kpis.total_evaluations}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                        software{kpis.total_evaluations === 1 ? '' : 's'}
                    </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[11px]">
                    <span className="text-[var(--color-text-secondary)]">
                        Completadas: <strong className="text-[var(--color-text-primary)]">{kpis.completed_evaluations}</strong>
                    </span>
                    <span className="text-[var(--color-text-secondary)]">
                        En curso: <strong className="text-[var(--color-primary)]">{kpis.in_progress_evaluations}</strong>
                    </span>
                </div>
            </div>

            {/* KPI 2: Tasa de Viabilidad de Adopción */}
            <div className="relative overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs transition hover:border-[var(--color-primary)]/40">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Tasa de Viabilidad (A+B)
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        {kpis.adoption_viability_rate}%
                    </span>
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                        aprobación
                    </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[11px]">
                    <span className="text-[var(--color-text-secondary)]">
                        Veredictos emitidos: <strong className="text-[var(--color-text-primary)]">{kpis.total_with_verdict}</strong>
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Aptos para uso
                    </span>
                </div>
            </div>

            {/* KPI 3: Balance FODA */}
            <div className="relative overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs transition hover:border-[var(--color-primary)]/40">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Salud Metodológica FODA
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <ShieldCheck className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-black text-[var(--color-text-primary)]">
                        {kpis.foda_ratio}x
                    </span>
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                        ratio F/D
                    </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[11px]">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        +{kpis.foda_strengths} favorables
                    </span>
                    <span className="text-rose-500 dark:text-rose-400 font-medium">
                        {kpis.foda_weaknesses} debilidades
                    </span>
                </div>
            </div>

            {/* KPI 4: Rendimiento Asistencia IA */}
            <div className="relative overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs transition hover:border-[var(--color-primary)]/40">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Asistente Inteligente IA
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <Cpu className="h-4 w-4" />
                    </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-black text-[var(--color-text-primary)]">
                        {kpis.ai_avg_latency_ms}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-text-tertiary)]">
                        ms latencia
                    </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[11px]">
                    <span className="text-[var(--color-text-secondary)]">
                        Consultas: <strong className="text-[var(--color-text-primary)]">{kpis.ai_total_calls}</strong>
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {kpis.ai_success_rate}% éxito
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DashboardKpiCards;
