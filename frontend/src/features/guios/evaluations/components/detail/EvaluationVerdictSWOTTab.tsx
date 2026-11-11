/**
 * features/guios/evaluations/components/detail/EvaluationVerdictSWOTTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña 1: Resolución Oficial, Dictamen Vinculante, Reportes Ejecutivos / Mitigación
 * y Matriz FODA Consolidada (2x2).
 *
 * Principio:
 * - Fila amplia en tabs para Resumen Ejecutivo y Plan de Mitigación tabular.
 * - Matriz FODA organizada y limpia en la sección inferior, sin ruido visual,
 *   sin bordes duplicados ni contenedores anidados para cada factor.
 */

import React, { useState, useMemo, memo } from 'react';
import {
    Award,
    AlertTriangle,
    Sparkles,
    ShieldCheck,
    Layers,
    Calendar,
} from 'lucide-react';
import type { EvaluationDetail, EvaluationResultItem, FODAClassification } from '../../../../../api/evaluationService';
import MarkdownViewer from '../../../../publicEvaluation/components/MarkdownViewer';
import { MitigationPlanTable } from './MitigationPlanTable';

interface EvaluationVerdictSWOTTabProps {
    evaluation: EvaluationDetail;
    onViewFactorDetails?: (factorId: number) => void;
}

export const EvaluationVerdictSWOTTab: React.FC<EvaluationVerdictSWOTTabProps> = ({
    evaluation,
    onViewFactorDetails,
}) => {
    const verdict = evaluation.verdict;
    const results = useMemo(() => evaluation.results || [], [evaluation.results]);
    const [selectedFodaFilter, setSelectedFodaFilter] = useState<FODAClassification | 'all'>('all');
    const [activeReportTab, setActiveReportTab] = useState<'mitigation' | 'executive'>('mitigation');

    // Mapeo de factores agrupados por cuadrante FODA
    const fodaGroups = useMemo(() => {
        const groups: Record<FODAClassification, EvaluationResultItem[]> = {
            strength: [],
            opportunity: [],
            weakness: [],
            threat: [],
        };

        results.forEach((r) => {
            if (r.foda_classification && groups[r.foda_classification]) {
                groups[r.foda_classification].push(r);
            }
        });

        return groups;
    }, [results]);

    return (
        <div className="space-y-4">
            {/* ── 1. BANNER INSTITUCIONAL DEL DICTAMEN OFICIAL ── */}
            {verdict ? (
                <div className="p-4 sm:p-5 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]">
                                <Award size={18} />
                            </span>
                            <div>
                                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-tertiary)] block">
                                    Resolución Oficial Vinculante (GUIOS)
                                </span>
                                <h2 className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
                                    {verdict.recommendation_display || `Dictamen Tipo ${verdict.recommendation}`}
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--color-text-tertiary)]">
                            <Calendar size={12} />
                            <span>Emitido: {new Date(verdict.calculated_at).toLocaleDateString()}</span>
                        </div>
                    </div>

                    <div className="mt-3 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        <p className="font-normal text-[var(--color-text-secondary)]">
                            {verdict.explanation_text}
                        </p>
                    </div>
                </div>
            ) : (
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex items-start gap-3">
                    <span className="p-1.5 rounded-[var(--radius-xs)] bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                        <AlertTriangle size={16} />
                    </span>
                    <div>
                        <h3 className="text-xs font-bold text-[var(--color-text-primary)]">
                            Dictamen Institucional en Proceso
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            Esta evaluación se encuentra en fase de auditoría técnica. El dictamen final vinculante (Recomendación A, B o C) se generará una vez calificados los subfactores y emitido el veredicto formal.
                        </p>
                    </div>
                </div>
            )}

            {/* ── 2. FILA AMPLIA EN TABS (PLAN DE MITIGACIÓN Y RESUMEN EJECUTIVO) ── */}
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-xs overflow-hidden">
                {/* Cabecera de Tabs */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-page)]/50">
                    <div className="flex items-center gap-1 font-mono text-xs">
                        <button
                            type="button"
                            onClick={() => setActiveReportTab('mitigation')}
                            className={`px-3 py-1 rounded-[var(--radius-xs)] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeReportTab === 'mitigation'
                                    ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
                            <ShieldCheck size={13} />
                            <span>Plan de Mitigación</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveReportTab('executive')}
                            className={`px-3 py-1 rounded-[var(--radius-xs)] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeReportTab === 'executive'
                                    ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-xs border border-[var(--color-border-subtle)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                            }`}
                        >
                            <Sparkles size={13} />
                            <span>Resumen Ejecutivo</span>
                        </button>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] hidden sm:inline">
                        {activeReportTab === 'mitigation' ? 'Estructura tabular de mitigación' : 'Síntesis directiva'}
                    </span>
                </div>

                {/* Contenido a Ancho Completo */}
                <div className="p-4 sm:p-5">
                    {activeReportTab === 'mitigation' ? (
                        <MitigationPlanTable
                            evaluation={evaluation}
                            mitigationPlanText={verdict?.ai_mitigation_plan}
                            onViewFactorDetails={onViewFactorDetails}
                        />
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5 pb-2 border-b border-[var(--color-border-subtle)]">
                                <Sparkles size={13} className="text-[var(--color-text-secondary)]" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                    Resumen Ejecutivo de IA
                                </h4>
                            </div>
                            {verdict?.ai_executive_summary ? (
                                <MarkdownViewer content={verdict.ai_executive_summary} className="text-xs leading-relaxed" />
                            ) : (
                                <p className="text-xs text-[var(--color-text-tertiary)] italic py-4 text-center">
                                    No se ha generado un resumen ejecutivo de IA para esta evaluación.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── 3. MATRIZ FODA CONSOLIDADA (2×2) — LIMPIA Y SIN RUIDO VISUAL ── */}
            <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] p-4 sm:p-5 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border-subtle)]">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-1.5 font-mono">
                        <Layers size={13} className="text-[var(--color-text-tertiary)]" />
                        Matriz FODA Consolidada (2×2)
                    </h3>
                    <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                        {results.length} factores clasificados
                    </span>
                </div>

                {/* Grilla 2x2 con divisores sutiles — sin anidamiento de cajas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--color-border-subtle)] rounded-[var(--radius-xs)] overflow-hidden border border-[var(--color-border-subtle)]">
                    {/* FORTALEZAS (F) */}
                    <div
                        onClick={() => setSelectedFodaFilter(selectedFodaFilter === 'strength' ? 'all' : 'strength')}
                        className={`p-3.5 bg-[var(--color-bg-surface)] transition-all cursor-pointer ${
                            selectedFodaFilter === 'strength' ? 'ring-1 ring-[var(--color-border-focus)]' : ''
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                FORTALEZAS (F)
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {fodaGroups.strength.length}
                            </span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2">
                            Factores Internos con PM ≥ 3.0
                        </p>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                            {fodaGroups.strength.map((f) => (
                                <div
                                    key={f.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewFactorDetails?.(f.factor_id);
                                    }}
                                    className="py-1 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between cursor-pointer transition-colors group"
                                >
                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                                        {f.factor_name}
                                    </span>
                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] shrink-0">
                                        {Number(f.weighted_average).toFixed(1)}
                                    </span>
                                </div>
                            ))}
                            {fodaGroups.strength.length === 0 && (
                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-2">
                                    Sin factores en este cuadrante
                                </span>
                            )}
                        </div>
                    </div>

                    {/* OPORTUNIDADES (O) */}
                    <div
                        onClick={() => setSelectedFodaFilter(selectedFodaFilter === 'opportunity' ? 'all' : 'opportunity')}
                        className={`p-3.5 bg-[var(--color-bg-surface)] transition-all cursor-pointer ${
                            selectedFodaFilter === 'opportunity' ? 'ring-1 ring-[var(--color-border-focus)]' : ''
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                OPORTUNIDADES (O)
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {fodaGroups.opportunity.length}
                            </span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2">
                            Factores Externos con PM ≥ 3.0
                        </p>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                            {fodaGroups.opportunity.map((f) => (
                                <div
                                    key={f.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewFactorDetails?.(f.factor_id);
                                    }}
                                    className="py-1 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between cursor-pointer transition-colors group"
                                >
                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                                        {f.factor_name}
                                    </span>
                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] shrink-0">
                                        {Number(f.weighted_average).toFixed(1)}
                                    </span>
                                </div>
                            ))}
                            {fodaGroups.opportunity.length === 0 && (
                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-2">
                                    Sin factores en este cuadrante
                                </span>
                            )}
                        </div>
                    </div>

                    {/* DEBILIDADES (D) */}
                    <div
                        onClick={() => setSelectedFodaFilter(selectedFodaFilter === 'weakness' ? 'all' : 'weakness')}
                        className={`p-3.5 bg-[var(--color-bg-surface)] transition-all cursor-pointer ${
                            selectedFodaFilter === 'weakness' ? 'ring-1 ring-[var(--color-border-focus)]' : ''
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                DEBILIDADES (D)
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {fodaGroups.weakness.length}
                            </span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2">
                            Factores Internos con PM &lt; 3.0
                        </p>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                            {fodaGroups.weakness.map((f) => (
                                <div
                                    key={f.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewFactorDetails?.(f.factor_id);
                                    }}
                                    className="py-1 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between cursor-pointer transition-colors group"
                                >
                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                                        {f.factor_name}
                                    </span>
                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] shrink-0">
                                        {Number(f.weighted_average).toFixed(1)}
                                    </span>
                                </div>
                            ))}
                            {fodaGroups.weakness.length === 0 && (
                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-2">
                                    Sin factores en este cuadrante
                                </span>
                            )}
                        </div>
                    </div>

                    {/* AMENAZAS (A) */}
                    <div
                        onClick={() => setSelectedFodaFilter(selectedFodaFilter === 'threat' ? 'all' : 'threat')}
                        className={`p-3.5 bg-[var(--color-bg-surface)] transition-all cursor-pointer ${
                            selectedFodaFilter === 'threat' ? 'ring-1 ring-[var(--color-border-focus)]' : ''
                        }`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                AMENAZAS (A)
                            </span>
                            <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                {fodaGroups.threat.length}
                            </span>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mb-2">
                            Factores Externos con PM &lt; 3.0
                        </p>
                        <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1 divide-y divide-[var(--color-border-subtle)]/40">
                            {fodaGroups.threat.map((f) => (
                                <div
                                    key={f.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewFactorDetails?.(f.factor_id);
                                    }}
                                    className="py-1 px-1.5 rounded hover:bg-[var(--color-bg-page)] text-xs flex items-center justify-between cursor-pointer transition-colors group"
                                >
                                    <span className="truncate pr-2 font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">
                                        {f.factor_name}
                                    </span>
                                    <span className="font-mono text-[11px] text-[var(--color-text-secondary)] shrink-0">
                                        {Number(f.weighted_average).toFixed(1)}
                                    </span>
                                </div>
                            ))}
                            {fodaGroups.threat.length === 0 && (
                                <span className="text-[10px] text-[var(--color-text-tertiary)] italic block text-center py-2">
                                    Sin factores en este cuadrante
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(EvaluationVerdictSWOTTab);
