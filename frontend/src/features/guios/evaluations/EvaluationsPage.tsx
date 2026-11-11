import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Clock, CheckCircle2, CheckCheck, RefreshCw, FileText, Cpu, ExternalLink, ArrowLeftRight } from 'lucide-react';

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
        handleDeleteEvaluation,
    } = useEvaluations();

    // Estados de modales de administración
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [evaluationToDelete, setEvaluationToDelete] = useState<EvaluationItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Modal de Auditoría de Logs de IA
    const [isAILogsOpen, setIsAILogsOpen] = useState(false);
    const [activeLogEvaluation, setActiveLogEvaluation] = useState<EvaluationItem | null>(null);

    // Selección de Evaluaciones para Comparación (Regla: Máximo 2)
    const [selectedEvaluationIds, setSelectedEvaluationIds] = useState<number[]>([]);

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

    const navigate = useNavigate();

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
            navigate(`/dashboard/guios/evaluaciones/${item.id}`);
        },
        [navigate]
    );

    // Handlers de Comparación
    const handleToggleSelect = useCallback((id: number) => {
        setSelectedEvaluationIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((item) => item !== id);
            }
            if (prev.length >= 2) {
                return prev; // No permitir más de 2
            }
            return [...prev, id];
        });
    }, []);

    const handleClearSelection = useCallback(() => {
        setSelectedEvaluationIds([]);
    }, []);

    const handleGoToCompare = useCallback(() => {
        if (selectedEvaluationIds.length !== 2) return;
        const [id1, id2] = selectedEvaluationIds;
        navigate(`/dashboard/guios/evaluaciones/comparar?id1=${id1}&id2=${id2}`);
    }, [selectedEvaluationIds, navigate]);

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
                        onClick={() => window.open('/evaluar', '_blank')}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] border-[var(--color-primary)]/25 hover:bg-[var(--color-primary-soft-bg)]"
                        title="Abrir asistente de evaluación pública en nueva pestaña"
                    >
                        <ExternalLink size={13} />
                        <span>Módulo Público</span>
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAILogs()}
                        className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-subtle)]"
                        title="Auditoría global de logs e interacciones de Inteligencia Artificial"
                    >
                        <Cpu size={13} />
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
                        <span className="text-xl font-bold font-mono text-[var(--color-text-primary)] mt-0.5 block">
                            {stats.completedCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-text-primary)]">
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
                selectedIds={selectedEvaluationIds}
                onToggleSelect={handleToggleSelect}
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

            {/* ── Barra Flotante de Comparación de Evaluaciones ── */}
            {selectedEvaluationIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[var(--color-bg-elevated)] border border-[var(--color-primary)]/40 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200">
                    <div className="flex items-center gap-2">
                        <span className="p-1 rounded-full bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                            <ArrowLeftRight size={14} />
                        </span>
                        <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">
                            {selectedEvaluationIds.length} de 2 seleccionadas
                        </span>
                        <span className="text-[11px] text-[var(--color-text-tertiary)] hidden sm:inline">
                            {selectedEvaluationIds.length === 1
                                ? '• Selecciona otra para comparar'
                                : '• Listas para contrastar'}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--color-border-subtle)]">
                        <Button
                            variant="primary"
                            size="sm"
                            disabled={selectedEvaluationIds.length !== 2}
                            onClick={handleGoToCompare}
                            className="h-7 px-3 text-xs font-bold flex items-center gap-1.5 shadow-xs"
                            title={
                                selectedEvaluationIds.length !== 2
                                    ? 'Selecciona exactamente 2 evaluaciones para comparar'
                                    : 'Abrir comparador técnico antes y después'
                            }
                        >
                            <ArrowLeftRight size={12} />
                            <span>Comparar (2)</span>
                        </Button>

                        <button
                            type="button"
                            onClick={handleClearSelection}
                            className="h-7 px-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)] rounded-[4px] transition-colors cursor-pointer"
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EvaluationsPage;
