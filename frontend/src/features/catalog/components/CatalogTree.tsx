import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { EditActionButton, ToggleActionButton } from '../../../components/ui/ActionIconButtons';
import PermissionGuard from '../../../components/ui/PermissionGuard';
import type { AdminDimension, AdminFactor, AdminSubfactor } from '../../../api/guiosAdminService';
import { SCOPE_TEXT, dimensionBlockReason, factorBlockReason, subfactorBlockReason } from '../labels';
import { Badge, ImportanceBadge } from './CatalogBadges';
import DeleteControl from './DeleteControl';

export interface CatalogTreeActions {
    onAddFactor: (dimension: AdminDimension) => void;
    onAddSubfactor: (factor: AdminFactor, dimension: AdminDimension) => void;
    onEditDimension: (dimension: AdminDimension) => void;
    onEditFactor: (factor: AdminFactor, dimension: AdminDimension) => void;
    onEditSubfactor: (subfactor: AdminSubfactor, factor: AdminFactor) => void;
    onToggleFactor: (factor: AdminFactor) => void;
    onToggleSubfactor: (subfactor: AdminSubfactor) => void;
    onDeleteDimension: (dimension: AdminDimension) => void;
    onDeleteFactor: (factor: AdminFactor) => void;
    onDeleteSubfactor: (subfactor: AdminSubfactor) => void;
}

const AddButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick}
        className="inline-flex items-center gap-1 rounded-[4px] px-2 py-1 text-[11px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]">
        <Plus size={13} aria-hidden /> {label}
    </button>
);

const Expander = ({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-expanded={open} aria-label={`${open ? 'Contraer' : 'Expandir'} ${label}`}
        className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]">
        {open ? <ChevronDown size={16} aria-hidden /> : <ChevronRight size={16} aria-hidden />}
    </button>
);

/** Árbol Dimensión → Factor → Subfactor con acciones según los permisos del rol. */
const CatalogTree = ({ tree, actions }: { tree: AdminDimension[]; actions: CatalogTreeActions }) => {
    const [closedDimensions, setClosedDimensions] = useState<Set<number>>(new Set());
    const [openFactors, setOpenFactors] = useState<Set<number>>(new Set());

    const toggle = (set: Set<number>, id: number, apply: (s: Set<number>) => void) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id); else next.add(id);
        apply(next);
    };

    return (
        <ul className="space-y-3" aria-label="Catálogo GUIOS">
            {tree.map((dimension) => {
                const dimOpen = !closedDimensions.has(dimension.id);
                return (
                    <li key={dimension.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]">
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <Expander open={dimOpen} label={dimension.name} onClick={() => toggle(closedDimensions, dimension.id, setClosedDimensions)} />
                                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{dimension.name}</h2>
                                {dimension.is_base && <Badge tone="info">Base</Badge>}
                                <Badge>{dimension.factors_count} factores</Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <PermissionGuard require="catalog.create">
                                    <AddButton label="Factor" onClick={() => actions.onAddFactor(dimension)} />
                                </PermissionGuard>
                                <PermissionGuard require="catalog.edit">
                                    <EditActionButton title={`Editar ${dimension.name}`} onClick={() => actions.onEditDimension(dimension)} />
                                </PermissionGuard>
                                <PermissionGuard require="catalog.delete">
                                    <DeleteControl itemLabel={dimension.name} blockedReason={dimensionBlockReason(dimension)}
                                        onDelete={() => actions.onDeleteDimension(dimension)} />
                                </PermissionGuard>
                            </div>
                        </div>

                        {dimOpen && (
                            <ul className="border-t border-[var(--color-border-subtle)]">
                                {(dimension.factors ?? []).length === 0 && (
                                    <li className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">Sin factores.</li>
                                )}
                                {(dimension.factors ?? []).map((factor) => {
                                    const facOpen = openFactors.has(factor.id);
                                    return (
                                        <li key={factor.id} className={clsx('border-b border-[var(--color-border-subtle)] last:border-b-0', !factor.is_active && 'opacity-70')}>
                                            <div className="flex flex-wrap items-center justify-between gap-2 py-2 pl-8 pr-3">
                                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                    <Expander open={facOpen} label={factor.name} onClick={() => toggle(openFactors, factor.id, setOpenFactors)} />
                                                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{factor.name}</h3>
                                                    <ImportanceBadge value={factor.suggested_importance} />
                                                    <Badge>Ámbito: {SCOPE_TEXT[factor.scope]}</Badge>
                                                    <Badge>{factor.active_subfactors_count}/{factor.subfactors_count} subfactores activos</Badge>
                                                    <Badge>{factor.evaluations_count} evaluaciones</Badge>
                                                    {factor.is_base && <Badge tone="info">Base</Badge>}
                                                    {!factor.is_active && <Badge tone="warning">Inactivo</Badge>}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <PermissionGuard require="catalog.create">
                                                        <AddButton label="Subfactor" onClick={() => actions.onAddSubfactor(factor, dimension)} />
                                                    </PermissionGuard>
                                                    <PermissionGuard require="catalog.edit">
                                                        <ToggleActionButton active={factor.is_active}
                                                            title={factor.is_active ? `Desactivar ${factor.name}` : `Activar ${factor.name}`}
                                                            onClick={() => actions.onToggleFactor(factor)} />
                                                        <EditActionButton title={`Editar ${factor.name}`} onClick={() => actions.onEditFactor(factor, dimension)} />
                                                    </PermissionGuard>
                                                    <PermissionGuard require="catalog.delete">
                                                        <DeleteControl itemLabel={factor.name} blockedReason={factorBlockReason(factor)}
                                                            onDelete={() => actions.onDeleteFactor(factor)} />
                                                    </PermissionGuard>
                                                </div>
                                            </div>
                                            {facOpen && (
                                                <ol className="pb-2 pl-16 pr-3">
                                                    {(factor.subfactors ?? []).length === 0 && (
                                                        <li className="py-2 text-xs text-[var(--color-text-tertiary)]">Sin subfactores.</li>
                                                    )}
                                                    {(factor.subfactors ?? []).map((sub) => (
                                                        <li key={sub.id} className={clsx('flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] py-2 first:border-t-0', !sub.is_active && 'opacity-70')}>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs text-[var(--color-text-primary)]">{sub.description}</p>
                                                                <div className="mt-1 flex flex-wrap gap-1">
                                                                    <Badge>{sub.evaluations_count} evaluaciones</Badge>
                                                                    {sub.is_base && <Badge tone="info">Base</Badge>}
                                                                    {!sub.is_active && <Badge tone="warning">Inactivo</Badge>}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <PermissionGuard require="catalog.edit">
                                                                    <ToggleActionButton active={sub.is_active}
                                                                        title={sub.is_active ? 'Desactivar subfactor' : 'Activar subfactor'}
                                                                        onClick={() => actions.onToggleSubfactor(sub)} />
                                                                    <EditActionButton title="Editar subfactor" onClick={() => actions.onEditSubfactor(sub, factor)} />
                                                                </PermissionGuard>
                                                                <PermissionGuard require="catalog.delete">
                                                                    <DeleteControl itemLabel="subfactor" blockedReason={subfactorBlockReason(sub)}
                                                                        onDelete={() => actions.onDeleteSubfactor(sub)} />
                                                                </PermissionGuard>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ol>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};

export default memo(CatalogTree);
