import React, { useEffect, useState, memo } from 'react';
import { Layers, Bookmark, Sliders } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Loading from '../../../../components/ui/Loading';
import type { Dimension, DimensionDetail } from '../../../../api/dimensionService';

interface DimensionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    dimension: Dimension | null;
    fetchDetail: (id: number | string) => Promise<DimensionDetail | null>;
}

interface DimensionDetailContentProps {
    onClose: () => void;
    dimension: Dimension;
    fetchDetail: (id: number | string) => Promise<DimensionDetail | null>;
}

const DimensionDetailContent: React.FC<DimensionDetailContentProps> = ({
    onClose,
    dimension,
    fetchDetail,
}) => {
    const [detail, setDetail] = useState<DimensionDetail | null>(null);

    useEffect(() => {
        let isMounted = true;
        fetchDetail(dimension.id).then((res) => {
            if (isMounted) {
                setDetail(res);
            }
        });
        return () => {
            isMounted = false;
        };
    }, [dimension.id, fetchDetail]);

    const isLoading = !detail;
    const factors = detail?.factors ?? [];
    const internalCount = factors.filter((f) => f.scope === 'internal').length;
    const externalCount = factors.filter((f) => f.scope === 'external').length;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Layers size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                {dimension.name}
                            </h3>
                            <span className="font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-primary)]">
                                #{dimension.order}
                            </span>
                            {dimension.is_base ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <Bookmark size={10} /> Base Tesis
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                    Personalizada
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            Estructura de factores asociados en el catálogo GUIOS
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
                {/* Descripción */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] block mb-1">
                        Definición y Alcance
                    </span>
                    <p className="text-xs text-[var(--color-text-primary)] leading-relaxed">
                        {dimension.description || 'Sin descripción registrada para esta dimensión.'}
                    </p>
                </div>

                {/* Resumen métrico de factores */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Total Factores</span>
                        <span className="text-base font-bold font-mono text-[var(--color-text-primary)]">
                            {factors.length}
                        </span>
                    </div>
                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Alcance Externo (Software)</span>
                        <span className="text-base font-bold font-mono text-[var(--color-primary)]">
                            {externalCount}
                        </span>
                    </div>
                    <div className="p-2.5 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                        <span className="text-[10px] text-[var(--color-text-secondary)] block">Alcance Interno (Org)</span>
                        <span className="text-base font-bold font-mono text-[var(--color-info-text)]">
                            {internalCount}
                        </span>
                    </div>
                </div>

                {/* Listado de Factores */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <Sliders size={14} className="text-[var(--color-primary)]" />
                            Factores Activos ({factors.length})
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="py-8 flex justify-center">
                            <Loading label="Cargando factores asociados..." />
                        </div>
                    ) : factors.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[var(--color-text-tertiary)] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                            Esta dimensión no tiene factores asociados actualmente.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[4px] bg-[var(--color-bg-page)]">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                        <th className="px-3 py-2 text-center w-12">#</th>
                                        <th className="px-3 py-2">Factor</th>
                                        <th className="px-3 py-2 text-center">Alcance</th>
                                        <th className="px-3 py-2 text-center font-mono">IS Base</th>
                                        <th className="px-3 py-2 text-center font-mono">IE</th>
                                        <th className="px-3 py-2 text-center font-mono">IL Base</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                    {factors.map((f, idx) => (
                                        <tr key={f.id} className="hover:bg-[var(--color-bg-elevated)] transition-colors">
                                            <td className="px-3 py-2 text-center font-mono text-[11px] text-[var(--color-text-tertiary)]">
                                                {f.order || idx + 1}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{f.name}</span>
                                                    {f.scope_configurable && (
                                                        <span className="text-[9px] px-1 rounded-[2px] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning)]/20 font-semibold" title="Ámbito configurable por evaluación">
                                                            Configurable
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {f.scope === 'internal' ? (
                                                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-[2px] font-medium bg-[var(--color-info-bg)] text-[var(--color-info-text)]">
                                                        Interno
                                                    </span>
                                                ) : (
                                                    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-[2px] font-medium bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                                                        Externo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono font-bold text-[var(--color-primary)]">
                                                {f.systemic_importance}
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono font-medium text-[var(--color-text-secondary)]">
                                                {f.expert_importance}
                                            </td>
                                            <td className="px-3 py-2 text-center font-mono font-medium text-[var(--color-text-secondary)]">
                                                {f.literature_importance_base}
                                            </td>
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

export const DimensionDetailModal: React.FC<DimensionDetailModalProps> = ({
    isOpen,
    onClose,
    dimension,
    fetchDetail,
}) => {
    if (!isOpen || !dimension) return null;

    return (
        <DimensionDetailContent
            key={dimension.id}
            onClose={onClose}
            dimension={dimension}
            fetchDetail={fetchDetail}
        />
    );
};

export default memo(DimensionDetailModal);
