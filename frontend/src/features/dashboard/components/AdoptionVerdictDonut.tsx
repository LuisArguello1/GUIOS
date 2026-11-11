/**
 * frontend/src/features/dashboard/components/AdoptionVerdictDonut.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gráfico Donut de distribución de veredictos finales (Recomendaciones A, B, C)
 * inspirado en diseño analítico moderno con tarjetas métricas laterales y
 * líneas conectoras hacia etiquetas flotantes porcentuales (leader lines).
 */

import React, { useId } from 'react';
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

interface VerdictConfig {
    code: 'A' | 'B' | 'C';
    title: string;
    subtitle: string;
    pillLabel: string;
    color: string;
    hatchId: string;
    solidColor: string;
}

const VERDICT_CONFIGS: Record<string, VerdictConfig> = {
    A: {
        code: 'A',
        title: 'Recomendación A',
        subtitle: 'Apto para Adopción institucional',
        pillLabel: 'Viabilidad Alta',
        color: '#10B981', // Verde Esmeralda
        solidColor: '#059669',
        hatchId: 'hatch-verdict-a',
    },
    B: {
        code: 'B',
        title: 'Recomendación B',
        subtitle: 'Aceptable con Condiciones técnicas',
        pillLabel: 'Sujeto a Mejoras',
        color: '#6366F1', // Índigo vibrante
        solidColor: '#4F46E5',
        hatchId: 'hatch-verdict-b',
    },
    C: {
        code: 'C',
        title: 'Recomendación C',
        subtitle: 'No Apto o Sugiere Posponer',
        pillLabel: 'Riesgo / Desfavorable',
        color: '#F43F5E', // Magenta / Rose
        solidColor: '#E11D48',
        hatchId: 'hatch-verdict-c',
    },
};

export const AdoptionVerdictDonut: React.FC<AdoptionVerdictDonutProps> = ({
    data,
    totalWithVerdict,
}) => {
    const componentId = useId().replace(/:/g, '');

    // Asegurar estructura de las 3 recomendaciones metodológicas
    const safeData: VerdictDistributionItem[] = ['A', 'B', 'C'].map((code) => {
        const found = data.find((d) => d.recommendation === code);
        return {
            recommendation: code as 'A' | 'B' | 'C',
            label: found?.label || VERDICT_CONFIGS[code].subtitle,
            count: found?.count || 0,
        };
    });

    const hasData = totalWithVerdict > 0;

    const chartData = safeData.map((item) => ({
        name: `Rec. ${item.recommendation}`,
        code: item.recommendation,
        label: item.label,
        value: item.count,
    }));

    // Render de líneas conectoras y badges flotantes (% leader lines)
    const renderLeaderLabel = (props: any) => {
        const { cx, cy, midAngle, outerRadius, percent, value } = props;
        if (!value || value === 0 || !percent) return null;

        const RADIAN = Math.PI / 180;
        const sin = Math.sin(-midAngle * RADIAN);
        const cos = Math.cos(-midAngle * RADIAN);

        // Coordenada inicial en el borde del anillo exterior
        const sx = cx + (outerRadius + 3) * cos;
        const sy = cy + (outerRadius + 3) * sin;

        // Punto de quiebre (codo)
        const mx = cx + (outerRadius + 18) * cos;
        const my = cy + (outerRadius + 18) * sin;

        // Extensión horizontal
        const isRight = cos >= 0;
        const ex = mx + (isRight ? 18 : -18);
        const ey = my;

        // Coordenadas de la píldora flotante
        const pillWidth = 44;
        const pillHeight = 24;
        const pillX = isRight ? ex + 3 : ex - pillWidth - 3;
        const pillY = ey - pillHeight / 2;

        const pct = Math.round(percent * 100);

        return (
            <g className="transition-all duration-300 pointer-events-none">
                {/* Línea conectora */}
                <path
                    d={`M${sx},${sy} L${mx},${my} L${ex},${ey}`}
                    stroke="var(--color-border-subtle, #cbd5e1)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    opacity={0.85}
                />
                {/* Punto inicial de anclaje */}
                <circle cx={sx} cy={sy} r={2.5} fill="var(--color-text-secondary, #64748b)" />

                {/* Badge flotante con porcentaje */}
                <g transform={`translate(${pillX}, ${pillY})`}>
                    <rect
                        width={pillWidth}
                        height={pillHeight}
                        rx={12}
                        className="fill-[var(--color-bg-primary,#ffffff)] stroke-[var(--color-border-subtle,#e2e8f0)] shadow-md"
                        strokeWidth={1.2}
                    />
                    <text
                        x={pillWidth / 2}
                        y={pillHeight / 2 + 4}
                        textAnchor="middle"
                        className="fill-[var(--color-text-primary,#0f172a)] font-mono text-[11px] font-extrabold tracking-tight"
                    >
                        {pct}%
                    </text>
                </g>
            </g>
        );
    };

    return (
        <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs transition-shadow hover:shadow-sm">
            {/* ── Encabezado ── */}
            <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                        Dictamen de Adopción (A / B / C)
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Distribución de recomendaciones metodológicas
                    </p>
                </div>
                <span className="font-mono text-xs font-bold text-[var(--color-primary)] bg-[var(--color-tag-bg,#ecfdf5)] px-2.5 py-1 rounded-full border border-[var(--color-border-subtle)]">
                    {totalWithVerdict} {totalWithVerdict === 1 ? 'evaluación' : 'evaluaciones'}
                </span>
            </div>

            {/* ── Cuerpo con 2 Columnas: Tarjetas Métricas (Izq) + Donut con Leader Lines (Der) ── */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-center flex-1">
                {/* 1. Tarjetas Métricas Laterales (Estilo Referencia Imagen 1) */}
                <div className="md:col-span-5 flex flex-col gap-2.5">
                    {safeData.map((item) => {
                        const cfg = VERDICT_CONFIGS[item.recommendation];
                        const pct = totalWithVerdict > 0
                            ? Math.round((item.count / totalWithVerdict) * 100)
                            : 0;

                        return (
                            <div
                                key={item.recommendation}
                                className="group relative flex flex-col justify-between rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/40 p-3.5 transition-all hover:bg-[var(--color-bg-secondary)]/80 hover:border-[var(--color-border)]"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-3.5 w-3.5 shrink-0 rounded-md shadow-xs"
                                            style={{ backgroundColor: cfg.color }}
                                        />
                                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                            {cfg.title}
                                        </span>
                                    </div>
                                    <span className="font-mono text-[11px] font-semibold text-[var(--color-text-tertiary)]">
                                        {pct}%
                                    </span>
                                </div>

                                <div className="mt-1.5 flex items-baseline justify-between">
                                    <div className="font-mono text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
                                        {item.count}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--color-text-secondary)]">
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: cfg.color }}
                                        />
                                        <span>{cfg.pillLabel}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 2. Donut con Líneas Conectoras (Der) */}
                <div className="md:col-span-7 relative flex items-center justify-center min-h-[240px]">
                    {hasData ? (
                        <>
                            {/* SVG Defs para Patrones de Rayas Diagonales */}
                            <svg className="absolute w-0 h-0" aria-hidden="true">
                                <defs>
                                    <pattern
                                        id={`${componentId}-hatch-a`}
                                        width="6"
                                        height="6"
                                        patternTransform="rotate(45 0 0)"
                                        patternUnits="userSpaceOnUse"
                                    >
                                        <line x1="0" y1="0" x2="0" y2="6" stroke="#10B981" strokeWidth="2.5" opacity="0.6" />
                                    </pattern>
                                    <pattern
                                        id={`${componentId}-hatch-b`}
                                        width="6"
                                        height="6"
                                        patternTransform="rotate(45 0 0)"
                                        patternUnits="userSpaceOnUse"
                                    >
                                        <line x1="0" y1="0" x2="0" y2="6" stroke="#6366F1" strokeWidth="2.5" opacity="0.6" />
                                    </pattern>
                                    <pattern
                                        id={`${componentId}-hatch-c`}
                                        width="6"
                                        height="6"
                                        patternTransform="rotate(45 0 0)"
                                        patternUnits="userSpaceOnUse"
                                    >
                                        <line x1="0" y1="0" x2="0" y2="6" stroke="#F43F5E" strokeWidth="2.5" opacity="0.6" />
                                    </pattern>
                                </defs>
                            </svg>

                            {/* Badge Central en el Orificio del Donut (plano de fondo z-0) */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                    Veredictos
                                </span>
                                <span className="font-mono text-2xl font-black text-[var(--color-text-primary)]">
                                    {totalWithVerdict}
                                </span>
                                <span className="text-[9px] text-[var(--color-text-secondary)] font-medium">
                                    Consolidados
                                </span>
                            </div>

                            <ResponsiveContainer width="100%" height={240} className="relative z-10">
                                <PieChart margin={{ top: 15, right: 25, bottom: 15, left: 25 }}>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={78}
                                        paddingAngle={4}
                                        dataKey="value"
                                        label={renderLeaderLabel}
                                        labelLine={false}
                                        animationDuration={700}
                                    >
                                        {chartData.map((entry) => {
                                            const cfg = VERDICT_CONFIGS[entry.code];
                                            return (
                                                <Cell
                                                    key={`cell-${entry.code}`}
                                                    fill={cfg?.color || '#94A3B8'}
                                                    stroke="var(--color-bg-primary, #ffffff)"
                                                    strokeWidth={2}
                                                />
                                            );
                                        })}
                                    </Pie>
                                    <Tooltip
                                        wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const p = payload[0].payload as {
                                                    code: string;
                                                    name: string;
                                                    label: string;
                                                    value: number;
                                                };
                                                const cfg = VERDICT_CONFIGS[p.code];
                                                const pct = totalWithVerdict > 0
                                                    ? ((p.value / totalWithVerdict) * 100).toFixed(1)
                                                    : '0';

                                                return (
                                                    <div
                                                        className="relative z-50 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3 shadow-2xl text-xs backdrop-blur-md opacity-100"
                                                        style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: cfg?.color }}
                                                            />
                                                            <p className="font-bold text-[var(--color-text-primary)]">
                                                                {p.name}
                                                            </p>
                                                        </div>
                                                        <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                                                            {p.label}
                                                        </p>
                                                        <p className="mt-1.5 font-mono font-bold text-sm" style={{ color: cfg?.color }}>
                                                            {p.value} {p.value === 1 ? 'software' : 'softwares'} ({pct}%)
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-6 text-[var(--color-text-tertiary)] text-xs">
                            <div className="h-10 w-10 rounded-full border border-dashed border-[var(--color-border-subtle)] flex items-center justify-center mb-2 text-base">
                                📊
                            </div>
                            <p className="font-medium text-[var(--color-text-secondary)]">No se han emitido veredictos aún.</p>
                            <p className="mt-1 text-[11px]">Inicie evaluaciones para visualizar la distribución.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdoptionVerdictDonut;
