import React, { useMemo, memo } from 'react';
import { Sliders, Bookmark, ListFilter } from 'lucide-react';
import Table, { type TableColumn } from '../../../../components/ui/Table';
import PermissionGuard from '../../../../components/ui/PermissionGuard';
import {
    DetailActionButton,
    EditActionButton,
    DeleteActionButton,
} from '../../../../components/ui/ActionIconButtons';
import type { Factor } from '../../../../api/factorService';

interface FactorsTableProps {
    factors: Factor[];
    isLoading: boolean;
    onViewDetail: (factor: Factor) => void;
    onEdit: (factor: Factor) => void;
    onDelete: (factor: Factor) => void;
}

export const FactorsTable: React.FC<FactorsTableProps> = ({
    factors,
    isLoading,
    onViewDetail,
    onEdit,
    onDelete,
}) => {
    const columns: TableColumn<Factor>[] = useMemo(
        () => [
            {
                header: '#',
                align: 'center',
                width: '60px',
                render: (row) => (
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                        #{row.order || 0}
                    </span>
                ),
            },
            {
                header: 'Factor de Evaluación',
                width: '260px',
                render: (row) => (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <Sliders size={14} className="text-[var(--color-primary)] shrink-0" />
                            <span className="font-semibold text-[13px] text-[var(--color-text-primary)]">
                                {row.name}
                            </span>
                        </div>
                        <div>
                            {row.is_base ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <Bookmark size={9} />
                                    Base Oficial
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                    Personalizado
                                </span>
                            )}
                        </div>
                    </div>
                ),
            },
            {
                header: 'Dimensión',
                width: '160px',
                render: (row) => (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-xs font-medium bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)]">
                        <span className="font-mono font-bold text-[10px] text-[var(--color-primary)]">
                            #{row.dimension?.order || 0}
                        </span>
                        <span>{row.dimension?.name || 'Sin dimensión'}</span>
                    </span>
                ),
            },
            {
                header: 'Alcance',
                width: '170px',
                render: (row) => {
                    const isExternal = row.scope === 'external';
                    const isInternal = row.scope === 'internal';

                    return (
                        <div className="flex flex-col gap-1">
                            <div>
                                {isExternal && (
                                    <span className="inline-block px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                        Externo (Software)
                                    </span>
                                )}
                                {isInternal && (
                                    <span className="inline-block px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                        Interno (Org)
                                    </span>
                                )}
                                {!isExternal && !isInternal && (
                                    <span className="inline-block px-1.5 py-0.5 rounded-[2px] text-[10px] font-semibold bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning)]/20">
                                        Ambos
                                    </span>
                                )}
                            </div>
                            {row.scope_configurable && (
                                <span className="text-[9px] font-semibold text-[var(--color-warning-text)]">
                                    * Configurable por decisor
                                </span>
                            )}
                        </div>
                    );
                },
            },
            {
                header: 'Métricas (IS / IE / IL)',
                align: 'center',
                width: '180px',
                render: (row) => (
                    <div className="inline-flex items-center gap-1 font-mono text-xs">
                        <span
                            className="px-1.5 py-0.5 rounded-[2px] font-bold bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/30"
                            title="Importancia Sistémica (IS base)"
                        >
                            IS: {row.systemic_importance}
                        </span>
                        <span
                            className="px-1.5 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
                            title="Importancia del Experto (IE)"
                        >
                            IE: {row.expert_importance}
                        </span>
                        <span
                            className="px-1.5 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
                            title="Importancia Literatura Base (IL)"
                        >
                            IL: {row.literature_importance_base}
                        </span>
                    </div>
                ),
            },
            {
                header: 'Subfactores',
                align: 'center',
                width: '120px',
                render: (row) => {
                    const count = row.subfactors_count || 0;
                    return (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                            <ListFilter size={12} className="text-[var(--color-text-tertiary)]" />
                            <span className="font-mono text-xs font-bold text-[var(--color-text-primary)]">
                                {count}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-secondary)]">
                                {count === 1 ? 'criterio' : 'criterios'}
                            </span>
                        </div>
                    );
                },
            },
            {
                header: 'Acciones',
                align: 'center',
                width: '130px',
                render: (row) => {
                    const isBase = row.is_base;
                    const hasSubfactors = (row.subfactors_count || 0) > 0;
                    const canDelete = !isBase && !hasSubfactors;

                    let deleteTooltip = 'Eliminar factor';
                    if (isBase) {
                        deleteTooltip = 'Los factores base del catálogo oficial no pueden eliminarse';
                    } else if (hasSubfactors) {
                        deleteTooltip = 'No se puede eliminar un factor con subfactores asociados';
                    }

                    return (
                        <div className="flex items-center justify-center gap-1.5">
                            <DetailActionButton
                                title={`Ver subfactores de ${row.name}`}
                                onClick={() => onViewDetail(row)}
                            />

                            <PermissionGuard require="guios.factor_edit">
                                <EditActionButton
                                    title={`Editar ${row.name}`}
                                    onClick={() => onEdit(row)}
                                />
                            </PermissionGuard>

                            <PermissionGuard require="guios.factor_delete">
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
        <Table<Factor>
            columns={columns}
            data={factors}
            isLoading={isLoading}
            rowKey="id"
            emptyMessage="No se encontraron factores registrados con los filtros seleccionados."
        />
    );
};

export default memo(FactorsTable);
