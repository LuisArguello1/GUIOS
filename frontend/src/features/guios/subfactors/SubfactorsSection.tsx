import React, { useState, useMemo, useCallback, memo } from 'react';
import { Quote, Plus, RefreshCw, Bookmark, Sparkles, Hash, CheckCircle2 } from 'lucide-react';

import Button from '../../../components/ui/Button';
import PermissionGuard from '../../../components/ui/PermissionGuard';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import Pagination from '../../../components/ui/Pagination';

import { useSubfactors } from '../../../hooks/useSubfactors';
import { useFactors } from '../../../hooks/useFactors';
import { useDimensions } from '../../../hooks/useDimensions';
import type { Subfactor } from '../../../api/subfactorService';

import SubfactorsFilters from './components/SubfactorsFilters';
import SubfactorsTable from './components/SubfactorsTable';
import SubfactorFormModal from './components/SubfactorFormModal';
import SubfactorDetailModal from './components/SubfactorDetailModal';

export const SubfactorsSection: React.FC = () => {
    const {
        subfactors,
        total,
        loading,
        filters,
        setFilters,
        resetFilters,
        fetchSubfactors,
        createSubfactor,
        updateSubfactor,
        deleteSubfactor,
    } = useSubfactors();

    const { factors } = useFactors();
    const { dimensions } = useDimensions();

    // Estados de modales
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSubfactor, setEditingSubfactor] = useState<Subfactor | null>(null);

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewingSubfactor, setViewingSubfactor] = useState<Subfactor | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [subfactorToDelete, setSubfactorToDelete] = useState<Subfactor | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const safeSubfactors = useMemo(() => {
        return Array.isArray(subfactors) ? subfactors : [];
    }, [subfactors]);

    const safeFactors = useMemo(() => {
        return Array.isArray(factors) ? factors : [];
    }, [factors]);

    const safeDimensions = useMemo(() => {
        return Array.isArray(dimensions) ? dimensions : [];
    }, [dimensions]);

    // Métricas KPI
    const stats = useMemo(() => {
        const count = safeSubfactors.length;
        const baseCount = safeSubfactors.filter((s) => s.is_base).length;
        const customCount = count - baseCount;
        const activeCount = safeSubfactors.filter((s) => s.is_active).length;
        const totalCitations = safeSubfactors.reduce((acc, s) => acc + (s.base_citations_count || 0), 0);
        return { count, baseCount, customCount, activeCount, totalCitations };
    }, [safeSubfactors]);

    // Handlers
    const handleOpenCreate = useCallback(() => {
        setEditingSubfactor(null);
        setIsFormOpen(true);
    }, []);

    const handleOpenEdit = useCallback((sub: Subfactor) => {
        setEditingSubfactor(sub);
        setIsFormOpen(true);
    }, []);

    const handleOpenDetail = useCallback((sub: Subfactor) => {
        setViewingSubfactor(sub);
        setIsDetailOpen(true);
    }, []);

    const handleOpenDelete = useCallback((sub: Subfactor) => {
        setSubfactorToDelete(sub);
        setIsDeleteModalOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (!subfactorToDelete) return;
        setIsDeleting(true);
        const ok = await deleteSubfactor(subfactorToDelete.id);
        setIsDeleting(false);
        if (ok) {
            setIsDeleteModalOpen(false);
            setSubfactorToDelete(null);
        }
    };

    const handleFormSubmit = async (payload: Parameters<typeof createSubfactor>[0]) => {
        if (editingSubfactor) {
            return await updateSubfactor(editingSubfactor.id, payload);
        } else {
            return await createSubfactor(payload);
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Toolbar de Acción ── */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Criterios Evaluables (Subfactores)
                    </h2>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Afirmaciones verificables de tercer nivel calificadas en la evaluación (Escala 1-4).
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => fetchSubfactors()}
                        disabled={loading}
                        title="Refrescar lista"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Actualizar</span>
                    </Button>

                    <PermissionGuard require="guios.factor_create">
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={handleOpenCreate}
                        >
                            <Plus size={15} />
                            <span>Nuevo Subfactor</span>
                        </Button>
                    </PermissionGuard>
                </div>
            </div>

            {/* ── KPI Stat Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                            Total Criterios
                        </span>
                        <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                            {stats.count}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-primary)]">
                        <Quote size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                            Base Oficial (Tesis)
                        </span>
                        <span className="text-base font-bold font-mono text-[var(--color-primary)]">
                            {stats.baseCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Bookmark size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                            Personalizados
                        </span>
                        <span className="text-base font-bold font-mono text-[var(--color-info-text)]">
                            {stats.customCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                        <Sparkles size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                            Criterios Activos
                        </span>
                        <span className="text-base font-bold font-mono text-[var(--color-success-text)]">
                            {stats.activeCount}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-success-bg)] text-[var(--color-success-text)]">
                        <CheckCircle2 size={18} />
                    </div>
                </div>

                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between col-span-2 sm:col-span-1">
                    <div>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                            Citas Base Totales
                        </span>
                        <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                            {stats.totalCitations}
                        </span>
                    </div>
                    <div className="p-2 rounded-[4px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)]">
                        <Hash size={18} />
                    </div>
                </div>
            </div>

            {/* ── Filtros Avanzados ── */}
            <SubfactorsFilters
                filters={filters}
                dimensions={safeDimensions}
                factors={safeFactors}
                onChange={setFilters}
                onReset={resetFilters}
                totalCount={total}
            />

            {/* ── Tabla de Subfactores ── */}
            <SubfactorsTable
                subfactors={safeSubfactors}
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
            <SubfactorFormModal
                isOpen={isFormOpen}
                onClose={() => {
                    setIsFormOpen(false);
                    setEditingSubfactor(null);
                }}
                subfactorToEdit={editingSubfactor}
                factors={safeFactors}
                dimensions={safeDimensions}
                onSubmit={handleFormSubmit}
            />

            {/* ── Modal de Detalle ── */}
            <SubfactorDetailModal
                isOpen={isDetailOpen}
                onClose={() => {
                    setIsDetailOpen(false);
                    setViewingSubfactor(null);
                }}
                subfactor={viewingSubfactor}
                onEdit={handleOpenEdit}
            />

            {/* ── Modal de Confirmación de Eliminación ── */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSubfactorToDelete(null);
                }}
                onConfirm={handleConfirmDelete}
                title="Eliminar Subfactor de Evaluación"
                message={
                    subfactorToDelete
                        ? `¿Está seguro de que desea eliminar el subfactor: "${subfactorToDelete.description.substring(
                              0,
                              80
                          )}..."? Esta acción no se puede deshacer.`
                        : ''
                }
                confirmText="Sí, Eliminar Subfactor"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    );
};

export default memo(SubfactorsSection);
