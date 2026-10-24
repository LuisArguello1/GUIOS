import React, { useMemo, memo } from 'react';
import { Quote, Bookmark, Sliders, Layers, CheckCircle2, XCircle } from 'lucide-react';
import Table, { type TableColumn } from '../../../../components/ui/Table';
import PermissionGuard from '../../../../components/ui/PermissionGuard';
import {
    DetailActionButton,
    EditActionButton,
    DeleteActionButton,
} from '../../../../components/ui/ActionIconButtons';
import type { Subfactor } from '../../../../api/subfactorService';

interface SubfactorsTableProps {
    subfactors: Subfactor[];
    isLoading: boolean;
    onViewDetail: (subfactor: Subfactor) => void;
    onEdit: (subfactor: Subfactor) => void;
    onDelete: (subfactor: Subfactor) => void;
}

export const SubfactorsTable: React.FC<SubfactorsTableProps> = ({
    subfactors,
    isLoading,
    onViewDetail,
    onEdit,
    onDelete,
}) => {
    const columns: TableColumn<Subfactor>[] = useMemo(
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
                header: 'Afirmación / Criterio Verificable',
                width: '380px',
                render: (row) => (
                    <div className="flex flex-col gap-1 py-0.5">
                        <div className="flex items-start gap-1.5">
                            <Quote size={13} className="text-[var(--color-primary)] shrink-0 mt-0.5 opacity-70" />
                            <span className="text-[13px] text-[var(--color-text-primary)] leading-snug font-medium">
                                {row.description}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 pl-4">
                            {row.is_base ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    <Bookmark size={9} /> Base Oficial
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                    Personalizado
                                </span>
                            )}
                            {!row.is_active && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-[2px] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)]">
                                    Inactivo
                                </span>
                            )}
                        </div>
                    </div>
                ),
            },
            {
                header: 'Factor & Dimensión',
                width: '240px',
                render: (row) => (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                            <Sliders size={13} className="text-[var(--color-primary)] shrink-0" />
                            <span>{row.factor?.name || 'Factor no asignado'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
                            <Layers size={11} className="text-[var(--color-text-tertiary)] shrink-0" />
                            <span>{row.factor?.dimension_name || 'Sin dimensión'}</span>
                        </div>
                    </div>
                ),
            },
            {
                header: 'Citas Base (ci)',
                align: 'center',
                width: '120px',
                render: (row) => (
                    <div className="inline-flex items-center justify-center">
                        <span
                            className="font-mono text-xs font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/30"
                            title="Cantidad de citas base en la literatura científica"
                        >
                            {row.base_citations_count} {row.base_citations_count === 1 ? 'cita' : 'citas'}
                        </span>
                    </div>
                ),
            },
            {
                header: 'Palabras Clave IA',
                width: '200px',
                render: (row) => {
                    if (!row.keywords_ia) {
                        return (
                            <span className="text-[11px] italic text-[var(--color-text-tertiary)]">
                                Extracción automática
                            </span>
                        );
                    }
                    const keywords = row.keywords_ia.split(',').map((k) => k.trim()).filter(Boolean);
                    return (
                        <div className="flex flex-wrap gap-1">
                            {keywords.map((kw, i) => (
                                <span
                                    key={i}
                                    className="font-mono text-[10px] px-1.5 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    );
                },
            },
            {
                header: 'Estado',
                align: 'center',
                width: '100px',
                render: (row) => (
                    <div className="flex items-center justify-center">
                        {row.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-success-text)]">
                                <CheckCircle2 size={13} className="text-[var(--color-success)]" />
                                Activo
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-danger-text)]">
                                <XCircle size={13} className="text-[var(--color-danger)]" />
                                Inactivo
                            </span>
                        )}
                    </div>
                ),
            },
            {
                header: 'Acciones',
                align: 'center',
                width: '130px',
                render: (row) => {
                    const isBase = row.is_base;
                    let deleteTooltip = 'Eliminar subfactor';
                    if (isBase) {
                        deleteTooltip = 'Los subfactores base del catálogo oficial de la tesis no pueden eliminarse';
                    }

                    return (
                        <div className="flex items-center justify-center gap-1.5">
                            <DetailActionButton
                                title="Ver detalle del subfactor"
                                onClick={() => onViewDetail(row)}
                            />

                            <PermissionGuard require="guios.factor_edit">
                                <EditActionButton
                                    title="Editar subfactor"
                                    onClick={() => onEdit(row)}
                                />
                            </PermissionGuard>

                            <PermissionGuard require="guios.factor_delete">
                                <DeleteActionButton
                                    title={deleteTooltip}
                                    disabled={isBase}
                                    onClick={() => !isBase && onDelete(row)}
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
        <Table<Subfactor>
            columns={columns}
            data={subfactors}
            isLoading={isLoading}
            rowKey="id"
            emptyMessage="No se encontraron subfactores registrados con los filtros seleccionados."
        />
    );
};

export default memo(SubfactorsTable);
