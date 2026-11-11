/**
 * frontend/src/features/dashboard/components/DimensionRadarChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Gráfico en Cascada y Progresión Escalonada de Dimensiones GUIOS.
 * Inspirado en el diseño de funnel de rendimiento con columnas de trama diagonal,
 * rampas conectoras translúcidas, indicadores de cabecera y llamada flotante (pill).
 * Escala metodológica oficial de 1.00 a 4.00 con umbral crítico en 3.00.
 */

import React, { useState, useId } from 'react';
import type { DimensionAverageItem } from '../../../api/dashboardService';

interface DimensionRadarChartProps {
    data: DimensionAverageItem[];
}

export const DimensionRadarChart: React.FC<DimensionRadarChartProps> = ({ data }) => {
    const componentId = useId().replace(/:/g, '');

    // Si aún no hay datos de dimensiones desde el backend, proveer las 4 dimensiones estándar GUIOS
    const displayData: DimensionAverageItem[] = data.length > 0 ? data : [
        { dimension_id: 1, name: 'Dimensión Tecnológica', avg_score: 0, sample_count: 0 },
        { dimension_id: 2, name: 'Dimensión Organizacional', avg_score: 0, sample_count: 0 },
        { dimension_id: 3, name: 'Dimensión Del Entorno', avg_score: 0, sample_count: 0 },
        { dimension_id: 4, name: 'Dimensión Humana', avg_score: 0, sample_count: 0 },
    ];

    // Índice activo por hover (o por defecto la dimensión con mayor puntaje)
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    // Calcular dimensión destacada inicial
    const maxScoreIdx = displayData.reduce((maxI, curr, i, arr) =>
        curr.avg_score > arr[maxI].avg_score ? i : maxI, 0
    );

    const activeIdx = hoveredIdx !== null ? hoveredIdx : maxScoreIdx;
    const activeDimension = displayData[activeIdx] || displayData[0];

    // Geometría del SVG del gráfico escalonado
    const svgWidth = 900;
    const svgHeight = 260;
    const chartTop = 35;
    const chartBottom = 230;
    const chartHeight = chartBottom - chartTop; // 195px
    const leftMargin = 65;
    const rightMargin = 35;
    const usableWidth = svgWidth - leftMargin - rightMargin;

    const n = displayData.length;
    const slotW = usableWidth / Math.max(n, 1);
    const colW = Math.min(slotW * 0.58, 120);

    // Función de mapeo: puntaje [0.0 - 4.0] -> coordenada Y
    const getY = (score: number) => {
        const clamped = Math.max(0, Math.min(4.0, score));
        return chartBottom - (clamped / 4.0) * chartHeight;
    };

    // Y del Umbral Metodológico (3.00)
    const umbralY = getY(3.0);

    // Coordenadas calculadas para cada dimensión
    const columns = displayData.map((d, i) => {
        const colX = leftMargin + i * slotW + (slotW - colW) * 0.3;
        const colY = getY(d.avg_score);
        const colH = chartBottom - colY;
        const cleanName = d.name.replace(/^Dimensión\s+/i, '');

        return {
            ...d,
            index: i,
            cleanName,
            x: colX,
            y: colY,
            width: colW,
            height: Math.max(colH, 4), // Mínimo 4px de altura
            isPass: d.avg_score >= 3.0,
        };
    });

    // Conclusiones automáticas para la barra de análisis inferior
    const passingDims = displayData.filter((d) => d.avg_score >= 3.0);
    const criticalDims = displayData.filter((d) => d.avg_score > 0 && d.avg_score < 3.0);

    return (
        <div className="flex flex-col rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs transition-shadow hover:shadow-sm">
            {/* ── Encabezado Principal ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--color-border-subtle)] pb-3 gap-2">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                            Rendimiento Metodológico por Dimensión
                        </h3>
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Cascada Analítica
                        </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Escala continua 1.00 a 4.00 · Umbral mínimo de viabilidad institucional: 3.00
                    </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>&ge; 3.00 Viable</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span>&lt; 3.00 Riesgo</span>
                    </div>
                </div>
            </div>

            {/* ── Métricas de Cabecera por Dimensión (Estilo Referencia Imagen 2) ── */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {columns.map((col) => {
                    const isActive = col.index === activeIdx;
                    return (
                        <div
                            key={col.dimension_id}
                            onMouseEnter={() => setHoveredIdx(col.index)}
                            onMouseLeave={() => setHoveredIdx(null)}
                            className={`group relative flex flex-col justify-between rounded-xl border p-3 cursor-pointer transition-all ${
                                isActive
                                    ? 'border-blue-500/50 bg-blue-500/5 shadow-sm ring-1 ring-blue-500/30'
                                    : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/70'
                            }`}
                        >
                            {/* Píldora superior indicadora */}
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors truncate">
                                    {col.cleanName}
                                </span>
                                <span
                                    className={`h-1.5 w-6 rounded-full transition-all ${
                                        isActive ? 'bg-blue-600 scale-105' : 'bg-slate-300 dark:bg-slate-600'
                                    }`}
                                />
                            </div>

                            {/* Número Grande (Hero Score) */}
                            <div className="mt-2 flex items-baseline gap-1">
                                <span className="font-mono text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
                                    {col.avg_score > 0 ? col.avg_score.toFixed(2) : '—'}
                                </span>
                                <span className="text-[11px] font-mono text-[var(--color-text-tertiary)]">
                                    / 4.0
                                </span>
                            </div>

                            {/* Detalle inferior */}
                            <div className="mt-1 flex items-center justify-between text-[10px]">
                                <span className="text-[var(--color-text-tertiary)]">
                                    {col.sample_count} {col.sample_count === 1 ? 'factor' : 'factores'}
                                </span>
                                <span
                                    className={`font-semibold ${
                                        col.avg_score === 0
                                            ? 'text-[var(--color-text-tertiary)]'
                                            : col.isPass
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                >
                                    {col.avg_score === 0 ? 'Sin datos' : col.isPass ? '✓ Óptimo' : '⚠ Atención'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Diagrama Escalonado con Trama Diagonal y Rampas Conectoras (SVG) ── */}
            <div className="relative mt-4 w-full overflow-hidden select-none">
                <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto max-h-[300px]"
                >
                    <defs>
                        {/* 1. Patrón de Rayas Diagonales Azules (Diagonal Hatching) */}
                        <pattern
                            id={`${componentId}-diagonal-stripes`}
                            width="10"
                            height="10"
                            patternTransform="rotate(45 0 0)"
                            patternUnits="userSpaceOnUse"
                        >
                            <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="10"
                                stroke="#3B82F6"
                                strokeWidth="2.5"
                                opacity="0.85"
                            />
                        </pattern>

                        {/* 2. Patrón de Rayas para Columna No Activa / Suave */}
                        <pattern
                            id={`${componentId}-diagonal-subtle`}
                            width="10"
                            height="10"
                            patternTransform="rotate(45 0 0)"
                            patternUnits="userSpaceOnUse"
                        >
                            <line
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="10"
                                stroke="#60A5FA"
                                strokeWidth="2"
                                opacity="0.6"
                            />
                        </pattern>

                        {/* 3. Gradiente Sólido Vibrante para la Columna Activa (como en la Imagen 2) */}
                        <linearGradient
                            id={`${componentId}-active-gradient`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" stopColor="#2563EB" />
                            <stop offset="100%" stopColor="#1D4ED8" />
                        </linearGradient>

                        {/* 4. Gradiente de la Rampa Conectora Translúcida */}
                        <linearGradient
                            id={`${componentId}-ramp-gradient`}
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                        >
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.10" />
                        </linearGradient>

                        {/* 5. Gradiente de Fondo Suave para la Columna Activa */}
                        <linearGradient
                            id={`${componentId}-column-bg-active`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.05" />
                        </linearGradient>
                    </defs>

                    {/* ── Líneas de Cuadrícula Horizontal y Ticks Y-Axis ── */}
                    {[4.0, 3.0, 2.0, 1.0].map((val) => {
                        const y = getY(val);
                        const isUmbral = val === 3.0;
                        return (
                            <g key={val}>
                                <line
                                    x1={leftMargin}
                                    y1={y}
                                    x2={svgWidth - rightMargin}
                                    y2={y}
                                    stroke={isUmbral ? '#10B981' : 'var(--color-border-subtle, #e2e8f0)'}
                                    strokeWidth={isUmbral ? 1.5 : 1}
                                    strokeDasharray={isUmbral ? '5 4' : '3 3'}
                                    opacity={isUmbral ? 0.8 : 0.4}
                                />
                                <text
                                    x={leftMargin - 12}
                                    y={y + 4}
                                    textAnchor="end"
                                    className={`font-mono text-[11px] ${
                                        isUmbral
                                            ? 'fill-emerald-600 dark:fill-emerald-400 font-bold'
                                            : 'fill-[var(--color-text-tertiary,#94a3b8)]'
                                    }`}
                                >
                                    {val.toFixed(1)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Etiqueta del Umbral Metodológico (3.00) */}
                    <text
                        x={svgWidth - rightMargin}
                        y={umbralY - 6}
                        textAnchor="end"
                        className="fill-emerald-600 dark:fill-emerald-400 font-mono text-[10px] font-bold"
                    >
                        Umbral Viable (3.00)
                    </text>

                    {/* ── Rampas Conectoras Translúcidas entre Columnas (Efecto Funnel) ── */}
                    {columns.map((col, i) => {
                        if (i === columns.length - 1) return null;
                        const nextCol = columns[i + 1];

                        const startX = col.x + col.width;
                        const endX = nextCol.x;
                        const startY = col.y;
                        const endY = nextCol.y;

                        return (
                            <g key={`ramp-${col.dimension_id}`}>
                                {/* Polígono relleno de la rampa */}
                                <polygon
                                    points={`
                                        ${startX},${startY}
                                        ${endX},${endY}
                                        ${endX},${chartBottom}
                                        ${startX},${chartBottom}
                                    `}
                                    fill={`url(#${componentId}-ramp-gradient)`}
                                />

                                {/* Borde superior de la rampa (línea de transición) */}
                                <line
                                    x1={startX}
                                    y1={startY}
                                    x2={endX}
                                    y2={endY}
                                    stroke="#60A5FA"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 3"
                                    opacity={0.8}
                                />
                            </g>
                        );
                    })}

                    {/* ── Columnas Escalonadas con Trama Diagonal ── */}
                    {columns.map((col) => {
                        const isActive = col.index === activeIdx;

                        return (
                            <g
                                key={`col-${col.dimension_id}`}
                                className="cursor-pointer transition-all duration-300"
                                onMouseEnter={() => setHoveredIdx(col.index)}
                                onMouseLeave={() => setHoveredIdx(null)}
                            >
                                {/* Fondo de la columna activa (wash tint como en la imagen) */}
                                {isActive && (
                                    <rect
                                        x={col.x - 12}
                                        y={chartTop - 15}
                                        width={col.width + 24}
                                        height={chartBottom - chartTop + 20}
                                        fill={`url(#${componentId}-column-bg-active)`}
                                        rx={8}
                                        className="transition-all duration-300"
                                    />
                                )}

                                {/* Sombra / Base de la columna */}
                                <rect
                                    x={col.x}
                                    y={col.y}
                                    width={col.width}
                                    height={col.height}
                                    fill={
                                        isActive
                                            ? `url(#${componentId}-active-gradient)`
                                            : `url(#${componentId}-diagonal-stripes)`
                                    }
                                    rx={4}
                                    className="transition-all duration-300 filter drop-shadow-xs"
                                />

                                {/* Tapa / Borde superior brillante de la columna */}
                                <line
                                    x1={col.x}
                                    y1={col.y}
                                    x2={col.x + col.width}
                                    y2={col.y}
                                    stroke={isActive ? '#93C5FD' : '#3B82F6'}
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                />

                                {/* Base inferior */}
                                <line
                                    x1={col.x - 4}
                                    y1={chartBottom}
                                    x2={col.x + col.width + 4}
                                    y2={chartBottom}
                                    stroke="var(--color-border-subtle, #cbd5e1)"
                                    strokeWidth={2}
                                />
                            </g>
                        );
                    })}

                    {/* ── Etiqueta Flotante Interactiva (Pill Tooltip como en la Imagen 2) ── */}
                    {(() => {
                        const activeCol = columns[activeIdx] || columns[0];
                        if (!activeCol) return null;

                        const tooltipW = 270;
                        const tooltipH = 32;
                        // Centrar la píldora en la columna activa evitando que se desborde a los bordes
                        let tooltipX = activeCol.x + activeCol.width / 2 - tooltipW / 2;
                        tooltipX = Math.max(leftMargin + 10, Math.min(svgWidth - rightMargin - tooltipW - 10, tooltipX));
                        const tooltipY = Math.max(chartTop - 10, activeCol.y - 42);

                        const viabilityPct = Math.round((activeCol.avg_score / 4.0) * 100);

                        return (
                            <g
                                transform={`translate(${tooltipX}, ${tooltipY})`}
                                className="transition-transform duration-300 ease-out pointer-events-none"
                            >
                                {/* Rectángulo de la píldora */}
                                <rect
                                    width={tooltipW}
                                    height={tooltipH}
                                    rx={16}
                                    className="fill-[var(--color-bg-elevated,#ffffff)] stroke-blue-400 shadow-xl"
                                    strokeWidth={1.2}
                                    opacity={0.96}
                                />

                                {/* Texto de la píldora */}
                                <text
                                    x={tooltipW / 2}
                                    y={tooltipH / 2 + 4}
                                    textAnchor="middle"
                                    className="fill-[var(--color-text-primary,#0f172a)] font-mono text-[11px] font-semibold"
                                >
                                    <tspan className="font-bold text-blue-600 dark:text-blue-400">
                                        {activeCol.avg_score.toFixed(2)} pts
                                    </tspan>
                                    <tspan className="fill-[var(--color-text-tertiary,#94a3b8)]"> | </tspan>
                                    <tspan>Madurez: </tspan>
                                    <tspan className="font-bold">{viabilityPct}%</tspan>
                                    <tspan className="fill-[var(--color-text-tertiary,#94a3b8)]"> | </tspan>
                                    <tspan
                                        className={
                                            activeCol.isPass
                                                ? 'fill-emerald-600 dark:fill-emerald-400 font-bold'
                                                : 'fill-amber-600 dark:fill-amber-400 font-bold'
                                        }
                                    >
                                        {activeCol.isPass ? 'Apto' : 'Atención'}
                                    </tspan>
                                </text>

                                {/* Cursor / Puntero apuntando a la columna */}
                                <path
                                    d={`M ${tooltipW / 2 - 5} ${tooltipH} L ${tooltipW / 2} ${tooltipH + 5} L ${tooltipW / 2 + 5} ${tooltipH} Z`}
                                    className="fill-blue-400"
                                />
                            </g>
                        );
                    })()}
                </svg>
            </div>

            {/* ── Barra de Dictamen Metodológico / AI Insight (Estilo Prompt Inferior de Imagen 2) ── */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-transparent p-3.5 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-sm">
                        ✦
                    </span>
                    <div className="leading-relaxed">
                        <span className="font-bold text-[var(--color-text-primary)]">
                            Diagnóstico Metodológico Institucional:
                        </span>{' '}
                        {passingDims.length > 0 && criticalDims.length === 0 ? (
                            <span>
                                Todas las dimensiones evaluadas superan el umbral metodológico (&ge; 3.00), reflejando alta madurez y viabilidad de adopción.
                            </span>
                        ) : criticalDims.length > 0 ? (
                            <span>
                                La dimensión{' '}
                                <strong className="text-amber-600 dark:text-amber-400">
                                    {criticalDims.map((d) => d.name.replace(/^Dimensión\s+/i, '')).join(', ')}
                                </strong>{' '}
                                presenta factores bajo el umbral (3.00), sugiriendo medidas de mitigación técnica y de gestión antes de la adopción formal.
                            </span>
                        ) : (
                            <span>
                                Inicie evaluaciones de software institucional para generar el análisis comparativo por dimensiones GUIOS.
                            </span>
                        )}
                    </div>
                </div>

                <div className="shrink-0 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20 self-start sm:self-auto">
                    Dimensión Activa: {activeDimension?.name.replace(/^Dimensión\s+/i, '') || 'General'}
                </div>
            </div>
        </div>
    );
};

export default DimensionRadarChart;
