import { useState, useMemo, useCallback } from 'react';
import { Layers, Clock, CheckCircle2, CheckCheck, RefreshCw, FileText, Cpu } from 'lucide-react';

import Button from '../../../components/ui/Button';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import Pagination from '../../../components/ui/Pagination';

import { useEvaluations } from '../../../hooks/useEvaluations';
import type { EvaluationItem } from '../../../api/evaluationService';

import EvaluationsFilters from './components/EvaluationsFilters';
import EvaluationsTable from './components/EvaluationsTable';
import AILogsModal from './components/AILogsModal';


export const EvaluationsPage = () => {
    const {
        evaluations,
        total,
        loading,
        filters,
        setFilters,
        resetFilters,
        fetchEvaluations,
        fetchEvaluationDetail,
        handleDeleteEvaluation,
    } = useEvaluations();

    // Estados de modales de administración
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [evaluationToDelete, setEvaluationToDelete] = useState<EvaluationItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Modal de Auditoría de Logs de IA
    const [isAILogsOpen, setIsAILogsOpen] = useState(false);
    const [activeLogEvaluation, setActiveLogEvaluation] = useState<EvaluationItem | null>(null);

    const safeEvaluations = useMemo(() => {
        return Array.isArray(evaluations) ? evaluations : [];
    }, [evaluations]);

    // Métricas KPI
    const stats = useMemo(() => {
        const totalCount = total || safeEvaluations.length;
        const inProgressCount = safeEvaluations.filter((e) => e.status === 'in_progress').length;
        const completedCount = safeEvaluations.filter((e) => e.status === 'completed').length;
        const recACount = safeEvaluations.filter((e) => e.recommendation === 'A').length;
        return { totalCount, inProgressCount, completedCount, recACount };
    }, [safeEvaluations, total]);

    // Handlers
    const handleOpenAILogs = useCallback((item?: EvaluationItem) => {
        setActiveLogEvaluation(item || null);
        setIsAILogsOpen(true);
    }, []);

    const handleOpenDelete = useCallback((item: EvaluationItem) => {
        setEvaluationToDelete(item);
        setIsDeleteModalOpen(true);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (!evaluationToDelete) return;
        setIsDeleting(true);
        const success = await handleDeleteEvaluation(evaluationToDelete.id);
        setIsDeleting(false);
        if (success) {
            setIsDeleteModalOpen(false);
            setEvaluationToDelete(null);
        }
    }, [evaluationToDelete, handleDeleteEvaluation]);

    const handleViewDetail = useCallback(
        (item: EvaluationItem) => {
            // Carga detalle en memoria para auditoría o visualización administrativa
            fetchEvaluationDetail(item.id);
        },
        [fetchEvaluationDetail]
    );

    const handlePageChange = useCallback(
        (newPage: number) => {
            setFilters({ page: newPage });
        },
        [setFilters]
    );

    return (
        <div className="space-y-4">
            {/* ── Encabezado Principal ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border-subtle)]">
                <div>
                    <h1 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                        <span className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                            <Layers size={20} />
                        </span>
                        Evaluaciones de Software (FLOSS)
                    </h1>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        Consola de administración y auditoría de evaluaciones de adopción realizadas en la plataforma
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAILogs()}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] border-[var(--color-primary)]/25 hover:bg-[var(--color-primary-soft-bg)]"
                        title="Auditoría global de logs e interacciones de Inteligencia Artificial"
                    >
                        <Cpu size={13} className="text-[var(--color-primary)]" />
                        <span>Auditoría IA</span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchEvaluations()}
                        disabled={loading}
                        className="flex items-center gap-1.5 text-xs"
                        title="Recargar lista de evaluaciones"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Actualizar</span>
                    </Button>
                </div>
            </div>

            {/* ── KPI Cards Métricos ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            Total Evaluaciones
                        </span>
                        <span className="text-xl font-bold font-mono text-[var(--color-text-primary)] mt-0.5 block">
                            {stats.totalCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <FileText size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            En Progreso
                        </span>
                        <span className="text-xl font-bold font-mono text-[var(--color-warning-text)] mt-0.5 block">
                            {stats.inProgressCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
                        <Clock size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            Completadas
                        </span>
                        <span className="text-xl font-bold font-mono text-[var(--color-info-text)] mt-0.5 block">
                            {stats.completedCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                        <CheckCircle2 size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block">
                            Recomendación A
                        </span>
                        <span className="text-xl font-bold font-mono text-[var(--color-success-text)] mt-0.5 block">
                            {stats.recACount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                        <CheckCheck size={18} />
                    </div>
                </div>
            </div>

            {/* ── Filtros y Búsqueda ── */}
            <EvaluationsFilters
                filters={filters}
                onChange={setFilters}
                onReset={resetFilters}
                totalCount={total || safeEvaluations.length}
            />

            {/* ── Tabla de Evaluaciones ── */}
            <EvaluationsTable
                evaluations={safeEvaluations}
                loading={loading}
                onViewDetail={handleViewDetail}
                onDelete={handleOpenDelete}
                onViewAILogs={handleOpenAILogs}
            />

            {/* ── Paginación ── */}
            <Pagination
                currentPage={filters.page || 1}
                totalItems={total || safeEvaluations.length}
                itemsPerPage={filters.page_size || 20}
                onPageChange={handlePageChange}
            />

            {/* ── Modal de Confirmación de Eliminación ── */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                title="Eliminar Sesión de Evaluación"
                message={`¿Está seguro de que desea eliminar la evaluación de "${evaluationToDelete?.software_name}"? Esta acción borrará permanentemente todas las métricas, ponderaciones del decisor y dictámenes calculados.`}
                confirmText={isDeleting ? 'Eliminando...' : 'Eliminar Evaluación'}
                cancelText="Cancelar"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setEvaluationToDelete(null);
                }}
            />

            {/* ── Modal de Auditoría de Logs de IA ── */}
            <AILogsModal
                isOpen={isAILogsOpen}
                onClose={() => {
                    setIsAILogsOpen(false);
                    setActiveLogEvaluation(null);
                }}
                evaluationId={activeLogEvaluation?.id}
                evaluationName={activeLogEvaluation?.software_name}
            />
        </div>
    );
};

export default EvaluationsPage;
