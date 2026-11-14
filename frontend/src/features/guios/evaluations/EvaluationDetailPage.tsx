/**
 * features/guios/evaluations/EvaluationDetailPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de Detalle de Evaluación de Software (FLOSS) para la consola administrativa.
 *
 * Arquitectura:
 * - Header Institucional con metadatos de software, organización y acciones de exportación.
 * - Barra de KPIs cuantitativos y metodológicos (PM, Factores, Subfactores, FODA).
 * - Sistema de pestañas:
 *   1. Dictamen Oficial y Matriz FODA 2x2 (con Resumen y Plan de Mitigación de IA).
 *   2. Mapeo de Factores, Literatura Indexada (r_i, IL) e Importancia del Decisor (ID, IR).
 *   3. Auditoría Técnica de los 61 Subfactores (calificaciones y justificaciones de IA).
 *   4. Análisis Cuantitativo y Gráficos Estadísticos por Dimensión.
 * - Modales de inspección forense de fuentes bibliográficas y logs de IA.
 */

import React, { useState, memo } from 'react';
import {
    AlertCircle,
    ArrowLeft,
    Award,
    BarChart3,
    BookOpen,
    Filter,
    Layers,
} from 'lucide-react';

import Button from '../../../components/ui/Button';
import Loading from '../../../components/ui/Loading';

import useEvaluationDetail from './hooks/useEvaluationDetail';
import EvaluationDetailHeader from './components/detail/EvaluationDetailHeader';
import EvaluationDetailKPIs from './components/detail/EvaluationDetailKPIs';
import EvaluationVerdictSWOTTab from './components/detail/EvaluationVerdictSWOTTab';
import EvaluationFactorsTab from './components/detail/EvaluationFactorsTab';
import EvaluationSubfactorsTab from './components/detail/EvaluationSubfactorsTab';
import EvaluationQuantitativeTab from './components/detail/EvaluationQuantitativeTab';
import EvaluationLiteratureTab from './components/detail/EvaluationLiteratureTab';
import FactorSourcesModal from './components/detail/FactorSourcesModal';
import AILogsModal from './components/AILogsModal';

type TabKey = 'verdict' | 'factors' | 'subfactors' | 'quantitative' | 'literature';

export const EvaluationDetailPage: React.FC = () => {
    const {
        evaluationId,
        evaluation,
        loading,
        error,
        downloadingFormat,
        syncingRepoHealth,
        metrics,
        activeFactorSources,
        isSourcesModalOpen,
        isAILogsOpen,
        handleDownloadPdf,
        handleDownloadExcel,
        handleSyncRepoHealth,
        handleOpenSourcesModal,
        handleCloseSourcesModal,
        handleOpenAILogs,
        handleCloseAILogs,
        handleBackToList,
        refetch,
    } = useEvaluationDetail();

    const [activeTab, setActiveTab] = useState<TabKey>('verdict');

    // ── Estado de Carga Inicial ──
    if (loading && !evaluation) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <button
                        type="button"
                        onClick={handleBackToList}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={14} />
                        <span>Volver a Evaluaciones</span>
                    </button>
                </div>
                <div className="p-12 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] flex flex-col items-center justify-center">
                    <Loading label="Cargando expediente técnico de la evaluación..." />
                </div>
            </div>
        );
    }

    // ── Estado de Error / Evaluación no encontrada ──
    if (error || !evaluation) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                    <button
                        type="button"
                        onClick={handleBackToList}
                        className="inline-flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={14} />
                        <span>Volver a Evaluaciones</span>
                    </button>
                </div>

                <div className="p-8 rounded-[var(--radius-md)] bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-center space-y-4">
                    <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                        <AlertCircle size={32} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                            No se pudo acceder al expediente técnico
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto mt-1">
                            {error || `La evaluación con identificador #${evaluationId} no existe o no tiene permisos suficientes para auditarla.`}
                        </p>
                    </div>
                    <div className="flex justify-center gap-2">
                        <Button variant="secondary" size="sm" onClick={refetch}>
                            Reintentar
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleBackToList}>
                            Ir al Listado
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── 1. Encabezado Oficial con Metadatos y Exportaciones ── */}
            <EvaluationDetailHeader
                evaluation={evaluation}
                downloadingFormat={downloadingFormat}
                onDownloadPdf={handleDownloadPdf}
                onDownloadExcel={handleDownloadExcel}
                onOpenAILogs={handleOpenAILogs}
                onBackToList={handleBackToList}
                onRefresh={refetch}
                loading={loading}
            />

            {/* ── 2. Indicadores Cuantitativos Clave (KPIs Metodológicos) ── */}
            <EvaluationDetailKPIs
                evaluation={evaluation}
                metrics={metrics}
                onSelectTab={setActiveTab}
            />

            {/* ── 3. Navegación por Pestañas Metodológicas ── */}
            <div className="border-b border-[var(--color-border-subtle)] flex items-center gap-1 overflow-x-auto text-xs font-semibold">
                <button
                    type="button"
                    onClick={() => setActiveTab('verdict')}
                    className={`py-2 px-3.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        activeTab === 'verdict'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    <Award size={14} />
                    <span>Resolución y Matriz FODA</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('factors')}
                    className={`py-2 px-3.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        activeTab === 'factors'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    <Filter size={14} />
                    <span>Factores y Decisor ({metrics.relevantFactorsCount}/{metrics.totalFactorsCount})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('subfactors')}
                    className={`py-2 px-3.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        activeTab === 'subfactors'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    <Layers size={14} />
                    <span>Auditoría de Subfactores ({metrics.ratedSubfactorsCount}/{metrics.totalSubfactorsCount})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('quantitative')}
                    className={`py-2 px-3.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        activeTab === 'quantitative'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    <BarChart3 size={14} />
                    <span>Análisis Cuantitativo</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('literature')}
                    className={`py-2 px-3.5 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        activeTab === 'literature'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-bold'
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                >
                    <BookOpen size={14} />
                    <span>Literatura Indexada (IL)</span>
                </button>
            </div>

            {/* ── 4. Contenido de la Pestaña Activa ── */}
            <div className="pt-1">
                {activeTab === 'verdict' && (
                    <EvaluationVerdictSWOTTab
                        evaluation={evaluation}
                        onViewFactorDetails={() => setActiveTab('factors')}
                        onSyncRepoHealth={handleSyncRepoHealth}
                        syncingRepoHealth={syncingRepoHealth}
                    />
                )}

                {activeTab === 'factors' && (
                    <EvaluationFactorsTab
                        factors={evaluation.factors || []}
                        subfactors={evaluation.subfactors || []}
                        results={evaluation.results || []}
                        onOpenSources={handleOpenSourcesModal}
                    />
                )}

                {activeTab === 'subfactors' && (
                    <EvaluationSubfactorsTab
                        factors={evaluation.factors || []}
                        subfactors={evaluation.subfactors || []}
                        results={evaluation.results || []}
                    />
                )}

                {activeTab === 'quantitative' && (
                    <EvaluationQuantitativeTab
                        evaluation={evaluation}
                        factors={evaluation.factors || []}
                        subfactors={evaluation.subfactors || []}
                        results={evaluation.results || []}
                    />
                )}

                {activeTab === 'literature' && (
                    <EvaluationLiteratureTab
                        evaluation={evaluation}
                        factors={evaluation.factors || []}
                        onOpenSources={handleOpenSourcesModal}
                    />
                )}
            </div>

            {/* ── 5. Modal de Fuentes y Literatura Indexada por Factor ── */}
            <FactorSourcesModal
                isOpen={isSourcesModalOpen}
                onClose={handleCloseSourcesModal}
                factor={activeFactorSources}
            />

            {/* ── 6. Modal de Auditoría de Logs de IA ── */}
            <AILogsModal
                isOpen={isAILogsOpen}
                onClose={handleCloseAILogs}
                evaluationId={evaluation.id}
                evaluationName={evaluation.software_name}
            />
        </div>
    );
};

export default memo(EvaluationDetailPage);
