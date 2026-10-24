import { useState, useMemo, useCallback } from 'react';
import { Layers, Plus, BookOpen, Sliders, Sparkles, RefreshCw } from 'lucide-react';

import Button from '../../../components/ui/Button';
import PermissionGuard from '../../../components/ui/PermissionGuard';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import Pagination from '../../../components/ui/Pagination';

import { useDimensions } from '../../../hooks/useDimensions';
import type { Dimension } from '../../../api/dimensionService';

import DimensionsFilters from './components/DimensionsFilters';
import DimensionsTable from './components/DimensionsTable';
import DimensionFormModal from './components/DimensionFormModal';
import DimensionDetailModal from './components/DimensionDetailModal';

export const DimensionsPage = () => {
    const {
        dimensions,
        total,
        loading,
        filters,
        setFilters,
        resetFilters,
        fetchDimensions,
        fetchDimensionDetail,
        createDimension,
        updateDimension,
        deleteDimension,
    } = useDimensions();

    // Estados locales de interacción modal
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewingDimension, setViewingDimension] = useState<Dimension | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [dimensionToDelete, setDimensionToDelete] = useState<Dimension | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Garantizar que dimensions sea siempre un arreglo iterable
    const safeDimensions = useMemo(() => {
        return Array.isArray(dimensions) ? dimensions : [];
    }, [dimensions]);

    // Métricas calculadas para los KPI cards
    const stats = useMemo(() => {
        const totalCount = safeDimensions.length;
        const baseCount = safeDimensions.filter((d) => d.is_base).length;
        const customCount = totalCount - baseCount;
        const totalFactors = safeDimensions.reduce((acc, d) => acc + (d.factors_count || 0), 0);
        return { total: totalCount, baseCount, customCount, totalFactors };
    }, [safeDimensions]);

    // Handlers
    const handleOpenCreate = useCallback(() => {
        setEditingDimension(null);
        setIsFormOpen(true);
    }, []);

    const handleOpenEdit = useCallback((dim: Dimension) => {
        setEditingDimension(dim);
        setIsFormOpen(true);
    }, []);

    const handleOpenDetail = useCallback((dim: Dimension) => {
        setViewingDimension(dim);
        setIsDetailOpen(true);
    }, []);

    const handleOpenDelete = useCallback((dim: Dimension) => {
        setDimensionToDelete(dim);
        setIsDeleteModalOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (!dimensionToDelete) return;
        setIsDeleting(true);
        const ok = await deleteDimension(dimensionToDelete.id);
        setIsDeleting(false);
        if (ok) {
            setIsDeleteModalOpen(false);
            setDimensionToDelete(null);
        }
    };

    const handleFormSubmit = async (payload: Parameters<typeof createDimension>[0]) => {
        if (editingDimension) {
            return await updateDimension(editingDimension.id, payload);
        } else {
            return await createDimension(payload);
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Encabezado Principal ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-xs">
                        <Layers size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-tight">
                                Dimensiones de Evaluación
                            </h1>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            Catálogo maestro de dimensiones para evaluación y adopción de software libre.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchDimensions()}
                        disabled={loading}
                        title="Refrescar lista"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Actualizar</span>
                    </Button>

                    <PermissionGuard require="guios.dimension_create">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleOpenCreate}
                        >
                            <Plus size={15} />
                            <span>Nueva Dimensión</span>
                        </Button>
                    </PermissionGuard>
                </div>
            </div>

            {/* ── KPI Stat Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] block">
                            Total Dimensiones
                        </span>
                        <span className="text-lg font-bold font-mono text-[var(--color-text-primary)]">
                            {stats.total}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)]">
                        <Layers size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] block">
                            Base de Tesis (Oficiales)
                        </span>
                        <span className="text-lg font-bold font-mono text-[var(--color-primary)]">
                            {stats.baseCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <BookOpen size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] block">
                            Personalizadas
                        </span>
                        <span className="text-lg font-bold font-mono text-[var(--color-info-text)]">
                            {stats.customCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                        <Sparkles size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] block">
                            Factores Activos
                        </span>
                        <span className="text-lg font-bold font-mono text-[var(--color-text-primary)]">
                            {stats.totalFactors}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)]">
                        <Sliders size={18} />
                    </div>
                </div>
            </div>

            {/* ── Barra de Filtros ── */}
            <DimensionsFilters
                filters={filters}
                onChange={setFilters}
                onReset={resetFilters}
                totalCount={safeDimensions.length}
            />

            {/* ── Tabla de Dimensiones ── */}
            <DimensionsTable
                dimensions={safeDimensions}
                isLoading={loading}
                onViewDetail={handleOpenDetail}
                onEdit={handleOpenEdit}
                onDelete={handleOpenDelete}
            />

            <Pagination
                currentPage={filters.page || 1}
                totalItems={total}
                itemsPerPage={20}
                onPageChange={(page) => setFilters({ page })}
            />

            {/* ── Modal de Creación / Edición ── */}
            <DimensionFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                dimensionToEdit={editingDimension}
                onSubmit={handleFormSubmit}
            />

            {/* ── Modal de Detalle con Factores ── */}
            <DimensionDetailModal
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                dimension={viewingDimension}
                fetchDetail={fetchDimensionDetail}
            />

            {/* ── Modal de Confirmación de Eliminación ── */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                isLoading={isDeleting}
                title="Eliminar Dimensión"
                message={`¿Estás seguro de que deseas eliminar permanentemente la dimensión "${dimensionToDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Sí, Eliminar Dimensión"
                cancelText="Cancelar"
                variant="danger"
            />
        </div>
    );
};

export default DimensionsPage;
