/**
 * frontend/src/features/dashboard/components/DimensionRadarChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gráfico comparativo de rendimiento medio por Dimensión GUIOS (Escala 1 a 4).
 * Incluye línea de referencia metodológica en 3.00 (Umbral mínimo de viabilidad).
 */

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell,
} from 'recharts';
import type { DimensionAverageItem } from '../../../api/dashboardService';

interface DimensionRadarChartProps {
    data: DimensionAverageItem[];
}

export const DimensionRadarChart: React.FC<DimensionRadarChartProps> = ({ data }) => {
    const formattedData = data.map((d) => ({
        ...d,
        shortName: d.name.replace('Dimensión ', ''),
    }));

    return (
        <div className="flex h-full flex-col rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-2">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                        Puntaje Medio por Dimensión
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Escala 1.00 a 4.00 · Umbral mínimo aceptable: 3.00
                    </p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>&ge; 3.00 Óptimo</span>
                </div>
            </div>

            <div className="relative mt-2 flex flex-1 items-center justify-center min-h-[220px]">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                            data={formattedData}
                            layout="vertical"
                            margin={{ top: 10, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-subtle)" />
                            <XAxis
                                type="number"
                                domain={[0, 4]}
                                ticks={[0, 1, 2, 3, 4]}
                                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                            />
                            <YAxis
                                type="category"
                                dataKey="shortName"
                                tick={{ fill: 'var(--color-text-primary)', fontSize: 11, fontWeight: 600 }}
                                width={110}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const d = payload[0].payload as DimensionAverageItem;
                                        const isOk = d.avg_score >= 3.0;
                                        return (
                                            <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-2 shadow-md text-xs">
                                                <p className="font-bold text-[var(--color-text-primary)]">{d.name}</p>
                                                <p className="mt-1 font-mono font-bold text-sm" style={{ color: isOk ? '#059669' : '#D97706' }}>
                                                    {d.avg_score.toFixed(2)} / 4.00
                                                </p>
                                                <p className="text-[11px] text-[var(--color-text-tertiary)]">
                                                    {d.sample_count} factores evaluados
                                                </p>
                                                <p className="mt-1 text-[10px] font-semibold" style={{ color: isOk ? '#059669' : '#DC2626' }}>
                                                    {isOk ? '✓ Cumple umbral metodológico' : '⚠ Requiere atención en adopción'}
                                                </p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <ReferenceLine
                                x={3.0}
                                stroke="#059669"
                                strokeDasharray="4 4"
                                label={{
                                    value: 'Umbral (3.0)',
                                    fill: '#059669',
                                    fontSize: 10,
                                    position: 'top',
                                }}
                            />
                            <Bar dataKey="avg_score" radius={[0, 4, 4, 0]}>
                                {formattedData.map((entry) => (
                                    <Cell
                                        key={`dim-cell-${entry.dimension_id}`}
                                        fill={entry.avg_score >= 3.0 ? '#059669' : '#D97706'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="text-center text-xs text-[var(--color-text-tertiary)]">
                        No hay dimensiones registradas.
                    </div>
                )}
            </div>
        </div>
    );
};

export default DimensionRadarChart;
