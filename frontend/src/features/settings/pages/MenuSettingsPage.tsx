import { useState, useEffect, useCallback, useRef, memo, type ElementType, useMemo } from 'react';
import {
    RotateCcw, ChevronRight, Layers, GripVertical
} from 'lucide-react';
import { clsx } from 'clsx';
import * as Icons from 'lucide-react';

import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import menuModuleService from '../../../api/menuModuleService';
import useToastStore from '../../../app/useToastStore';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import Loading from '../../../components/ui/Loading';
import AccessDenied from '../../../components/ui/AccessDenied';
import { usePermissions } from '../../../hooks/usePermissions';
import { EditActionButton } from '../../../components/ui/ActionIconButtons';

// ── TYPES ──────────────────────────────────────────────────────────────────

interface MenuModule {
    id: number;
    label: string;
    icon: string;
    order: number;
    group: number;
}

interface MenuGroup {
    id: number;
    name: string;
    order: number;
    modules: MenuModule[];
}

type ActiveDragItem =
    | { type: 'module'; module: MenuModule }
    | { type: 'group'; group: MenuGroup }
    | null;

const parseDndNumericId = (id: string | number): number => {
    const raw = typeof id === 'string' ? id : `${id}`;
    const sep = raw.indexOf('-');
    return Number.parseInt(sep >= 0 ? raw.slice(sep + 1) : raw, 10);
};

// ── SORTABLE MODULE ROW ────────────────────────────────────────────────────

const SortableModule = memo(({
    module,
    isLast,
    onEdit,
    canModify,
    isOverlay = false,
}: {
    module: MenuModule;
    isLast: boolean;
    onEdit: (m: MenuModule) => void;
    canModify: boolean;
    isOverlay?: boolean;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `module-${module.id}`,
        data: { type: 'module', module },
        disabled: !canModify || isOverlay,
    });

    const style = useMemo(() => (isOverlay
        ? {}
        : {
              transform: CSS.Transform.toString(transform),
              transition,
              zIndex: isDragging ? 200 : 0,
              opacity: isDragging ? 0.2 : 1,
          }), [isOverlay, transform, transition, isDragging]);

    const iconMap = Icons as unknown as Record<string, ElementType>;
    const Icon = iconMap[module.icon] || Icons.LayoutGrid;

    return (
        <div
            ref={isOverlay ? undefined : setNodeRef}
            style={style}
            className="relative bg-[var(--color-bg-primary)]"
        >
            <div className="flex items-center gap-2.5 pl-3 pr-4 py-[9px]">
                {/* Handle */}
                <div
                    {...(isOverlay ? {} : attributes)}
                    {...(isOverlay ? {} : listeners)}
                    className={clsx(
                        'flex items-center justify-center w-5 shrink-0 text-[var(--color-text-disabled)] transition-colors',
                        canModify && !isOverlay
                            ? 'cursor-grab active:cursor-grabbing hover:text-[var(--color-text-tertiary)]'
                            : 'cursor-default opacity-0 pointer-events-none',
                    )}
                >
                    <GripVertical size={14} />
                </div>

                {/* Icono */}
                <div className="w-7 h-7 rounded-[7px] bg-[var(--color-bg-tertiary)] flex items-center justify-center shrink-0">
                    <Icon size={14} strokeWidth={2} className="text-[var(--color-text-secondary)]" />
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-none">
                        {module.label}
                    </p>
                </div>

                {/* Orden */}
                <span className="text-[11px] font-medium tabular-nums text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded-full shrink-0">
                    {module.order}
                </span>

                {/* Editar */}
                {canModify && !isOverlay && (
                    <EditActionButton
                        onClick={(e) => { e.stopPropagation(); onEdit(module); }}
                    />
                )}

                <ChevronRight size={13} className="text-[var(--color-text-secondary)] opacity-35 shrink-0" />
            </div>

            {!isLast && (
                <span className="absolute bottom-0 left-[72px] right-0 h-px bg-[var(--color-border-subtle)]" />
            )}
        </div>
    );
});


// ── SORTABLE CATEGORY ──────────────────────────────────────────────────────

const SortableCategory = memo(({
    category,
    onEdit,
    onEditModule,
    canModify,
    isOverlay = false,
}: {
    category: MenuGroup;
    onEdit: (c: MenuGroup) => void;
    onEditModule: (m: MenuModule) => void;
    canModify: boolean;
    isOverlay?: boolean;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `group-${category.id}`,
        data: { type: 'group', group: category },
        disabled: !canModify || isOverlay,
    });

    const style = useMemo(() => (isOverlay
        ? {}
        : {
              transform: CSS.Transform.toString(transform),
              transition,
              opacity: isDragging ? 0.3 : 1,
          }), [isOverlay, transform, transition, isDragging]);

    const moduleIds = useMemo(() => category.modules.map((m) => `module-${m.id}`), [category.modules]);

    return (
        <section ref={isOverlay ? undefined : setNodeRef} style={style} className="space-y-1">
            {/* Cabecera de grupo */}
            <div className="flex items-center justify-between px-1 mb-1">
                <div className="flex items-center gap-1.5">
                    <div
                        {...(isOverlay ? {} : attributes)}
                        {...(isOverlay ? {} : listeners)}
                        className={clsx(
                            'text-[var(--color-text-disabled)] transition-colors',
                            canModify && !isOverlay
                                ? 'cursor-grab active:cursor-grabbing hover:text-[var(--color-text-tertiary)]'
                                : 'cursor-default opacity-0 pointer-events-none',
                        )}
                    >
                        <GripVertical size={13} />
                    </div>
                    <p className="text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-[0.06em]">
                        {category.name}
                    </p>
                    <span className="text-[11px] text-[var(--color-text-tertiary)] tabular-nums ml-0.5">
                        ({category.modules.length})
                    </span>
                </div>
                {canModify && !isOverlay && (
                    <EditActionButton onClick={() => onEdit(category)} />
                )}
            </div>

            {/* Lista de módulos */}
            <div className="rounded-[12px] border border-[var(--color-border-subtle)] overflow-hidden bg-[var(--color-bg-primary)] min-h-[40px]">
                <SortableContext
                    items={moduleIds}
                    strategy={verticalListSortingStrategy}
                >
                    {category.modules.length === 0 ? (
                        <div className="px-4 py-6 text-center text-[12px] text-[var(--color-text-tertiary)]">
                            Arrastra módulos aquí
                        </div>
                    ) : (
                        category.modules.map((module, idx) => (
                            <SortableModule
                                key={module.id}
                                module={module}
                                isLast={idx === category.modules.length - 1}
                                onEdit={onEditModule}
                                canModify={canModify}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </section>
    );
});


// ── MODAL DE EDICIÓN ───────────────────────────────────────────────────────

interface EditModalProps {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, order: number) => void;
    initialName: string;
    initialOrder: number;
    isSaving: boolean;
}

const EditModal = ({
    title,
    isOpen,
    onClose,
    onSave,
    initialName,
    initialOrder,
    isSaving,
}: EditModalProps) => {
    const [name, setName]   = useState(initialName);
    const [order, setOrder] = useState(Math.max(1, initialOrder));

    // Nota: Se eliminó el useEffect que sincronizaba estados para evitar renders en cascada.
    // La sincronización ahora se maneja mediante el cambio de 'key' en el componente padre.

    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={() => onSave(name, order)}
            title={title}
            confirmText="Guardar"
            variant="primary"
            isLoading={isSaving}
        >
            <div className="space-y-3 pt-1">
                <div className="rounded-[12px] border border-[var(--color-border-subtle)] overflow-hidden bg-[var(--color-bg-primary)]">
                    <div className="flex items-center gap-3 px-4 py-[10px]">
                        <span className="text-[13px] text-[var(--color-text-secondary)] w-[72px] shrink-0">
                            Etiqueta
                        </span>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSave(name, order)}
                            placeholder="Nombre descriptivo…"
                            className={clsx(
                                'flex-1 bg-transparent text-[13px] font-medium text-right',
                                'text-[var(--color-text-primary)] outline-none',
                                'placeholder-[var(--color-text-tertiary)]',
                            )}
                        />
                    </div>
                    <span className="block h-px bg-[var(--color-border-subtle)] mx-4" />
                    <div className="flex items-center gap-3 px-4 py-[10px]">
                        <span className="text-[13px] text-[var(--color-text-secondary)] w-[72px] shrink-0">
                            Orden
                        </span>
                        <input
                            type="number"
                            min="1"
                            value={order}
                            onChange={(e) => {
                                const next = Number.parseInt(e.target.value, 10);
                                setOrder(Number.isNaN(next) ? 1 : Math.max(1, next));
                            }}
                            className={clsx(
                                'flex-1 bg-transparent text-[13px] font-medium text-right',
                                'text-[var(--color-text-primary)] outline-none',
                                '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none',
                            )}
                        />
                    </div>
                </div>
                <p className="text-[11px] text-[var(--color-text-tertiary)] px-1">
                    El orden determina la posición en el menú de navegación.
                </p>
            </div>
        </ConfirmModal>
    );
};

// ── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function MenuSettingsPage() {
    const { addToast }           = useToastStore();
    const { has } = usePermissions();
    const canRead = has('settings.manage') || has('settings.menu_view') || has('settings.menu_manage');
    const canModify = has('settings.manage') || has('settings.menu_manage');

    const [tree, setTree]                               = useState<MenuGroup[]>([]);
    const [isLoading, setIsLoading]                     = useState(true);
    const [activeDragItem, setActiveDragItem]           = useState<ActiveDragItem>(null);
    const [editingCategory, setEditingCategory]         = useState<MenuGroup | null>(null);
    const [editingModule, setEditingModule]             = useState<MenuModule | null>(null);

    // Ref que refleja siempre el tree actual sin causar re-renders en handlers
    const treeRef = useRef<MenuGroup[]>([]);
    useEffect(() => { treeRef.current = tree; }, [tree]);

    const groupIds = useMemo(() => tree.map((c) => `group-${c.id}`), [tree]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const fetchData = useCallback(async () => {
        if (!canRead) return;
        setIsLoading(true);
        try {
            const data = await menuModuleService.getTree();
            setTree(data);
        } catch {
            addToast({ type: 'error', message: 'No se pudo cargar el menú.' });
        } finally {
            setIsLoading(false);
        }
    }, [addToast, canRead]);

    useEffect(() => {
        const t = setTimeout(() => fetchData(), 0);
        return () => clearTimeout(t);
    }, [fetchData]);

    // ── Drag & Drop ──────────────────────────────────────────────────────────
    const handleDragStart = useCallback((event: DragStartEvent) => {
        const data = event.active.data.current;
        if (!data) return;
        setActiveDragItem(
            data.type === 'module'
                ? { type: 'module', module: data.module as MenuModule }
                : { type: 'group',  group:  data.group  as MenuGroup  },
        );
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        const type        = active.data.current?.type;
        const currentTree = treeRef.current;

        if (type === 'group') {
            const oldIndex = currentTree.findIndex((c) => `group-${c.id}` === String(active.id));
            const newIndex = currentTree.findIndex((c) => `group-${c.id}` === String(over.id));
            if (oldIndex === newIndex || oldIndex === -1 || newIndex === -1) return;

            const newTree = arrayMove(currentTree, oldIndex, newIndex);
            setTree(newTree);
            try {
                await menuModuleService.reorderCategories(newTree.map((c) => c.id));
                addToast({ type: 'success', message: 'Orden de categorías guardado.' });
            } catch {
                addToast({ type: 'error', message: 'Error al persistir el orden.' });
                fetchData();
            }
            return;
        }

        if (type === 'module') {
            const activeModuleId = parseDndNumericId(active.id);
            
            // Find the source group
            const sourceGroup = currentTree.find((c) =>
                c.modules.some((m) => m.id === activeModuleId)
            );
            if (!sourceGroup) return;

            // Find the target group
            let targetGroup: MenuGroup | undefined = undefined;
            const overType = over.data.current?.type;

            if (overType === 'module') {
                const overModuleId = parseDndNumericId(over.id);
                targetGroup = currentTree.find((c) =>
                    c.modules.some((m) => m.id === overModuleId)
                );
            } else if (overType === 'group') {
                const overGroupId = parseDndNumericId(over.id);
                targetGroup = currentTree.find((c) => c.id === overGroupId);
            }

            if (!targetGroup) return;

            const isSameGroup = sourceGroup.id === targetGroup.id;

            if (isSameGroup) {
                // Same-group sorting
                let finalModules = [...sourceGroup.modules];
                if (String(active.id) !== String(over.id) && overType === 'module') {
                    const overModuleId = parseDndNumericId(over.id);
                    const oldIdx = finalModules.findIndex((m) => m.id === activeModuleId);
                    const newIdx = finalModules.findIndex((m) => m.id === overModuleId);
                    if (oldIdx !== -1 && newIdx !== -1) {
                        finalModules = arrayMove(finalModules, oldIdx, newIdx);
                        setTree((prev) =>
                            prev.map((c) =>
                                c.id === sourceGroup.id ? { ...c, modules: finalModules } : c
                            )
                        );
                        try {
                            await menuModuleService.reorderModules(
                                sourceGroup.id,
                                finalModules.map((m) => m.id),
                            );
                            addToast({ type: 'success', message: 'Módulos reordenados.' });
                        } catch {
                            addToast({ type: 'error', message: 'Error al sincronizar con el servidor.' });
                            fetchData();
                        }
                    }
                }
            } else {
                // Different-group moving
                const activeModule = sourceGroup.modules.find((m) => m.id === activeModuleId);
                if (!activeModule) return;

                const movedModule = { ...activeModule, group: targetGroup.id };

                let insertIdx = targetGroup.modules.length;
                if (overType === 'module') {
                    const overModuleId = parseDndNumericId(over.id);
                    const overIdx = targetGroup.modules.findIndex((m) => m.id === overModuleId);
                    if (overIdx !== -1) {
                        insertIdx = overIdx;
                    }
                }

                const srcModules = sourceGroup.modules.filter((m) => m.id !== activeModuleId);
                const dstModules = [...targetGroup.modules];
                dstModules.splice(insertIdx, 0, movedModule);

                // Re-index local orders to match backend auto-index behavior
                const updatedSrcModules = srcModules.map((m, idx) => ({ ...m, order: idx + 1 }));
                const updatedDstModules = dstModules.map((m, idx) => ({ ...m, order: idx + 1 }));

                setTree((prev) =>
                    prev.map((c) => {
                        if (c.id === sourceGroup.id) return { ...c, modules: updatedSrcModules };
                        if (c.id === targetGroup.id) return { ...c, modules: updatedDstModules };
                        return c;
                    })
                );

                try {
                    await menuModuleService.reorderModules(
                        targetGroup.id,
                        updatedDstModules.map((m) => m.id),
                    );
                    addToast({ type: 'success', message: 'Módulo movido de categoría.' });
                } catch {
                    addToast({ type: 'error', message: 'Error al sincronizar con el servidor.' });
                    fetchData();
                }
            }
        }
    }, [addToast, fetchData]);

    if (!canRead) {
        return (
            <AccessDenied
                title="Sin acceso"
                message="No tienes permisos para gestionar la estructura del menú."
                redirectPath="/dashboard"
            />
        );
    }

    if (isLoading) return <Loading label="Cargando estructura…" className="min-h-[320px]" />;
    if (!canRead) return null; // Fallback de seguridad

    // ── Handlers de edición ──────────────────────────────────────────────────

    const handleUpdateCategory = async (id: number, data: { name: string; order: number }) => {
        try {
            await menuModuleService.updateCategory(id, data);
            addToast({ type: 'success', message: 'Categoría actualizada.' });
            setEditingCategory(null);
            fetchData();
        } catch {
            addToast({ type: 'error', message: 'Error al actualizar.' });
        }
    };

    const handleUpdateModule = async (
        id: number,
        data: { label: string; order: number; group?: number },
    ) => {
        try {
            await menuModuleService.updateModule(id, data);
            addToast({ type: 'success', message: 'Módulo actualizado.' });
            setEditingModule(null);
            fetchData();
        } catch {
            addToast({ type: 'error', message: 'Error al actualizar.' });
        }
    };


    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <Layers size={16} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] leading-none mb-0.5">
                            Estructura del Menú
                        </h2>
                        <p className="text-[12px] text-[var(--color-text-secondary)]">
                            Arrastra para reordenar categorías y módulos
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchData}
                    className={clsx(
                        'flex items-center gap-1.5 px-3 py-[7px] rounded-[20px]',
                        'bg-[var(--color-bg-secondary)] text-[12px] font-medium',
                        'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                        'transition-colors active:opacity-70',
                    )}
                >
                    <RotateCcw size={12} />
                    Sincronizar
                </button>
            </div>

            {/* Árbol */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-5">
                    <SortableContext
                        items={groupIds}
                        strategy={verticalListSortingStrategy}
                    >


                        {tree.map((category) => (
                            <SortableCategory
                                key={category.id}
                                category={category}
                                onEdit={(c) => setEditingCategory(c)}
                                onEditModule={(m) => setEditingModule(m)}
                                canModify={canModify}
                            />
                        ))}
                    </SortableContext>
                </div>

                {/* Overlay de arrastre */}
                <DragOverlay
                    dropAnimation={{
                        sideEffects: defaultDropAnimationSideEffects({
                            styles: { active: { opacity: '0.3' } },
                        }),
                    }}
                >
                    {activeDragItem ? (
                        <div
                            className={clsx(
                                'rounded-[12px] overflow-hidden',
                                'border border-[var(--color-primary)]/25',
                                'shadow-[0_8px_24px_rgba(0,0,0,0.16)]',
                                'ring-2 ring-[var(--color-primary)]/10',
                            )}
                        >
                            {activeDragItem.type === 'module' ? (
                                <SortableModule
                                    module={activeDragItem.module}
                                    isLast={true}
                                    onEdit={() => {}}
                                    canModify={false}
                                    isOverlay
                                />
                            ) : (
                                <div className="bg-[var(--color-bg-primary)] px-4 py-3 flex items-center gap-2.5">
                                    <div className="w-[30px] h-[30px] rounded-[8px] bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                                        <Layers size={14} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-none">
                                            {activeDragItem.group.name}
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                                            {activeDragItem.group.modules.length} módulos
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Modal editar categoría */}
            {editingCategory && (
                <EditModal
                    key={`cat-${editingCategory.id}`}
                    title="Editar categoría"
                    initialName={editingCategory.name}
                    initialOrder={editingCategory.order}
                    isOpen
                    onClose={() => setEditingCategory(null)}
                    onSave={(name, order) =>
                        handleUpdateCategory(editingCategory.id, { name, order })
                    }
                    isSaving={false}
                />
            )}

            {/* Modal editar módulo */}
            {editingModule && (
                <EditModal
                    key={`mod-${editingModule.id}`}
                    title="Editar módulo"
                    initialName={editingModule.label}
                    initialOrder={editingModule.order}
                    isOpen
                    onClose={() => setEditingModule(null)}
                    onSave={(label, order) =>
                        handleUpdateModule(editingModule.id, { label, order })
                    }
                    isSaving={false}
                />
            )}
        </div>
    );
}