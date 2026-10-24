/**
 * frontend/src/features/dashboard/components/FodaBalanceWidget.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Widget de distribución estratégica de factores según la matriz FODA GUIOS.
 * Muestra el balance entre factores favorables (F+O) y desfavorables (D+A).
 */

import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import type { FodaDistributionItem } from '../../../api/dashboardService';

interface FodaBalanceWidgetProps {
    data: FodaDistributionItem[];
    fodaRatio: number;
    totalStrengths: number;
    totalWeaknesses: number;
}

export const FodaBalanceWidget: React.FC<FodaBalanceWidgetProps> = ({
    data,
    fodaRatio,
    totalStrengths,
    totalWeaknesses,
}) => {
    const totalFactors = data.reduce((acc, curr) => acc + curr.count, 0) || 1;

    const getConfig = (type: string) => {
        switch (type) {
            case 'fortaleza':
                return {
                    label: 'Fortalezas (F)',
                    color: '#059669',
                    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    bar: 'bg-emerald-500',
                };
            case 'oportunidad':
                return {
                    label: 'Oportunidades (O)',
                    color: '#10B981',
                    bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
                    bar: 'bg-teal-500',
                };
            case 'debilidad':
                return {
                    label: 'Debilidades (D)',
                    color: '#F59E0B',
                    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    bar: 'bg-amber-500',
                };
            case 'amenaza':
                return {
                    label: 'Amenazas (A)',
                    color: '#DC2626',
                    bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                    bar: 'bg-rose-500',
                };
            default:
                return {
                    label: type,
                    color: '#6B7280',
                    bg: 'bg-gray-500/10 text-gray-600',
                    bar: 'bg-gray-500',
                };
        }
    };

    const isHealthy = fodaRatio >= 1.0;

    return (
        <div className="flex h-full flex-col rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                        Balance Estratégico FODA
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Diagnóstico institucional consolidado
                    </p>
                </div>
                <div className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
                    isHealthy ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                }`}>
                    {isHealthy ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    <span>Ratio {fodaRatio}x</span>
                </div>
            </div>

            <div className="mt-3 space-y-3 flex-1">
                {data.map((item) => {
                    const cfg = getConfig(item.type);
                    const pct = Math.round((item.count / totalFactors) * 100);
                    return (
                        <div key={item.type} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[var(--color-text-primary)]">
                                    {cfg.label}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-[var(--color-text-primary)]">
                                        {item.count}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                        ({pct}%)
                                    </span>
                                </div>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-secondary)]">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Favorables: {totalStrengths}</span>
                </div>
                <div className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>Riesgos: {totalWeaknesses}</span>
                </div>
            </div>
        </div>
    );
};

export default FodaBalanceWidget;
