import { useState, useEffect, useCallback, useRef, memo, useMemo, type ElementType } from 'react';
import {
    Shield, Info, Network,
    Save, RotateCcw, Plus, Trash2, ChevronRight, LayoutGrid
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import Loading      from '../../../components/ui/Loading';
import Button       from '../../../components/ui/Button';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import AccessDenied from '../../../components/ui/AccessDenied';
import PermissionSearchInput from '../components/PermissionSearchInput';
import groupService from '../../../api/groupService';
import useToastStore from '../../../app/useToastStore';
import usePermissions from '../../../hooks/usePermissions';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

interface Permission {
    id: number;
    codename: string;
    label: string;
    description: string;
    order: number;
}

interface RoleModule {
    id:    number;
    icon?: string;
    label: string;
    path?: string;
    permissions?: Permission[];
}

interface ModuleCategory {
    id:       number;
    name:     string;
    modules?: RoleModule[];
}

interface Role {
    id:      number;
    name:    string;
    modules: number[];
    permissions: number[];
}

interface RawRoleGroup {
    id: number;
    name: string;
    modules?: unknown;
    menu_module_ids?: unknown;
    permissions?: unknown;
    permission_ids?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeList<T>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    if (isRecord(data) && Array.isArray(data.results))
        return data.results as T[];
    return [];
}

function extractModuleIds(raw: unknown): number[] {
    const arr: unknown[] =
        isRecord(raw) && Array.isArray(raw.modules)           ? raw.modules
        : isRecord(raw) && Array.isArray(raw.menu_module_ids) ? raw.menu_module_ids
        : [];
    return arr.map((m) => (
        isRecord(m)
            ? Number(m.id)
            : Number(m)
    ));
}

function extractPermissionIds(raw: unknown): number[] {
    const arr: unknown[] =
        isRecord(raw) && Array.isArray(raw.permission_ids) ? raw.permission_ids
        : isRecord(raw) && Array.isArray(raw.permissions)  ? raw.permissions
        : [];
    return arr.map((m) => (
        isRecord(m)
            ? Number(m.id)
            : Number(m)
    ));
}

// ─────────────────────────────────────────────────────────────────────────────
// PermissionCard — iOS Settings style
// ─────────────────────────────────────────────────────────────────────────────

interface PermissionCardProps {
    module:   RoleModule;
    isActive: boolean;
    selectedPermissions: Set<number>;
    onToggle: (module: RoleModule) => void;
    onTogglePermission: (permissionId: number) => void;
    disabled?: boolean;
    searchTerm?: string;
}

const PermissionCard = memo(({ module, isActive, selectedPermissions, onToggle, onTogglePermission, disabled, searchTerm }: PermissionCardProps) => {
    const iconMap = Icons as unknown as Record<string, ElementType>;
    const Icon = iconMap[module.icon ?? ''] ?? LayoutGrid;

    const hasSearchTerm = !!searchTerm?.trim();
    const isExpanded = isActive || (hasSearchTerm && module.permissions && module.permissions.length > 0);

    return (
        <div className="flex flex-col">
            <button
                type="button"
                onClick={() => !disabled && onToggle(module)}
                disabled={disabled}
                aria-pressed={isActive}
                className={clsx(
                    'w-full flex items-center gap-3 px-4 py-[11px] text-left',
                    'bg-[var(--color-bg-primary)]',
                    'transition-colors duration-[var(--transition-fast)]',
                    !disabled && 'active:bg-[var(--color-bg-secondary)]',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            >
                {/* Pastilla icono iOS */}
                <div className={clsx(
                    'w-[30px] h-[30px] rounded-[8px] flex items-center justify-center shrink-0',
                    'transition-colors duration-[var(--transition-fast)]',
                    isActive
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                )}>
                    <Icon size={15} strokeWidth={2} />
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                    <p className={clsx(
                        'text-[14px] font-medium leading-none mb-[3px] truncate',
                        isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                    )}>
                        {module.label}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-none truncate font-mono">
                        {module.path || '—'}
                    </p>
                </div>

                {/* Toggle switch iOS (44×26) */}
                <div
                    aria-hidden="true"
                    className={clsx(
                        'w-[33px] h-[18px] rounded-full flex items-center px-[2px] shrink-0',
                        'transition-colors duration-200',
                        isActive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)]'
                    )}
                >
                    <span className={clsx(
                        'w-[18px] h-[18px] rounded-full bg-white shrink-0',
                        'shadow-[0_1px_3px_rgba(0,0,0,0.18)]',
                        'transition-transform duration-200',
                        isActive ? 'translate-x-[18px]' : 'translate-x-0'
                    )} />
                </div>
            </button>

            {isExpanded && module.permissions && module.permissions.length > 0 && (
                <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/60">
                    {module.permissions.map((p, pIdx) => {
                        const isPermActive = selectedPermissions.has(p.id);
                        const isLastPerm = pIdx === module.permissions!.length - 1;
                        return (
                            <div key={p.id} className={clsx(
                                'flex items-center gap-3 pl-14 pr-4 py-[10px]',
                                !isLastPerm && 'border-b border-[var(--color-border-subtle)]/50'
                            )}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-[2px]">
                                        <span className={clsx(
                                            'text-[13px] font-medium',
                                            isPermActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'
                                        )}>{p.label}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-[1px] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                                            {p.codename}
                                        </span>
                                    </div>
                                    {p.description && (
                                        <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight">{p.description}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !disabled && onTogglePermission(p.id)}
                                    disabled={disabled}
                                    className={clsx(
                                        'w-[38px] h-[22px] rounded-full flex items-center px-[2px] shrink-0',
                                        'transition-colors duration-200',
                                        disabled && 'opacity-50 cursor-not-allowed',
                                        isPermActive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-bg-tertiary)]'
                                    )}
                                >
                                    <span className={clsx(
                                        'w-[18px] h-[18px] rounded-full bg-white shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.18)]',
                                        'transition-transform duration-200',
                                        isPermActive ? 'translate-x-[16px]' : 'translate-x-0'
                                    )} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});
PermissionCard.displayName = 'PermissionCard';

// ─────────────────────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────────────────────

const RolesPermissionsPage = () => {
    const { addToast }                      = useToastStore();
    const { has, isSuperuser } = usePermissions();
    
    // En esta página (Roles y Permisos), usamos permisos de configuración
    const canRead   = isSuperuser || has('settings.manage') || has('settings.roles_view') || has('settings.roles_manage');
    const canModify = isSuperuser || has('settings.manage') || has('settings.roles_manage');
    const canDelete = isSuperuser || has('settings.manage') || has('settings.roles_manage');

    const [groups, setGroups]                 = useState<Role[]>([]);
    const [tree, setTree]                     = useState<ModuleCategory[]>([]);
    const [selectedGroup, setSelectedGroup]   = useState<Role | null>(null);
    const [selectedIds, setSelectedIds]       = useState<Set<number>>(new Set());
    const [selectedPermIds, setSelectedPermIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading]           = useState(true);
    const [isSaving, setIsSaving]             = useState(false);
    const [isDirty, setIsDirty]               = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState<{ isOpen: boolean; pendingGroup: Role | null }>({
        isOpen: false, pendingGroup: null,
    });
    const [deleteConfirm, setDeleteConfirm]   = useState<{ isOpen: boolean; group: Role | null }>({
        isOpen: false, group: null,
    });
    const [isCreateOpen, setIsCreateOpen]     = useState(false);
    const [newRoleName, setNewRoleName]       = useState('');
    const [isCreating, setIsCreating]         = useState(false);
    const [searchTerm, setSearchTerm]         = useState('');

    const filteredTree = useMemo(() => {
        if (!searchTerm.trim()) return tree;

        const term = searchTerm.toLowerCase().trim();

        return tree.map(category => {
            const categoryMatches = category.name.toLowerCase().includes(term);

            const filteredModules = (category.modules ?? []).map(module => {
                const moduleMatches = 
                    module.label.toLowerCase().includes(term) || 
                    (module.path && module.path.toLowerCase().includes(term));

                const filteredPermissions = (module.permissions ?? []).filter(perm => 
                    perm.label.toLowerCase().includes(term) ||
                    perm.codename.toLowerCase().includes(term) ||
                    perm.description.toLowerCase().includes(term)
                );

                const hasMatchingPermission = filteredPermissions.length > 0;

                if (categoryMatches || moduleMatches || hasMatchingPermission) {
                    return {
                        ...module,
                        permissions: hasMatchingPermission ? filteredPermissions : module.permissions
                    } as RoleModule;
                }
                return null;
            }).filter((m): m is RoleModule => m !== null);

            if (categoryMatches || filteredModules.length > 0) {
                return {
                    ...category,
                    modules: filteredModules
                } as ModuleCategory;
            }
            return null;
        }).filter((c): c is ModuleCategory => c !== null);
    }, [tree, searchTerm]);

    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // ── Carga inicial ─────────────────────────────────────────────────────────
    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rawGroups, rawTree] = await Promise.all([
                groupService.getAll(),
                groupService.getPermissionTree(),
            ]);

            const roles: Role[] = normalizeList<RawRoleGroup>(rawGroups).map(g => ({
                id:      g.id,
                name:    g.name,
                modules: extractModuleIds(g),
                permissions: extractPermissionIds(g),
            }));

            const categories: ModuleCategory[] = normalizeList<ModuleCategory>(rawTree);

            if (!mountedRef.current) return;
            setGroups(roles);
            setTree(categories);

            if (roles.length > 0) {
                setSelectedGroup(roles[0]);
                setSelectedIds(new Set(roles[0].modules));
                setSelectedPermIds(new Set(roles[0].permissions));
            }
        } catch {
            if (mountedRef.current)
                addToast({ type: 'error', message: 'Error al cargar la configuración de roles.' });
        } finally {
            if (mountedRef.current) setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        const t = setTimeout(() => fetchInitialData(), 0);
        return () => clearTimeout(t);
    }, [fetchInitialData]);

    // ── Selección de grupo ────────────────────────────────────────────────────
    const applyGroupSelection = useCallback((group: Role) => {
        setSelectedGroup(group);
        setSelectedIds(new Set(group.modules));
        setSelectedPermIds(new Set(group.permissions));
        setIsDirty(false);
        setConfirmDiscard({ isOpen: false, pendingGroup: null });
    }, []);

    const handleSelectGroup = useCallback((group: Role) => {
        if (selectedGroup?.id === group.id) return;
        if (isDirty) {
            setConfirmDiscard({ isOpen: true, pendingGroup: group });
            return;
        }
        applyGroupSelection(group);
    }, [isDirty, applyGroupSelection, selectedGroup]);

    // ── Toggle módulo ─────────────────────────────────────────────────────────
    const handleToggle = useCallback((module: RoleModule) => {
        if (!canModify) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(module.id)) {
                next.delete(module.id);
                if (module.permissions) {
                    setSelectedPermIds(prevPerms => {
                        const newPerms = new Set(prevPerms);
                        module.permissions!.forEach(p => newPerms.delete(p.id));
                        return newPerms;
                    });
                }
            } else {
                next.add(module.id);
                if (module.permissions) {
                    setSelectedPermIds(prevPerms => {
                        const newPerms = new Set(prevPerms);
                        module.permissions!.forEach(p => newPerms.add(p.id));
                        return newPerms;
                    });
                }
            }
            return next;
        });
        setIsDirty(true);
    }, [canModify]);

    const handleTogglePermission = useCallback((permissionId: number) => {
        if (!canModify) return;
        setSelectedPermIds(prev => {
            const next = new Set(prev);
            if (next.has(permissionId)) next.delete(permissionId);
            else next.add(permissionId);
            return next;
        });
        setIsDirty(true);
    }, [canModify]);

    // ── Guardar ───────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (!selectedGroup || !isDirty || isSaving || !canModify) return;
        setIsSaving(true);
        try {
            const updatedModuleIds = Array.from(selectedIds);
            const updatedPermissionIds = Array.from(selectedPermIds);
            
            await Promise.all([
                groupService.updateModules(selectedGroup.id, updatedModuleIds),
                groupService.updatePermissions(selectedGroup.id, updatedPermissionIds)
            ]);
            
            if (!mountedRef.current) return;

            const updatedRole: Role = { ...selectedGroup, modules: updatedModuleIds, permissions: updatedPermissionIds };
            setSelectedGroup(updatedRole);
            setGroups(prev => prev.map(g => g.id === selectedGroup.id ? updatedRole : g));
            setIsDirty(false);

            addToast({ type: 'success', message: `Permisos guardados para "${selectedGroup.name}".` });
        } catch {
            if (mountedRef.current)
                addToast({ type: 'error', message: 'Error al guardar los cambios.' });
        } finally {
            if (mountedRef.current) setIsSaving(false);
        }
    }, [selectedGroup, isDirty, isSaving, selectedIds, selectedPermIds, addToast, canModify]);

    // ── Crear rol ─────────────────────────────────────────────────────────────
    const handleCreateRole = useCallback(async () => {
        const trimmed = newRoleName.trim();
        if (!trimmed || isCreating) return;

        if (groups.some(g => g.name.toLowerCase() === trimmed.toLowerCase())) {
            addToast({ type: 'warning', message: `Ya existe un rol con el nombre "${trimmed}".` });
            return;
        }

        setIsCreating(true);
        try {
            const raw = await groupService.create({ name: trimmed });
            if (!mountedRef.current) return;

            const newRole: Role = {
                id:      raw.id,
                name:    raw.name,
                modules: extractModuleIds(raw),
                permissions: extractPermissionIds(raw),
            };

            setGroups(prev => [...prev, newRole]);
            setIsCreateOpen(false);
            setNewRoleName('');
            addToast({ type: 'success', message: `Rol "${newRole.name}" creado correctamente.` });
            applyGroupSelection(newRole);
        } catch (err: unknown) {
            const message =
                isRecord(err) &&
                isRecord(err.response) &&
                isRecord(err.response.data) &&
                typeof err.response.data.message === 'string'
                    ? err.response.data.message
                    : 'Error al crear el rol.';

            if (mountedRef.current)
                addToast({
                    type: 'error',
                    message,
                });
        } finally {
            if (mountedRef.current) setIsCreating(false);
        }
    }, [newRoleName, isCreating, groups, addToast, applyGroupSelection]);

    // ── Eliminar rol ──────────────────────────────────────────────────────────
    const handleDeleteRole = useCallback(async () => {
        const groupToDelete = deleteConfirm.group;
        if (!groupToDelete || !canDelete) return;

        setDeleteConfirm({ isOpen: false, group: null });

        try {
            await groupService.delete(groupToDelete.id);
            if (!mountedRef.current) return;

            const remaining = groups.filter(g => g.id !== groupToDelete.id);
            setGroups(remaining);

            if (selectedGroup?.id === groupToDelete.id) {
                if (remaining.length > 0) {
                    applyGroupSelection(remaining[0]);
                } else {
                    setSelectedGroup(null);
                    setSelectedIds(new Set());
                    setSelectedPermIds(new Set());
                    setIsDirty(false);
                }
            }

            addToast({ type: 'success', message: `Rol "${groupToDelete.name}" eliminado.` });
        } catch (err: unknown) {
            const message =
                isRecord(err) &&
                isRecord(err.response) &&
                isRecord(err.response.data) &&
                typeof err.response.data.message === 'string'
                    ? err.response.data.message
                    : 'Error al eliminar el rol.';

            if (mountedRef.current)
                addToast({
                    type: 'error',
                    message,
                });
        }
    }, [deleteConfirm.group, canDelete, selectedGroup, groups, addToast, applyGroupSelection]);

    // ── Guards ────────────────────────────────────────────────────────────────
    if (!canRead) {
        return (
            <AccessDenied
                title="Sin acceso"
                message="No tienes permisos para gestionar módulos y roles del sistema."
                redirectPath="/dashboard"
            />
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Loading />
                <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] animate-pulse">
                    Cargando configuración de roles…
                </p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">

            {/* ── Modales ──────────────────────────────────────────────────── */}

            <ConfirmModal
                isOpen={confirmDiscard.isOpen}
                onClose={() => setConfirmDiscard({ isOpen: false, pendingGroup: null })}
                onConfirm={() => confirmDiscard.pendingGroup && applyGroupSelection(confirmDiscard.pendingGroup)}
                title="Cambios sin guardar"
                message={`Tienes cambios pendientes en "${selectedGroup?.name}". ¿Descartar y continuar?`}
                confirmText="Descartar y continuar"
                cancelText="Seguir editando"
                variant="warning"
            />

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, group: null })}
                onConfirm={handleDeleteRole}
                title="Eliminar Rol"
                message={`¿Eliminar el rol "${deleteConfirm.group?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                variant="danger"
            />

            <ConfirmModal
                isOpen={isCreateOpen}
                onClose={() => { setIsCreateOpen(false); setNewRoleName(''); }}
                onConfirm={handleCreateRole}
                title="Crear Nuevo Rol"
                confirmText={isCreating ? 'Creando…' : 'Crear Rol'}
                cancelText="Cancelar"
                variant="primary"
            >
                <div className="space-y-2 py-1">
                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        Nombre del nuevo rol
                    </label>
                    <input
                        autoFocus
                        type="text"
                        value={newRoleName}
                        onChange={e => setNewRoleName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                        placeholder="Ej: Supervisor, Editor…"
                        maxLength={80}
                        className={clsx(
                            'w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)]',
                            'rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] text-[var(--color-text-primary)]',
                            'placeholder-[var(--color-text-disabled)]',
                            'focus:outline-none focus:border-[var(--color-border-focus)] transition-colors'
                        )}
                    />
                </div>
            </ConfirmModal>

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-3">
                    {/* Pastilla iOS */}
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <Shield size={16} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-[15px] font-semibold text-[var(--color-text-primary)] leading-none mb-0.5">
                            Módulos y Roles
                        </h2>
                        <p className="text-[12px] text-[var(--color-text-secondary)]">
                            Asigna visibilidad de módulos por rol
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchInitialData}
                    className={clsx(
                        'flex items-center gap-1.5 px-3 py-[7px] rounded-[20px]',
                        'bg-[var(--color-bg-secondary)] text-[12px] font-medium',
                        'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                        'transition-colors active:opacity-70'
                    )}
                >
                    <RotateCcw size={12} />
                    Recargar
                </button>
            </div>

            {/* ── Lista de roles ────────────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between px-1 mb-2">
                    <p className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
                        Roles del sistema
                    </p>
                    {canModify && (
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="flex items-center gap-1 text-[13px] font-medium text-[var(--color-primary)] hover:opacity-70 transition-opacity active:opacity-50"
                        >
                            <Plus size={14} />
                            Nuevo rol
                        </button>
                    )}
                </div>

                {/* iOS grouped list */}
                <div className="rounded-[12px] border border-[var(--color-border-subtle)] overflow-hidden">
                    {groups.length === 0 ? (
                        <div className="px-4 py-8 bg-[var(--color-bg-primary)] text-center">
                            <p className="text-[14px] text-[var(--color-text-secondary)] mb-2">
                                No hay roles configurados.
                            </p>
                            {canModify && (
                                <button
                                    onClick={() => setIsCreateOpen(true)}
                                    className="text-[13px] font-medium text-[var(--color-primary)] hover:opacity-70 transition-opacity"
                                >
                                    + Crear primer rol
                                </button>
                            )}
                        </div>
                    ) : (
                        groups.map((group, idx) => {
                            const isActive = selectedGroup?.id === group.id;
                            const isLast   = idx === groups.length - 1;

                            return (
                                <div key={group.id} className="relative">
                                    <div
                                        onClick={() => handleSelectGroup(group)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSelectGroup(group);
                                            }
                                        }}
                                        className={clsx(
                                            'w-full flex items-center gap-3 px-4 py-[11px] cursor-pointer outline-none',
                                            'transition-colors duration-[var(--transition-fast)]',
                                            'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]',
                                            isActive
                                                ? 'bg-[var(--color-primary)]/7'
                                                : 'bg-[var(--color-bg-primary)] active:bg-[var(--color-bg-secondary)]'
                                        )}
                                    >
                                        {/* Pastilla icono iOS */}
                                        <div className={clsx(
                                            'w-[30px] h-[30px] rounded-[8px] flex items-center justify-center shrink-0',
                                            'transition-colors duration-[var(--transition-fast)]',
                                            isActive
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
                                        )}>
                                            <Shield size={14} strokeWidth={2} />
                                        </div>

                                        {/* Texto */}
                                        <div className="flex-1 min-w-0 pointer-events-none">
                                            <p className={clsx(
                                                'text-[14px] font-medium leading-none mb-[3px] truncate',
                                                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                                            )}>
                                                {group.name}
                                            </p>
                                            <p className="text-[12px] text-[var(--color-text-secondary)] leading-none">
                                                {group.modules.length} módulo{group.modules.length !== 1 ? 's' : ''} asignado{group.modules.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>

                                        {/* Badge de conteo */}
                                        <span className={clsx(
                                            'text-[12px] font-semibold shrink-0 min-w-[22px] text-center',
                                            'px-2 py-0.5 rounded-full',
                                            isActive
                                                ? 'bg-[var(--color-primary)]/12 text-[var(--color-primary)]'
                                                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                                        )}>
                                            {group.modules.length}
                                        </span>

                                        {/* Botón eliminar (solo en fila activa y no sea Cliente) */}
                                        {isActive && canDelete && group.name !== 'Cliente' && (
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, group }); }}
                                                className={clsx(
                                                    'w-7 h-7 flex items-center justify-center shrink-0',
                                                    'rounded-full transition-colors',
                                                    'text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]',
                                                    'active:opacity-70'
                                                )}
                                                title={`Eliminar rol ${group.name}`}
                                                aria-label={`Eliminar rol ${group.name}`}
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}

                                        {/* Chevron iOS */}
                                        <ChevronRight
                                            size={14}
                                            className={clsx(
                                                'shrink-0 pointer-events-none transition-colors',
                                                isActive
                                                    ? 'text-[var(--color-primary)] opacity-60'
                                                    : 'text-[var(--color-text-secondary)] opacity-40'
                                            )}
                                        />
                                    </div>

                                    {/* Separador que nace desde el icono */}
                                    {!isLast && (
                                        <span className="absolute bottom-0 left-[52px] right-0 h-px bg-[var(--color-border-subtle)]" />
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Panel de módulos ─────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
                {selectedGroup && (
                    <motion.div
                        key={selectedGroup.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.16 }}
                        className="space-y-5"
                    >
                        {/* Banner informativo */}
                        <div className={clsx(
                            'flex items-start gap-3 px-4 py-3',
                            'rounded-[12px] bg-[var(--color-info-bg)]',
                            'border border-[var(--color-info)]/20'
                        )}>
                            <Info size={14} className="text-[var(--color-info)] mt-0.5 shrink-0" />
                            <div className="text-[13px] text-[var(--color-info-text)] leading-relaxed">
                                <p>
                                    Configurando accesos para{' '}
                                    <span className="font-semibold">{selectedGroup.name}</span>.
                                </p>
                                <p className="mt-1 text-[12px] opacity-80">
                                    Activa un módulo para dar acceso al menú. Luego ajusta los permisos específicos debajo de cada módulo.
                                </p>
                            </div>
                        </div>

                        {/* Buscador de permisos y módulos */}
                        <PermissionSearchInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Buscar módulo, ruta o permiso..."
                        />

                        {/* Árbol de módulos */}
                        {filteredTree.length === 0 ? (
                            <div className={clsx(
                                'px-4 py-8 text-center rounded-[12px]',
                                'border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]'
                            )}>
                                <p className="text-[14px] text-[var(--color-text-secondary)]">
                                    {searchTerm.trim()
                                        ? 'No se encontraron módulos o permisos que coincidan con la búsqueda.'
                                        : 'No hay módulos configurados en el sistema.'}
                                </p>
                            </div>
                        ) : (
                            filteredTree.map(category => (
                                <div key={category.id}>
                                    {/* Cabecera de categoría */}
                                    <div className="flex items-center justify-between px-1 mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <Network size={11} className="text-[var(--color-text-secondary)]" />
                                            <p className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
                                                {category.name}
                                            </p>
                                        </div>
                                        <span className="text-[12px] font-medium text-[var(--color-text-secondary)] tabular-nums">
                                            {category.modules?.filter(m => selectedIds.has(m.id)).length ?? 0}
                                            {' / '}
                                            {category.modules?.length ?? 0}
                                        </span>
                                    </div>

                                    {/* Lista iOS grouped */}
                                    <div className="rounded-[12px] border border-[var(--color-border-subtle)] overflow-hidden">
                                        {(category.modules ?? []).map((module, idx) => {
                                            const isLast = idx === (category.modules!.length - 1);
                                            return (
                                                <div key={module.id} className="relative">
                                                    <PermissionCard
                                                        module={module}
                                                        isActive={selectedIds.has(module.id)}
                                                        selectedPermissions={selectedPermIds}
                                                        onToggle={handleToggle}
                                                        onTogglePermission={handleTogglePermission}
                                                        disabled={!canModify}
                                                        searchTerm={searchTerm}
                                                    />
                                                    {!isLast && (
                                                        <span className="absolute bottom-0 left-[52px] right-0 h-px bg-[var(--color-border-subtle)]" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}

                        {/* Footer sticky */}
                        <div className={clsx(
                            'flex items-center justify-between px-4 py-3 sticky bottom-0 z-20',
                            'rounded-[12px] bg-[var(--color-bg-primary)]',
                            'border border-[var(--color-border-subtle)] shadow-[var(--shadow-md)]'
                        )}>
                            <div className="flex items-center gap-2">
                                {/* Dot de estado */}
                                <span className={clsx(
                                    'w-2 h-2 rounded-full shrink-0 transition-colors',
                                    isDirty
                                        ? 'bg-[var(--color-warning)]'
                                        : 'bg-[var(--color-bg-tertiary)]'
                                )} />
                                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                                    {isDirty ? 'Cambios pendientes' : 'Sin cambios'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {isDirty && (
                                    <button
                                        onClick={() => applyGroupSelection(selectedGroup)}
                                        className="px-3 py-2 text-[13px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:opacity-60"
                                    >
                                        Descartar
                                    </button>
                                )}
                                <Button
                                    variant="primary"
                                    onClick={handleSave}
                                    disabled={!isDirty || isSaving || !canModify}
                                    icon={Save}
                                    className="px-5 text-[13px] rounded-[20px]"
                                >
                                    {isSaving ? 'Guardando…' : 'Guardar'}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default memo(RolesPermissionsPage);