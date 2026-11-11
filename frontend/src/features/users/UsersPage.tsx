import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
    Users, UserPlus, Search,
    Phone, RefreshCw, HelpCircle, Crown,
} from 'lucide-react';
import { clsx } from 'clsx';

import Table, { type TableColumn } from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import GenericHelpModal from '../../components/ui/GenericHelpModal';
import ConfirmModal from '../../components/ui/ConfirmModal';
import AccessDenied from '../../components/ui/AccessDenied';
import Button from '../../components/ui/Button';
import FormPanelUser from './components/FormPanelUser';
type PanelMode = 'create' | 'edit';
import UserDetailsPage from './components/UserDetailsPage';
import {
    EditActionButton,
    DeleteActionButton,
    DetailActionButton,
    ToggleActionButton,
} from '../../components/ui/ActionIconButtons';

import userService from '../../api/userService';
import useToastStore from '../../app/useToastStore';
import usePermissions from '../../hooks/usePermissions';
import { getImageUrl } from '../../utils/imageUtils';
import { getErrorDetail } from '../../utils/errorUtils';
import type { User as StoredUser } from '../../app/useUserStore';

/* ─── Types ──────────────────────────────────────────────────────────────────── */
type UserListItem = StoredUser & {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    avatar?: string | null;
    is_staff?: boolean;
    is_superuser?: boolean;
    groups_names?: string[];
    groups_details?: { id: number; name: string }[];
};



/* ══════════════════════════════════════════════════════════════════════════════
   UsersPage
   ══════════════════════════════════════════════════════════════════════════════ */
const UsersPage = () => {
    const { addToast } = useToastStore();
    const { has, isSuperuser } = usePermissions();

    const [users, setUsers] = useState<UserListItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [panelMode, setPanelMode] = useState<PanelMode>('create');
    const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
    const [viewingUser, setViewingUser] = useState<UserListItem | null>(null);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [isActioning, setIsActioning] = useState(false);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        type: 'toggle' | 'delete' | null;
        user: UserListItem | null;
    }>({ isOpen: false, type: null, user: null });

    const canReadAction = useMemo(() => isSuperuser || has('users.view'), [isSuperuser, has]);
    const canCreateAction = useMemo(() => isSuperuser || has('users.create'), [isSuperuser, has]);
    const canModifyAction = useMemo(() => isSuperuser || has('users.edit'), [isSuperuser, has]);
    const canDeactivateAction = useMemo(() => isSuperuser || has('users.deactivate'), [isSuperuser, has]);
    const canDeleteAction = useMemo(() => isSuperuser || has('users.delete'), [isSuperuser, has]);

    /* ── Fetch ── */
    const fetchData = useCallback(async (page = 1) => {
        setIsLoading(true);
        setCurrentPage(page);
        try {
            const usersData = await userService.getAll({ page, show_inactive: true });
            setUsers(usersData.results as UserListItem[]);
            setItemsPerPage(usersData.results.length || 20);
            setTotalItems(usersData.count ?? usersData.results.length);
        } catch (error: unknown) {
            const msg = getErrorDetail(error, 'Error al cargar los datos.');
            addToast({ type: 'error', message: msg });
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        const t = setTimeout(() => fetchData(1), 0);
        return () => clearTimeout(t);
    }, [fetchData]);

    /* ── Filtros ── */
    const filteredUsers = useMemo(() => users.filter(u => {
        const term = searchTerm.toLowerCase();
        const roleNames = [
            ...(u.groups_names || []),
            ...(u.groups_details?.map(g => g.name) || []),
            u.is_superuser ? ['Superusuario', 'Administrador'] : []
        ].flat().map(r => r.toLowerCase());

        return (
            u.email.toLowerCase().includes(term) ||
            (u.full_name?.toLowerCase().includes(term) ?? false) ||
            (`${u.first_name ?? ''} ${u.last_name ?? ''}`.trim().toLowerCase().includes(term)) ||
            roleNames.some(r => r.includes(term))
        );
    }), [users, searchTerm]);

    /* ── Panel ── */
    const handleOpenPanel = useCallback((user: UserListItem | null = null) => {
        setPanelMode(user ? 'edit' : 'create');
        setEditingUser(user);
        setIsPanelOpen(true);
    }, []);

    const handleOpenDetail = useCallback((user: UserListItem) => {
        setViewingUser(user);
    }, []);

    /* ── Confirm action ── */
    const executeAction = useCallback(async () => {
        if (isActioning || !confirmModal.user) return;
        setIsActioning(true);
        try {
            if (confirmModal.type === 'toggle') {
                await userService.toggleActive(confirmModal.user.id);
                addToast({ type: 'success', message: 'Estado del usuario modificado.' });
            } else if (confirmModal.type === 'delete') {
                const response = await userService.delete(confirmModal.user.id);
                addToast({
                    type: 'success',
                    message: response?.message || 'Usuario eliminado.'
                });
            }
            setConfirmModal({ isOpen: false, type: null, user: null });
            fetchData(currentPage);
        } catch (error: unknown) {
            const msg = getErrorDetail(error, 'Error al ejecutar la acción.');
            addToast({ type: 'error', message: msg });
        } finally {
            setIsActioning(false);
        }
    }, [confirmModal, isActioning, fetchData, currentPage, addToast]);

    /* ── Columnas ── */
    const userColumns = useMemo<TableColumn<UserListItem>[]>(() => [
        {
            header: 'Usuario',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full shrink-0 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] flex items-center justify-center overflow-hidden">
                        {row.avatar
                            ? <img src={getImageUrl(row.avatar)} alt="" className="w-full h-full object-cover" />
                            : <Users size={13} className="text-[var(--color-text-disabled)]" />
                        }
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[var(--color-text-primary)] leading-tight truncate">
                            {row.full_name || `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || 'Sin nombre'}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] font-mono truncate">{row.email}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Contacto',
            render: (row) => (
                <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-tertiary)]">
                    <Phone size={11} className="text-[var(--color-text-disabled)]" />
                    <span>{row.phone || '—'}</span>
                </div>
            ),
        },
        {
            header: 'Roles',
            render: (row) => {
                const roles: string[] = [];
                if (Array.isArray(row.groups_names) && row.groups_names.length > 0) {
                    roles.push(...row.groups_names);
                } else if (Array.isArray(row.groups_details) && row.groups_details.length > 0) {
                    roles.push(...row.groups_details.map(g => g.name));
                } else if (Array.isArray(row.groups) && row.groups.length > 0) {
                    row.groups.forEach(g => {
                        if (typeof g === 'object' && g && 'name' in g) {
                            roles.push((g as { name: string }).name);
                        }
                    });
                }

                return (
                    <div className="flex flex-wrap items-center gap-1">
                        {row.is_superuser && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 text-[10px] font-semibold border border-amber-500/20 flex items-center gap-1 shadow-sm">
                                <Crown size={10} className="shrink-0" />
                                Superusuario
                            </span>
                        )}
                        {roles.length > 0 ? (
                            roles.map((name: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] text-[10px] font-medium border border-[var(--color-border-subtle)]">
                                    {name}
                                </span>
                            ))
                        ) : !row.is_superuser ? (
                            <span className="text-[10px] text-[var(--color-text-disabled)] italic">Sin roles</span>
                        ) : null}
                    </div>
                );
            },
        },
        {
            header: 'Estado',
            render: (row) => (
                <button
                    onClick={() => canDeactivateAction && setConfirmModal({ isOpen: true, type: 'toggle', user: row })}
                    disabled={!canDeactivateAction}
                    title={canDeactivateAction ? `Click para ${row.is_active ? 'desactivar' : 'activar'}` : ''}
                    className={clsx(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all',
                        row.is_active
                            ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]'
                            : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
                        !canDeactivateAction && 'cursor-default opacity-70',
                    )}
                >
                    <span className={clsx(
                        'w-1.5 h-1.5 rounded-full',
                        row.is_active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]',
                    )} />
                    {row.is_active ? 'Activo' : 'Suspendido'}
                </button>
            ),
        },
        {
            header: 'Acciones',
            align: 'right',
            render: (row) => (
                <div className="flex items-center justify-end gap-1">
                    <DetailActionButton onClick={(e) => { e.stopPropagation(); handleOpenDetail(row); }} disabled={!canReadAction} />
                    {canDeactivateAction && (
                        <ToggleActionButton
                            active={!!row.is_active}
                            onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, type: 'toggle', user: row }); }}
                            title={row.is_active ? 'Desactivar' : 'Activar'}
                        />
                    )}
                    {canModifyAction && (
                        <EditActionButton onClick={(e) => { e.stopPropagation(); handleOpenPanel(row); }} />
                    )}
                    {canDeleteAction && (
                        <DeleteActionButton onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, type: 'delete', user: row }); }} />
                    )}
                </div>
            ),
        },
    ], [canModifyAction, canDeleteAction, canReadAction, canDeactivateAction, handleOpenPanel, handleOpenDetail]);

    if (!canReadAction) return <AccessDenied />;

    if (isPanelOpen) {
        return (
            <FormPanelUser
                mode={panelMode}
                userId={editingUser?.id}
                onSaved={() => {
                    setIsPanelOpen(false);
                    fetchData(currentPage);
                }}
                onCancel={() => setIsPanelOpen(false)}
                onDeleteUser={(u) => {
                    setIsPanelOpen(false);
                    setConfirmModal({ isOpen: true, type: 'delete', user: u });
                }}
            />
        );
    }

    if (viewingUser) {
        return (
            <UserDetailsPage
                userId={viewingUser.id}
                onClose={() => setViewingUser(null)}
            />
        );
    }

    return (
        <div className="space-y-4 pb-8">
            <header className="mb-4 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-[var(--color-primary)]/10 flex items-center justify-center border border-[var(--color-primary)]/20 shadow-sm">
                            <Users className="text-[var(--color-primary)]" size={20} />
                        </div>
                        <div>
                            <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)] tracking-tight leading-tight">
                                Gestión de Personal
                            </h1>
                            <p className="text-[13px] text-[var(--color-text-secondary)]">
                                Administra los usuarios del sistema, sus roles y accesos.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Barra de Búsqueda */}
                    <div className="relative group w-full sm:w-[320px]">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] group-focus-within:text-[var(--color-primary)] transition-colors"
                            size={16}
                        />
                        <input
                            type="text"
                            placeholder="Buscar usuario…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[13px] text-[var(--color-text-primary)] font-medium placeholder:text-[var(--color-text-disabled)] placeholder:font-normal focus:outline-none focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>

                    {/* Ícono ayuda */}
                    <button
                        onClick={() => setIsHelpOpen(true)}
                        className="w-9 h-9 rounded-[var(--radius-lg)] flex items-center justify-center bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                        title="Información"
                    >
                        <HelpCircle size={15} />
                    </button>

                    {/* Ícono refresh */}
                    <button
                        onClick={() => fetchData(1)}
                        disabled={isLoading}
                        className="w-9 h-9 rounded-[var(--radius-lg)] flex items-center justify-center bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-40"
                        title="Actualizar"
                    >
                        <RefreshCw size={15} className={clsx(isLoading && 'animate-spin')} />
                    </button>

                    {canCreateAction && (
                        <Button
                            variant="primary"
                            onClick={() => handleOpenPanel(null)}
                            className="h-9 px-4 ml-auto sm:ml-0"
                            icon={UserPlus}
                        >
                            <span>Nuevo</span>
                        </Button>
                    )}
                </div>
            </header>

            <main className="bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-xl)] flex flex-col shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="overflow-auto p-4 md:p-0">
                    {/* ── Mobile Cards (< md) ─────────────────────────────────── */}
                    <div className="md:hidden space-y-3 p-4">
                        {/* Skeleton mobile */}
                        {isLoading && Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 space-y-3 animate-pulse"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)]" />
                                    <div className="space-y-1.5 flex-1">
                                        <div className="h-4 w-1/2 bg-[var(--color-bg-secondary)] rounded" />
                                        <div className="h-3 w-3/4 bg-[var(--color-bg-secondary)] rounded" />
                                    </div>
                                </div>
                                <div className="h-3 w-1/3 bg-[var(--color-bg-secondary)] rounded pt-2" />
                            </div>
                        ))}

                        {/* Empty state mobile */}
                        {!isLoading && filteredUsers.length === 0 && (
                            <div className="py-10 text-center text-[11px] text-[var(--color-text-disabled)] uppercase tracking-widest">
                                No se encontraron registros.
                            </div>
                        )}

                        {/* Cards */}
                        {!isLoading && filteredUsers.map((user) => (
                            <div
                                key={user.id}
                                onClick={() => canModifyAction && handleOpenPanel(user)}
                                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 space-y-3 cursor-pointer hover:border-[var(--color-border-focus)] active:bg-[var(--color-primary)]/5 transition-all"
                            >
                                {/* Avatar + Nombre + Email */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full shrink-0 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] flex items-center justify-center overflow-hidden">
                                        {user.avatar
                                            ? <img src={getImageUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
                                            : <Users size={16} className="text-[var(--color-text-disabled)]" />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-bold text-[var(--color-text-primary)] leading-tight truncate">
                                            {user.full_name || `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Sin nombre'}
                                        </p>
                                        <p className="text-[11px] text-[var(--color-text-tertiary)] font-mono truncate">{user.email}</p>
                                    </div>
                                </div>

                                {/* Teléfono + Roles */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                    {user.phone && (
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Contacto</p>
                                            <p className="text-[12px] font-medium text-[var(--color-text-primary)]">{user.phone}</p>
                                        </div>
                                    )}
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Roles</p>
                                        <div className="flex flex-wrap gap-1">
                                            {user.groups_names?.length ? (
                                                user.groups_names.map((name: string, i: number) => (
                                                    <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)] text-[10px] font-medium border border-[var(--color-border-subtle)]">
                                                        {name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[10px] text-[var(--color-text-disabled)] italic">Sin roles</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Footer: estado + acciones */}
                                <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border-subtle)]/50 pt-2.5">
                                    {/* Badge de estado */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (canDeactivateAction) {
                                                setConfirmModal({ isOpen: true, type: 'toggle', user });
                                            }
                                        }}
                                        disabled={!canDeactivateAction}
                                        className={clsx(
                                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border',
                                            user.is_active
                                                ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success)]/20'
                                                : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger)]/20',
                                            !canDeactivateAction && 'cursor-default opacity-70'
                                        )}
                                    >
                                        <span className={clsx(
                                            'w-1.5 h-1.5 rounded-full',
                                            user.is_active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'
                                        )} />
                                        {user.is_active ? 'Activo' : 'Suspendido'}
                                    </button>

                                    {/* Botones de acción */}
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <DetailActionButton onClick={() => handleOpenDetail(user)} disabled={!canReadAction} />
                                        {canDeactivateAction && (
                                            <ToggleActionButton
                                                active={!!user.is_active}
                                                onClick={() => setConfirmModal({ isOpen: true, type: 'toggle', user })}
                                                title={user.is_active ? 'Desactivar' : 'Activar'}
                                            />
                                        )}
                                        {canModifyAction && (
                                            <EditActionButton onClick={() => handleOpenPanel(user)} />
                                        )}
                                        {canDeleteAction && (
                                            <DeleteActionButton onClick={() => setConfirmModal({ isOpen: true, type: 'delete', user })} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop Table (≥ md) ─────────────────────────────────── */}
                    <div className="hidden md:block">
                        <Table
                            columns={userColumns}
                            data={filteredUsers}
                            isLoading={isLoading}
                            onRowClick={(row) => canModifyAction && handleOpenPanel(row)}
                            emptyMessage={searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda.' : 'No hay usuarios en el sistema.'}
                        />
                    </div>
                </div>

                <div className="shrink-0 border-t border-[var(--color-border-subtle)] p-3 bg-[var(--color-bg-primary)]">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={(page) => fetchData(page)}
                    />
                </div>
            </main>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ isOpen: false, type: null, user: null })}
                onConfirm={executeAction}
                isLoading={isActioning}
                title={confirmModal.type === 'delete' ? 'Eliminar usuario' : 'Cambiar estado'}
                message={
                    confirmModal.type === 'delete'
                        ? `¿Eliminar permanentemente a ${confirmModal.user?.full_name || confirmModal.user?.email}?`
                        : `¿Deseas ${confirmModal.user?.is_active ? 'suspender' : 'activar'} el acceso para ${confirmModal.user?.full_name || confirmModal.user?.email}?`
                }
                variant={confirmModal.type === 'delete' ? 'danger' : 'warning'}
                confirmText={confirmModal.type === 'delete' ? 'Eliminar definitivamente' : 'Confirmar cambio'}
            />

            <GenericHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Gestión de personal">
                <div className="space-y-3 text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                    <p>En este módulo puedes gestionar las cuentas de acceso de tu equipo.</p>
                    <ul className="list-disc pl-4 space-y-1.5">
                        <li><strong className="text-[var(--color-text-primary)] font-medium">Roles:</strong> controla los accesos mediante la asignación de roles predefinidos.</li>
                        <li><strong className="text-[var(--color-text-primary)] font-medium">Estado:</strong> puedes suspender o reactivar accesos sin perder el historial.</li>
                        <li><strong className="text-[var(--color-text-primary)] font-medium">Seguridad:</strong> las contraseñas deben cumplir los criterios de robustez.</li>
                    </ul>
                </div>
            </GenericHelpModal>
        </div>
    );
};

export default memo(UsersPage);
