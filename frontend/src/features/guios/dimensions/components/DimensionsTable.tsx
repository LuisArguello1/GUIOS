import React, { useMemo, memo } from 'react';
import { Layers, Bookmark, Sliders } from 'lucide-react';
import Table, { type TableColumn } from '../../../../components/ui/Table';
import PermissionGuard from '../../../../components/ui/PermissionGuard';
import {
    DetailActionButton,
    EditActionButton,
    DeleteActionButton,
} from '../../../../components/ui/ActionIconButtons';
import type { Dimension } from '../../../../api/dimensionService';

interface DimensionsTableProps {
    dimensions: Dimension[];
    isLoading: boolean;
    onViewDetail: (dimension: Dimension) => void;
    onEdit: (dimension: Dimension) => void;
    onDelete: (dimension: Dimension) => void;
}

export const DimensionsTable: React.FC<DimensionsTableProps> = ({
    dimensions,
    isLoading,
    onViewDetail,
    onEdit,
    onDelete,
}) => {
    const columns: TableColumn<Dimension>[] = useMemo(
        () => [
            {
                header: '# Orden',
                align: 'center',
                width: '90px',
                render: (row) => (
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-primary)]">
                        #{row.order}
                    </span>
                ),
            },
            {
                header: 'Dimensión',
                width: '260px',
                render: (row) => (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <Layers size={15} className="text-[var(--color-primary)] shrink-0" />
                            <span className="font-semibold text-[13px] text-[var(--color-text-primary)]">
                                {row.name}
                            </span>
                        </div>
                        <div>
                            {row.is_base ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <Bookmark size={10} />
                                    Base Oficial
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                    Personalizada
                                </span>
                            )}
                        </div>
                    </div>
                ),
            },
            {
                header: 'Descripción',
                render: (row) => (
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                        {row.description || (
                            <span className="italic text-[var(--color-text-tertiary)]">
                                Sin descripción detallada
                            </span>
                        )}
                    </p>
                ),
            },
            {
                header: 'Factores',
                align: 'center',
                width: '130px',
                render: (row) => {
                    const count = row.factors_count;
                    return (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                            <Sliders size={13} className="text-[var(--color-text-secondary)]" />
                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                {count}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-secondary)]">
                                {count === 1 ? 'factor' : 'factores'}
                            </span>
                        </div>
                    );
                },
            },
            {
                header: 'Acciones',
                align: 'center',
                width: '140px',
                render: (row) => {
                    const isBase = row.is_base;
                    const hasFactors = row.factors_count > 0;
                    const canDelete = !isBase && !hasFactors;

                    let deleteTooltip = 'Eliminar dimensión';
                    if (isBase) {
                        deleteTooltip = 'Las dimensiones base de la metodología no pueden eliminarse';
                    } else if (hasFactors) {
                        deleteTooltip = 'No se puede eliminar una dimensión con factores asociados';
                    }

                    return (
                        <div className="flex items-center justify-center gap-1.5">
                            {/* Ver Detalle */}
                            <DetailActionButton
                                title={`Ver factores de ${row.name}`}
                                onClick={() => onViewDetail(row)}
                            />

                            {/* Editar */}
                            <PermissionGuard require="guios.dimension_edit">
                                <EditActionButton
                                    title={`Editar ${row.name}`}
                                    onClick={() => onEdit(row)}
                                />
                            </PermissionGuard>

                            {/* Eliminar */}
                            <PermissionGuard require="guios.dimension_delete">
                                <DeleteActionButton
                                    title={deleteTooltip}
                                    disabled={!canDelete}
                                    onClick={() => canDelete && onDelete(row)}
                                />
                            </PermissionGuard>
                        </div>
                    );
                },
            },
        ],
        [onViewDetail, onEdit, onDelete]
    );

    return (
        <Table<Dimension>
            columns={columns}
            data={dimensions}
            isLoading={isLoading}
            rowKey="id"
            emptyMessage="No se encontraron dimensiones registradas en el catálogo."
        />
    );
};

export default memo(DimensionsTable);
