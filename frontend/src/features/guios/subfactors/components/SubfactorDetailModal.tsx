import React, { memo } from 'react';
import { Quote, Layers, Sliders, Bookmark, CheckCircle2, XCircle, Sparkles, Hash, Calendar, Edit3 } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import PermissionGuard from '../../../../components/ui/PermissionGuard';
import type { Subfactor } from '../../../../api/subfactorService';

interface SubfactorDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    subfactor: Subfactor | null;
    onEdit?: (subfactor: Subfactor) => void;
}

export const SubfactorDetailModal: React.FC<SubfactorDetailModalProps> = ({
    isOpen,
    onClose,
    subfactor,
    onEdit,
}) => {
    if (!subfactor) return null;

    const keywords = subfactor.keywords_ia
        ? subfactor.keywords_ia.split(',').map((k) => k.trim()).filter(Boolean)
        : [];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Quote size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                Detalle de Subfactor #{subfactor.order || 0}
                            </h3>
                            {subfactor.is_base ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <Bookmark size={9} /> Base Oficial
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                    Personalizado
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {subfactor.factor?.name} ({subfactor.factor?.dimension_name})
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    {onEdit ? (
                        <PermissionGuard require="guios.factor_edit">
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    onClose();
                                    onEdit(subfactor);
                                }}
                                className="flex items-center gap-1.5 text-xs"
                            >
                                <Edit3 size={13} />
                                Editar Subfactor
                            </Button>
                        </PermissionGuard>
                    ) : (
                        <div />
                    )}
                    <Button variant="secondary" onClick={onClose}>
                        Cerrar
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                {/* Afirmación verificable */}
                <div className="p-3.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1.5">
                        Afirmación Verificable (Criterio de Evaluación)
                    </span>
                    <div className="flex items-start gap-2">
                        <Quote size={18} className="text-[var(--color-primary)] shrink-0 mt-0.5 opacity-80" />
                        <p className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)] leading-relaxed">
                            {subfactor.description}
                        </p>
                    </div>
                </div>

                {/* Grid de jerarquía padre */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block mb-1 flex items-center gap-1">
                            <Sliders size={12} className="text-[var(--color-primary)]" />
                            Factor Asociado
                        </span>
                        <span className="font-semibold text-[var(--color-text-primary)] block">
                            {subfactor.factor?.name}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                            Alcance: {subfactor.factor?.scope_display || subfactor.factor?.scope}
                        </span>
                    </div>

                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block mb-1 flex items-center gap-1">
                            <Layers size={12} className="text-[var(--color-primary)]" />
                            Dimensión
                        </span>
                        <span className="font-semibold text-[var(--color-text-primary)] block">
                            {subfactor.factor?.dimension_name}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                            Nivel 1 de la Metodología GUIOS
                        </span>
                    </div>
                </div>

                {/* Métricas y Parámetros */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] text-center">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block flex items-center justify-center gap-1">
                            <Hash size={11} className="text-[var(--color-primary)]" />
                            Citas Base en Literatura (ci)
                        </span>
                        <span className="text-base font-bold font-mono text-[var(--color-primary)] mt-1 block">
                            {subfactor.base_citations_count}
                        </span>
                        <span className="text-[9px] text-[var(--color-text-tertiary)] block">
                            Referencia de la tesis (2022)
                        </span>
                    </div>

                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] text-center">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">
                            Estado Operativo
                        </span>
                        <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold">
                            {subfactor.is_active ? (
                                <span className="inline-flex items-center gap-1 text-[var(--color-success-text)]">
                                    <CheckCircle2 size={14} className="text-[var(--color-success)]" />
                                    Activo
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[var(--color-danger-text)]">
                                    <XCircle size={14} className="text-[var(--color-danger)]" />
                                    Inactivo
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] text-[var(--color-text-tertiary)] block mt-0.5">
                            Visible en evaluaciones
                        </span>
                    </div>
                </div>

                {/* Palabras clave para IA */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1.5 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-[var(--color-primary)]" />
                        Términos Clave para Búsqueda Semántica con IA
                    </span>
                    {keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {keywords.map((kw, i) => (
                                <span
                                    key={i}
                                    className="font-mono text-xs px-2 py-0.5 rounded-[2px] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]"
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs italic text-[var(--color-text-tertiary)]">
                            No se configuraron términos específicos; el motor de IA utilizará el texto completo de la afirmación.
                        </p>
                    )}
                </div>

                {/* Marcas de tiempo */}
                <div className="flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)] pt-2 border-t border-[var(--color-border-subtle)]">
                    <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        Creado: {new Date(subfactor.created_at).toLocaleDateString()}
                    </span>
                    <span>
                        Actualizado: {new Date(subfactor.updated_at).toLocaleDateString()}
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export default memo(SubfactorDetailModal);
