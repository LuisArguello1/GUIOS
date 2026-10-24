import React, { useState, useEffect, memo } from 'react';
import { Sliders, Bookmark, ListFilter, Quote, Plus } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Loading from '../../../../components/ui/Loading';
import PermissionGuard from '../../../../components/ui/PermissionGuard';
import {
    EditActionButton,
    DeleteActionButton,
} from '../../../../components/ui/ActionIconButtons';
import type { Factor, FactorDetail, SubfactorItem } from '../../../../api/factorService';

interface FactorDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    factor: Factor | null;
    fetchDetail: (id: number | string) => Promise<FactorDetail | null>;
    onAddSubfactor?: (factor: Factor) => void;
    onEditSubfactor?: (subfactor: SubfactorItem, factor: Factor) => void;
    onDeleteSubfactor?: (subfactor: SubfactorItem) => void;
}

interface FactorDetailContentProps {
    onClose: () => void;
    factor: Factor;
    fetchDetail: (id: number | string) => Promise<FactorDetail | null>;
    onAddSubfactor?: (factor: Factor) => void;
    onEditSubfactor?: (subfactor: SubfactorItem, factor: Factor) => void;
    onDeleteSubfactor?: (subfactor: SubfactorItem) => void;
}

const FactorDetailContent: React.FC<FactorDetailContentProps> = ({
    onClose,
    factor,
    fetchDetail,
    onAddSubfactor,
    onEditSubfactor,
    onDeleteSubfactor,
}) => {
    const [detail, setDetail] = useState<FactorDetail | null>(null);

    useEffect(() => {
        let isMounted = true;
        fetchDetail(factor.id).then((res) => {
            if (isMounted) {
                setDetail(res);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [factor.id, fetchDetail]);

    const isLoading = !detail;
    const subfactors = detail?.subfactors ?? [];

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Sliders size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                {factor.name}
                            </h3>
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-primary)]">
                                #{factor.order}
                            </span>
                            {factor.is_base ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <Bookmark size={10} /> Base Oficial
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                    Personalizado
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            Dimensión: #{factor.dimension?.order} {factor.dimension?.name}
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end w-full">
                    <Button variant="secondary" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Métricas clave */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Importancia Sugerida (IS)</span>
                        <span className="text-base font-bold font-mono text-[var(--color-primary)]">
                            Nivel {factor.systemic_importance}
                        </span>
                    </div>

                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Importancia Experto (IE)</span>
                        <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                            Nivel {factor.expert_importance}
                        </span>
                    </div>

                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Literatura Base (IL)</span>
                        <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                            Nivel {factor.literature_importance_base}
                        </span>
                    </div>

                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Alcance FODA</span>
                        <span className="text-xs font-bold text-[var(--color-info-text)] block mt-0.5">
                            {factor.scope === 'external'
                                ? 'Externo (Software)'
                                : factor.scope === 'internal'
                                ? 'Interno (Org)'
                                : 'Ambos'}
                        </span>
                    </div>
                </div>

                {/* Subfactores */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <ListFilter size={14} className="text-[var(--color-primary)]" />
                            Criterios Evaluables / Subfactores ({subfactors.length})
                        </span>
                        {onAddSubfactor && (
                            <PermissionGuard require="guios.factor_create">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => onAddSubfactor(factor)}
                                    className="flex items-center gap-1 text-[11px] py-1 px-2"
                                >
                                    <Plus size={12} />
                                    <span>Añadir Criterio</span>
                                </Button>
                            </PermissionGuard>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="py-8 flex justify-center">
                            <Loading label="Cargando subfactores asociados..." />
                        </div>
                    ) : subfactors.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                            Este factor no tiene subfactores asociados actualmente.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[4px] bg-[var(--color-bg-page)]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        <th className="px-3 py-2 text-center w-12">#</th>
                                        <th className="px-3 py-2">Afirmación / Criterio Verificable</th>
                                        <th className="px-3 py-2 text-center w-28">Citas Base</th>
                                        <th className="px-3 py-2 w-44">Términos Clave IA</th>
                                        {(onEditSubfactor || onDeleteSubfactor) && (
                                            <th className="px-3 py-2 text-center w-20">Acciones</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                    {subfactors.map((sub, idx) => (
                                        <tr key={sub.id} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                                            <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--color-text-tertiary)]">
                                                {sub.order || idx + 1}
                                            </td>
                                            <td className="px-3 py-2 text-[var(--color-text-primary)] leading-relaxed">
                                                <div className="flex items-start gap-1.5">
                                                    <Quote size={13} className="text-[var(--color-primary)] shrink-0 mt-0.5 opacity-60" />
                                                    <span>{sub.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                                    {sub.base_citations_count} citas
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
                                                {sub.keywords_ia ? (
                                                    <span className="font-mono bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded-[2px] border border-[var(--color-border-subtle)]">
                                                        {sub.keywords_ia}
                                                    </span>
                                                ) : (
                                                    <span className="italic text-[var(--color-text-tertiary)]">
                                                        Automático
                                                    </span>
                                                )}
                                            </td>
                                            {(onEditSubfactor || onDeleteSubfactor) && (
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {onEditSubfactor && (
                                                            <PermissionGuard require="guios.factor_edit">
                                                                <EditActionButton
                                                                    title="Editar subfactor"
                                                                    onClick={() => onEditSubfactor(sub, factor)}
                                                                />
                                                            </PermissionGuard>
                                                        )}
                                                        {onDeleteSubfactor && (
                                                            <PermissionGuard require="guios.factor_delete">
                                                                <DeleteActionButton
                                                                    title={
                                                                        sub.is_base
                                                                            ? 'No se pueden eliminar subfactores del catálogo base oficial'
                                                                            : 'Eliminar subfactor'
                                                                    }
                                                                    disabled={sub.is_base}
                                                                    onClick={() => !sub.is_base && onDeleteSubfactor(sub)}
                                                                />
                                                            </PermissionGuard>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export const FactorDetailModal: React.FC<FactorDetailModalProps> = ({
    isOpen,
    onClose,
    factor,
    fetchDetail,
    onAddSubfactor,
    onEditSubfactor,
    onDeleteSubfactor,
}) => {
    if (!isOpen || !factor) return null;

    return (
        <FactorDetailContent
            key={factor.id}
            onClose={onClose}
            factor={factor}
            fetchDetail={fetchDetail}
            onAddSubfactor={onAddSubfactor}
            onEditSubfactor={onEditSubfactor}
            onDeleteSubfactor={onDeleteSubfactor}
        />
    );
};

export default memo(FactorDetailModal);
