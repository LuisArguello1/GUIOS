import { useState, useMemo, useCallback } from 'react';
import { Sliders, Plus, BookOpen, Sparkles, RefreshCw, Layers, Compass, ListFilter, Quote } from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../components/ui/Button';
import PermissionGuard from '../../../components/ui/PermissionGuard';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import Pagination from '../../../components/ui/Pagination';

import { useFactors } from '../../../hooks/useFactors';
import { useDimensions } from '../../../hooks/useDimensions';
import type { Factor } from '../../../api/factorService';

import FactorsFilters from './components/FactorsFilters';
import FactorsTable from './components/FactorsTable';
import FactorFormModal from './components/FactorFormModal';
import FactorDetailModal from './components/FactorDetailModal';
import SubfactorsSection from '../subfactors/SubfactorsSection';

export const FactorsPage = () => {
    const {
        factors,
        total,
        loading,
        filters,
        setFilters,
        resetFilters,
        fetchFactors,
        fetchFactorDetail,
        createFactor,
        updateFactor,
        deleteFactor,
    } = useFactors();

    const { dimensions } = useDimensions();

    // Tab activo: 'factors' | 'subfactors'
    const [activeTab, setActiveTab] = useState<'factors' | 'subfactors'>('factors');

    // Estados de interacción modal
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingFactor, setEditingFactor] = useState<Factor | null>(null);

    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [viewingFactor, setViewingFactor] = useState<Factor | null>(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [factorToDelete, setFactorToDelete] = useState<Factor | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Garantizar array seguro
    const safeFactors = useMemo(() => {
        return Array.isArray(factors) ? factors : [];
    }, [factors]);

    const safeDimensions = useMemo(() => {
        return Array.isArray(dimensions) ? dimensions : [];
    }, [dimensions]);

    // Métricas KPI
    const stats = useMemo(() => {
        const total = safeFactors.length;
        const baseCount = safeFactors.filter((f) => f.is_base).length;
        const customCount = total - baseCount;
        const externalCount = safeFactors.filter((f) => f.scope === 'external').length;
        const internalCount = safeFactors.filter((f) => f.scope === 'internal').length;
        const totalSubfactors = safeFactors.reduce((acc, f) => acc + (f.subfactors_count || 0), 0);
        return { total, baseCount, customCount, externalCount, internalCount, totalSubfactors };
    }, [safeFactors]);

    // Handlers
    const handleOpenCreate = useCallback(() => {
        setEditingFactor(null);
        setIsFormOpen(true);
    }, []);

    const handleOpenEdit = useCallback((factor: Factor) => {
        setEditingFactor(factor);
        setIsFormOpen(true);
    }, []);

    const handleOpenDetail = useCallback((factor: Factor) => {
        setViewingFactor(factor);
        setIsDetailOpen(true);
    }, []);

    const handleOpenDelete = useCallback((factor: Factor) => {
        setFactorToDelete(factor);
        setIsDeleteModalOpen(true);
    }, []);

    const handleConfirmDelete = async () => {
        if (!factorToDelete) return;
        setIsDeleting(true);
        const ok = await deleteFactor(factorToDelete.id);
        setIsDeleting(false);
        if (ok) {
            setIsDeleteModalOpen(false);
            setFactorToDelete(null);
        }
    };

    const handleFormSubmit = async (payload: Parameters<typeof createFactor>[0]) => {
        if (editingFactor) {
            return await updateFactor(editingFactor.id, payload);
        } else {
            return await createFactor(payload);
        }
    };

    return (
        <div className="space-y-4">
            {/* ── Encabezado Principal ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-xs">
                        {activeTab === 'factors' ? <Sliders size={22} /> : <Quote size={22} />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-tight">
                                {activeTab === 'factors' ? 'Factores de Evaluación' : 'Criterios Evaluables (Subfactores)'}
                            </h1>
                            <span className="hidden sm:inline-block text-[10px] font-semibold font-mono px-2 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] text-[var(--color-primary)] border border-[var(--color-border-subtle)]">
                                Catálogo Maestro GUIOS
                            </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                            {activeTab === 'factors'
                                ? 'Criterios de segundo nivel con Importancia Sistémica (IS), Experto (IE) y Literatura (IL).'
                                : 'Afirmaciones verificables de tercer nivel evaluadas con escala 1-4 en el proceso.'}
                        </p>
                    </div>
                </div>

                {activeTab === 'factors' && (
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => fetchFactors()}
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
                                <span>Nuevo Factor</span>
                            </Button>
                        </PermissionGuard>
                    </div>
                )}
            </div>

            {/* ── Selector de Pestañas (Tabs) ── */}
            <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] pb-1">
                <button
                    type="button"
                    onClick={() => setActiveTab('factors')}
                    className={clsx(
                        'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors',
                        activeTab === 'factors'
                            ? 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)]'
                    )}
                >
                    <Sliders size={14} />
                    <span>Factores</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                        {stats.total}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('subfactors')}
                    className={clsx(
                        'flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-[2px] transition-colors',
                        activeTab === 'subfactors'
                            ? 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)]'
                    )}
                >
                    <Quote size={14} />
                    <span>Subfactores / Criterios Evaluables</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                        {stats.totalSubfactors}
                    </span>
                </button>
            </div>

            {/* ── Vista Condicional según Pestaña Activa ── */}
            {activeTab === 'subfactors' ? (
                <SubfactorsSection />
            ) : (
                <>
                    {/* ── KPI Stat Cards ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                                    Total Factores
                                </span>
                                <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                                    {stats.total}
                                </span>
                            </div>
                            <Sliders size={16} className="text-[var(--color-text-tertiary)]" />
                        </div>

                        <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                                    Base de Tesis
                                </span>
                                <span className="text-base font-bold font-mono text-[var(--color-primary)]">
                                    {stats.baseCount}
                                </span>
                            </div>
                            <BookOpen size={16} className="text-[var(--color-primary)]" />
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
                            <Sparkles size={16} className="text-[var(--color-info-text)]" />
                        </div>

                        <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                                    Alcance Externo
                                </span>
                                <span className="text-base font-bold font-mono text-[var(--color-primary)]">
                                    {stats.externalCount}
                                </span>
                            </div>
                            <Compass size={16} className="text-[var(--color-primary)]" />
                        </div>

                        <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                                    Alcance Interno
                                </span>
                                <span className="text-base font-bold font-mono text-[var(--color-info-text)]">
                                    {stats.internalCount}
                                </span>
                            </div>
                            <Layers size={16} className="text-[var(--color-info-text)]" />
                        </div>

                        <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px] shadow-xs flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-medium text-[var(--color-text-secondary)] block">
                                    Subfactores
                                </span>
                                <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                                    {stats.totalSubfactors}
                                </span>
                            </div>
                            <ListFilter size={16} className="text-[var(--color-text-tertiary)]" />
                        </div>
                    </div>

                    {/* ── Barra de Filtros ── */}
                    <FactorsFilters
                        filters={filters}
                        dimensions={safeDimensions}
                        onChange={setFilters}
                        onReset={resetFilters}
                        totalCount={safeFactors.length}
                    />

                    {/* ── Tabla de Factores ── */}
                    <FactorsTable
                        factors={safeFactors}
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

                    {/* ── Modal de Creación / Edición de Factor ── */}
                    <FactorFormModal
                        isOpen={isFormOpen}
                        onClose={() => setIsFormOpen(false)}
                        factorToEdit={editingFactor}
                        dimensions={safeDimensions}
                        onSubmit={handleFormSubmit}
                    />

                    {/* ── Modal de Detalle con Subfactores ── */}
                    <FactorDetailModal
                        isOpen={isDetailOpen}
                        onClose={() => setIsDetailOpen(false)}
                        factor={viewingFactor}
                        fetchDetail={fetchFactorDetail}
                        onAddSubfactor={() => {
                            setIsDetailOpen(false);
                            setActiveTab('subfactors');
                        }}
                    />

                    {/* ── Modal de Confirmación de Eliminación ── */}
                    <ConfirmModal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        onConfirm={handleConfirmDelete}
                        isLoading={isDeleting}
                        title="Eliminar Factor"
                        message={`¿Estás seguro de que deseas eliminar permanentemente el factor "${factorToDelete?.name}"? Esta acción no se puede deshacer.`}
                        confirmText="Sí, Eliminar Factor"
                        cancelText="Cancelar"
                        variant="danger"
                    />
                </>
            )}
        </div>
    );
};

export default FactorsPage;
