/**
 * frontend/src/features/dashboard/components/AdoptionVerdictDonut.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gráfico Donut de distribución de veredictos finales (Recomendaciones A, B, C).
 * Implementado con Recharts y tokens de diseño GUIOS.
 */

import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import type { VerdictDistributionItem } from '../../../api/dashboardService';

interface AdoptionVerdictDonutProps {
    data: VerdictDistributionItem[];
    totalWithVerdict: number;
}

const COLORS: Record<string, string> = {
    A: '#059669', // Verde Menta
    B: '#D97706', // Ámbar
    C: '#DC2626', // Rojo
};

export const AdoptionVerdictDonut: React.FC<AdoptionVerdictDonutProps> = ({
    data,
    totalWithVerdict,
}) => {
    const chartData = data.map((item) => ({
        name: `Rec. ${item.recommendation}`,
        label: item.label,
        value: item.count,
        code: item.recommendation,
    }));

    const hasData = totalWithVerdict > 0;

    return (
        <div className="flex h-full flex-col rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                        Dictamen de Adopción (A / B / C)
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Distribución de recomendaciones metodológicas
                    </p>
                </div>
                <span className="font-mono text-xs font-bold text-[var(--color-primary)] bg-[var(--color-tag-bg,#ecfdf5)] px-2 py-0.5 rounded">
                    {totalWithVerdict} con veredicto
                </span>
            </div>

            <div className="relative mt-2 flex flex-1 items-center justify-center min-h-[220px]">
                {hasData ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                            >
                                {chartData.map((entry) => (
                                    <Cell
                                        key={`cell-${entry.code}`}
                                        fill={COLORS[entry.code] || '#94A3B8'}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const p = payload[0].payload as { name: string; label: string; value: number };
                                        const pct = totalWithVerdict > 0 ? ((p.value / totalWithVerdict) * 100).toFixed(1) : '0';
                                        return (
                                            <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-2 shadow-md text-xs">
                                                <p className="font-bold text-[var(--color-text-primary)]">{p.name}</p>
                                                <p className="text-[11px] text-[var(--color-text-secondary)]">{p.label}</p>
                                                <p className="mt-1 font-mono font-semibold text-[var(--color-primary)]">
                                                    {p.value} software ({pct}%)
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 text-[var(--color-text-tertiary)] text-xs">
                        <p>No se han emitido veredictos aún.</p>
                        <p className="mt-1 text-[11px]">Inicie evaluaciones para visualizar la distribución.</p>
                    </div>
                )}
            </div>

            {/* Leyenda personalizada con métricas */}
            <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border-subtle)] pt-3 text-center">
                {data.map((item) => {
                    const color = COLORS[item.recommendation];
                    const pct = totalWithVerdict > 0 ? Math.round((item.count / totalWithVerdict) * 100) : 0;
                    return (
                        <div key={item.recommendation} className="rounded p-1.5 bg-[var(--color-bg-secondary)]/50">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)]">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                Rec. {item.recommendation}
                            </div>
                            <div className="font-mono text-sm font-black text-[var(--color-text-primary)]">
                                {item.count}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-secondary)]">
                                {pct}%
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdoptionVerdictDonut;
