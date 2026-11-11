/**
 * features/guios/evaluations/components/detail/EvaluationDetailHeader.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Encabezado institucional de la evaluación con metadatos de software,
 * badges de estado/dictamen y botones de exportación oficial.
 *
 * Principio:
 * - Diseño limpio, sin bordes duplicados ni ruido visual.
 * - Estética titanio/platino sobria y profesional.
 */

import React, { memo } from 'react';
import {
    ArrowLeft,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Cpu,
    ExternalLink,
    FileDown,
    FileSpreadsheet,
    GitBranch,
    RefreshCw,
    Sparkles,
    User,
    CheckCheck,
    AlertTriangle,
    AlertCircle,
} from 'lucide-react';
import Button from '../../../../../components/ui/Button';
import PermissionGuard from '../../../../../components/ui/PermissionGuard';
import type { EvaluationDetail, RecommendationType } from '../../../../../api/evaluationService';

interface EvaluationDetailHeaderProps {
    evaluation: EvaluationDetail;
    downloadingFormat: 'pdf' | 'excel' | null;
    onDownloadPdf: () => Promise<void>;
    onDownloadExcel: () => Promise<void>;
    onOpenAILogs: () => void;
    onBackToList: () => void;
    onRefresh: () => void;
    loading: boolean;
}

const RecommendationPill: React.FC<{
    recommendation: RecommendationType | null | undefined;
    recommendationDisplay?: string | null;
}> = ({ recommendation, recommendationDisplay }) => {
    if (!recommendation) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)] text-[11px] font-mono">
                <Clock size={11} />
                Dictamen Pendiente
            </span>
        );
    }

    if (recommendation === 'A') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-xs)] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold font-mono tracking-wide">
                <CheckCheck size={12} className="text-emerald-500" />
                {recommendationDisplay || 'DICTAMEN A • ADOPCIÓN FAVORABLE'}
            </span>
        );
    }

    if (recommendation === 'B') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-xs)] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-bold font-mono tracking-wide">
                <AlertTriangle size={12} className="text-amber-500" />
                {recommendationDisplay || 'DICTAMEN B • ADOPCIÓN CONDICIONADA'}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-xs)] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold font-mono tracking-wide">
            <AlertCircle size={12} className="text-rose-500" />
            {recommendationDisplay || 'DICTAMEN C • ADOPCIÓN POSPUESTA'}
        </span>
    );
};

export const EvaluationDetailHeader: React.FC<EvaluationDetailHeaderProps> = ({
    evaluation,
    downloadingFormat,
    onDownloadPdf,
    onDownloadExcel,
    onOpenAILogs,
    onBackToList,
    onRefresh,
    loading,
}) => {
    const isCompleted = evaluation.status === 'completed';
    const effectiveRecommendation = evaluation.verdict?.recommendation || evaluation.recommendation;
    const effectiveRecommendationDisplay = evaluation.verdict?.recommendation_display;

    return (
        <div className="space-y-2.5">
            {/* ── Breadcrumb & Botón Refrescar ── */}
            <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                    <button
                        type="button"
                        onClick={onBackToList}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors cursor-pointer font-medium"
                    >
                        <ArrowLeft size={13} />
                        <span>Evaluaciones FLOSS</span>
                    </button>
                    <span className="text-[var(--color-text-tertiary)]">/</span>
                    <span className="text-[var(--color-text-primary)] font-semibold truncate max-w-xs sm:max-w-md">
                        {evaluation.software_name}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={onRefresh}
                        disabled={loading}
                        className="text-xs flex items-center gap-1.5 py-1"
                        title="Actualizar datos de la evaluación"
                    >
                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Refrescar</span>
                    </Button>
                </div>
            </div>

            {/* ── Cabecera Principal de la Evaluación ── */}
            <div className="p-4 sm:p-5 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Identidad del Software Evaluado */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--color-text-primary)]">
                                {evaluation.software_name}
                            </h1>

                            {evaluation.software_version && (
                                <span className="font-mono text-xs px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] font-semibold">
                                    v{evaluation.software_version}
                                </span>
                            )}

                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
                                {evaluation.software_category || 'Software Libre'}
                            </span>

                            {evaluation.software_repo_url && (
                                <a
                                    href={evaluation.software_repo_url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                                    title="Visitar repositorio oficial del software"
                                >
                                    <GitBranch size={12} className="text-[var(--color-text-tertiary)]" />
                                    <span>Repo</span>
                                    <ExternalLink size={10} className="text-[var(--color-text-tertiary)]" />
                                </a>
                            )}
                        </div>

                        {/* Metadatos Institucionales en línea limpia */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                            <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-text-primary)]">
                                <Building2 size={13} className="text-[var(--color-text-tertiary)]" />
                                {evaluation.org_name}
                                {evaluation.org_sector && (
                                    <span className="text-[var(--color-text-tertiary)] font-normal">
                                        ({evaluation.org_sector})
                                    </span>
                                )}
                            </span>

                            <span className="inline-flex items-center gap-1.5 font-mono text-[var(--color-text-secondary)]">
                                <User size={13} className="text-[var(--color-text-tertiary)]" />
                                {evaluation.created_by_username || 'Sistema'}
                            </span>

                            <span className="inline-flex items-center gap-1.5 font-mono text-[var(--color-text-secondary)]">
                                <Calendar size={13} className="text-[var(--color-text-tertiary)]" />
                                {new Date(evaluation.started_at).toLocaleDateString()}
                            </span>

                            {evaluation.completed_at && (
                                <span className="inline-flex items-center gap-1.5 font-mono text-[var(--color-text-secondary)]">
                                    <CheckCircle2 size={13} className="text-[var(--color-text-tertiary)]" />
                                    Cierre: {new Date(evaluation.completed_at).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Acciones y Exportaciones */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Botón Auditoría IA */}
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={onOpenAILogs}
                            className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            title="Inspeccionar telemetría y auditoría de IA"
                        >
                            <Cpu size={12} className="text-[var(--color-text-tertiary)]" />
                            <span>Logs IA</span>
                        </Button>

                        {/* Botones de Descarga */}
                        <PermissionGuard require="guios.evaluation_export">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onDownloadPdf}
                                disabled={downloadingFormat === 'pdf'}
                                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                title="Descargar Dossier Técnico Oficial en PDF"
                            >
                                <FileDown size={12} className={downloadingFormat === 'pdf' ? 'animate-bounce text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'} />
                                <span>{downloadingFormat === 'pdf' ? 'Generando PDF...' : 'Dossier PDF'}</span>
                            </Button>

                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={onDownloadExcel}
                                disabled={downloadingFormat === 'excel'}
                                className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                title="Descargar Libro de Métricas y Matriz en Excel"
                            >
                                <FileSpreadsheet size={12} className={downloadingFormat === 'excel' ? 'animate-bounce text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]'} />
                                <span>{downloadingFormat === 'excel' ? 'Generando Excel...' : 'Matriz Excel'}</span>
                            </Button>
                        </PermissionGuard>
                    </div>
                </div>

                {/* ── Barra de Estado y Dictamen ── */}
                <div className="mt-3.5 pt-3 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Estado Metodológico */}
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] text-[11px] font-medium font-mono">
                            {isCompleted ? <CheckCircle2 size={11} className="text-[var(--color-text-tertiary)]" /> : <Clock size={11} className="text-[var(--color-text-tertiary)]" />}
                            {isCompleted ? 'Evaluación Finalizada' : 'Auditoría en Curso'}
                        </span>

                        {/* Dictamen Vinculante */}
                        <RecommendationPill
                            recommendation={effectiveRecommendation}
                            recommendationDisplay={effectiveRecommendationDisplay}
                        />

                        {/* Asistencia de IA */}
                        {evaluation.ai_enabled ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] text-[10px] font-mono border border-[var(--color-border-subtle)]">
                                <Sparkles size={10} className="text-[var(--color-primary)]" />
                                IA: {evaluation.ai_status}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] text-[10px] font-mono border border-[var(--color-border-subtle)]">
                                Base
                            </span>
                        )}
                    </div>

                    <div className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                        UUID: <span className="text-[var(--color-text-secondary)]">{evaluation.uuid}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(EvaluationDetailHeader);
