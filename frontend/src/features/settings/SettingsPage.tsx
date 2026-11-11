import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
    Building, User, ShieldCheck, ChevronRight, ChevronLeft,
    LayoutGrid, ChevronDown, X,
} from 'lucide-react';
import { clsx } from 'clsx';

import Skeleton from '../../components/ui/Skeleton';
import usePermissions from '../../hooks/usePermissions';

interface NavItemDefinition {
    label: string;
    path: string;
    icon: React.ElementType;
    description: string;
    permission?: string;
    strictPermission?: boolean;
}

interface NavGroupDefinition {
    groupLabel: string;
    items: NavItemDefinition[];
}

// ─── Navegación lateral de configuración ──────────────────────────────────────
const NAV_GROUPS: NavGroupDefinition[] = [
    {
        groupLabel: 'Empresa',
        items: [
            {
                label: 'Organización',
                path: '/dashboard/configuracion/organizacion',
                icon: Building,
                description: 'Identidad y local',
                permission: 'settings.org_view',
            },
            {
                label: 'Módulos y Roles',
                path: '/dashboard/configuracion/permisos',
                icon: ShieldCheck,
                description: 'Visibilidad y roles',
                permission: 'settings.roles_view',
            },
            {
                label: 'Estructura del Menú',
                path: '/dashboard/configuracion/menu',
                icon: LayoutGrid,
                description: 'Organizar categorías',
                permission: 'settings.menu_view',
            },

        ],
    },
    {
        groupLabel: 'Cuenta',
        items: [
            {
                label: 'Mi Perfil',
                path: '/dashboard/configuracion/perfil',
                icon: User,
                description: 'Datos personales',
                permission: 'settings.profile_view',
            },
        ],
    },
];


// ─── Ítem de navegación desktop (estilo iOS Settings) ─────────────────────────
interface NavItemProps {
    label: string;
    path: string;
    icon: React.ElementType;
    description: string;
    isFirst: boolean;
    isLast: boolean;
    isCollapsed: boolean;
}

const SettingsNavItem = memo(({ label, path, icon: Icon, description, isFirst, isLast, isCollapsed }: NavItemProps) => (
    <NavLink
        to={path}
        end
        className={({ isActive }) => clsx(
            'flex items-center transition-colors duration-[var(--transition-fast)] relative group',
            isFirst && 'rounded-t-[var(--radius-md)]',
            isLast && 'rounded-b-[var(--radius-md)]',
            isCollapsed ? 'justify-center p-3 h-12' : 'gap-3 px-4 py-3',
            isActive
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]',
        )}
        title={isCollapsed ? label : undefined}
    >
        {({ isActive }: { isActive: boolean }) => (
            <>
                <div className={clsx(
                    'w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 transition-colors',
                    isActive
                        ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
                )}>
                    <Icon size={15} strokeWidth={2} />
                </div>

                {!isCollapsed && (
                    <>
                        <div className="flex-1 min-w-0">
                            <p className={clsx(
                                'text-[13px] font-semibold leading-none mb-0.5 truncate',
                                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]',
                            )}>
                                {label}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] leading-none truncate">
                                {description}
                            </p>
                        </div>

                        <ChevronRight
                            size={14}
                            strokeWidth={2}
                            className={clsx(
                                'shrink-0 transition-colors',
                                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-disabled)]',
                            )}
                        />
                    </>
                )}

                {!isCollapsed && !isLast && (
                    <span className="absolute bottom-0 left-[3.25rem] right-0 h-px bg-[var(--color-border-subtle)]" />
                )}
            </>
        )}
    </NavLink>
));

SettingsNavItem.displayName = 'SettingsNavItem';

// ─── Selector colapsado para móvil ────────────────────────────────────────────
interface MobileNavTriggerProps {
    activeItem: NavItemDefinition | undefined;
    onClick: () => void;
}

const MobileNavTrigger = memo(({ activeItem, onClick }: MobileNavTriggerProps) => {
    const Icon = activeItem?.icon ?? ShieldCheck;

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] transition-colors active:bg-[var(--color-bg-secondary)]"
        >
            <div className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 bg-[var(--color-primary)] text-[var(--color-text-on-primary)]">
                <Icon size={15} strokeWidth={2} />
            </div>

            <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-semibold leading-none mb-0.5 truncate text-[var(--color-primary)]">
                    {activeItem?.label ?? 'Selecciona una opción'}
                </p>
                <p className="text-[11px] text-[var(--color-text-tertiary)] leading-none truncate">
                    {activeItem?.description ?? 'Elige una sección para configurar'}
                </p>
            </div>

            <ChevronDown
                size={16}
                strokeWidth={2}
                className="shrink-0 text-[var(--color-text-disabled)]"
            />
        </button>
    );
});

MobileNavTrigger.displayName = 'MobileNavTrigger';

// ─── Bottom Sheet para móvil ──────────────────────────────────────────────────
interface BottomSheetProps {
    open: boolean;
    onClose: () => void;
    activePath: string;
    onNavigate: (path: string) => void;
    groups: typeof NAV_GROUPS;
}

const BottomSheet = memo(({ open, onClose, activePath, onNavigate, groups }: BottomSheetProps) => {
    // Prevenir scroll del body cuando el sheet está abierto
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    return (
        <>
            {/* Overlay */}
            <div
                className={clsx(
                    'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden',
                    open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sheet */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Módulos de configuración"
                className={clsx(
                    'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
                    'bg-[var(--color-bg-primary)] rounded-t-2xl',
                    'max-h-[82dvh] overflow-y-auto overscroll-contain',
                    'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    open ? 'translate-y-0' : 'translate-y-full',
                )}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-9 h-1 rounded-full bg-[var(--color-border-subtle)]" />
                </div>

                {/* Cabecera */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                        Módulos
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                        aria-label="Cerrar"
                    >
                        <X size={13} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Grupos */}
                {groups.map((group) => (
                    <div key={group.groupLabel}>
                        <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">
                            {group.groupLabel}
                        </p>

                        <div className="mx-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden mb-1">
                            {group.items.map((item, idx) => {
                                const isActive = activePath === item.path;
                                const Icon = item.icon;
                                const isLast = idx === group.items.length - 1;

                                return (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        end
                                        onClick={() => {
                                            onNavigate(item.path);
                                            // Pequeño delay para que se vea la selección antes de cerrar
                                            setTimeout(onClose, 150);
                                        }}
                                        className={clsx(
                                            'flex items-center gap-3 px-4 py-3 relative transition-colors',
                                            isActive
                                                ? 'bg-[var(--color-primary)]/10'
                                                : 'bg-[var(--color-bg-primary)] active:bg-[var(--color-bg-secondary)]',
                                        )}
                                    >
                                        <div className={clsx(
                                            'w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0',
                                            isActive
                                                ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                                                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
                                        )}>
                                            <Icon size={15} strokeWidth={2} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={clsx(
                                                'text-[13px] font-semibold leading-none mb-0.5 truncate',
                                                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]',
                                            )}>
                                                {item.label}
                                            </p>
                                            <p className="text-[11px] text-[var(--color-text-tertiary)] leading-none truncate">
                                                {item.description}
                                            </p>
                                        </div>

                                        <ChevronRight
                                            size={14}
                                            strokeWidth={2}
                                            className={clsx(
                                                'shrink-0',
                                                isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-disabled)]',
                                            )}
                                        />

                                        {!isLast && (
                                            <span className="absolute bottom-0 left-[3.25rem] right-0 h-px bg-[var(--color-border-subtle)]" />
                                        )}
                                    </NavLink>
                                );
                            })}
                        </div>
                    </div>
                ))}

                {/* Espacio inferior para safe-area (notch/home bar) */}
                <div className="h-6" />
            </div>
        </>
    );
});

BottomSheet.displayName = 'BottomSheet';

// ─── Skeletons ────────────────────────────────────────────────────────────────
interface SettingsNavSkeletonProps {
    isCollapsed: boolean;
}

const SettingsNavSkeleton = memo(({ isCollapsed }: SettingsNavSkeletonProps) => {
    if (isCollapsed) {
        return (
            <div className="space-y-4 flex flex-col items-center py-2">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} circle width={32} height={32} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="px-1">
                <Skeleton width={120} height={22} />
            </div>

            <div>
                <Skeleton width={64} height={10} className="mb-2 mx-1" />
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden">
                    {[0, 1].map((i) => (
                        <div
                            key={i}
                            className={clsx(
                                'flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)]',
                                i === 0 && 'border-b border-[var(--color-border-subtle)]',
                            )}
                        >
                            <Skeleton circle width={32} height={32} className="shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton height={11} width="55%" />
                                <Skeleton height={9} width="38%" />
                            </div>
                            <Skeleton width={10} height={10} className="shrink-0" />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <Skeleton width={52} height={10} className="mb-2 mx-1" />
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className={clsx(
                                'flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)]',
                                i < 2 && 'border-b border-[var(--color-border-subtle)]',
                            )}
                        >
                            <Skeleton circle width={32} height={32} className="shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <Skeleton height={11} width="50%" />
                                <Skeleton height={9} width="35%" />
                            </div>
                            <Skeleton width={10} height={10} className="shrink-0" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

SettingsNavSkeleton.displayName = 'SettingsNavSkeleton';

const SettingsContentSkeleton = memo(() => (
    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] p-4 lg:p-6 min-h-[400px] space-y-6">
        <div className="space-y-2 pb-4 border-b border-[var(--color-border-subtle)]">
            <Skeleton height={18} width={160} />
            <Skeleton height={12} width={240} />
        </div>

        {[180, 220, 140, 200].map((_, i) => (
            <div key={i} className="space-y-2">
                <Skeleton height={10} width={80} />
                <Skeleton height={36} width="100%" />
            </div>
        ))}

        <div className="pt-2 flex justify-end">
            <Skeleton height={34} width={110} />
        </div>
    </div>
));

SettingsContentSkeleton.displayName = 'SettingsContentSkeleton';

// ─── SettingsPage principal ───────────────────────────────────────────────────
const SettingsPage = ({ isLoading = false }: { isLoading?: boolean }) => {
    const location = useLocation();
    const { has } = usePermissions();
    const [sheetOpen, setSheetOpen] = useState(false);

    // Estado para colapsar en desktop
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('settings_sidebar_collapsed') === 'true';
    });

    const toggleCollapse = useCallback(() => {
        setIsCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('settings_sidebar_collapsed', String(next));
            return next;
        });
    }, []);

    // Filtra los grupos y items según los permisos del usuario
    const filteredGroups = useMemo(() => {
        const canViewAll = has('settings.view') || has('settings.manage');
        return NAV_GROUPS.map(group => ({
            ...group,
            items: group.items.filter(item => {
                if (item.path === '/dashboard/configuracion/videos-display') {
                    return has('settings.manage') || has('settings.videos_view') || has('settings.videos_manage');
                }
                if (item.strictPermission && item.permission) {
                    return has(item.permission);
                }

                return !item.permission || canViewAll || has(item.permission);
            })
        })).filter(group => group.items.length > 0);
    }, [has]);

    // Lista plana de todos los items permitidos
    const allowedItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);

    const isRoot = location.pathname === '/dashboard/configuracion'
        || location.pathname === '/dashboard/configuracion/';

    // Busca el item activo según la ruta actual
    const activeItem = allowedItems.find((item) => location.pathname.startsWith(item.path));

    const openSheet = useCallback(() => setSheetOpen(true), []);
    const closeSheet = useCallback(() => setSheetOpen(false), []);

    return (
        <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-120px)]">

            {/* ── Selector colapsado — solo móvil ─────────────────────────── */}
            {!isLoading && (
                <div className="lg:hidden">
                    <MobileNavTrigger
                        activeItem={activeItem}
                        onClick={openSheet}
                    />
                </div>
            )}

            {/* Skeleton del selector en móvil */}
            {isLoading && (
                <div className="lg:hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border border-[var(--color-border-subtle)] rounded-[var(--radius-md)]">
                        <Skeleton circle width={32} height={32} className="shrink-0" />
                        <div className="flex-1 space-y-1.5">
                            <Skeleton height={11} width="45%" />
                            <Skeleton height={9} width="30%" />
                        </div>
                        <Skeleton width={14} height={14} className="shrink-0" />
                    </div>
                </div>
            )}

            {/* ── Sidebar desktop ──────────────────────────────────────────── */}
            <aside className={clsx(
                "hidden lg:block shrink-0 transition-[width] duration-300 ease-in-out relative",
                isCollapsed ? "lg:w-16" : "lg:w-60"
            )}>
                <div className="sticky top-16">
                    {/* Botón de contraer/expandir flotante — solo en desktop */}
                    {!isLoading && (
                        <button
                            type="button"
                            onClick={toggleCollapse}
                            className={clsx(
                                "absolute top-2 -right-3 z-10 flex items-center justify-center w-6 h-6 rounded-full",
                                "bg-[var(--color-primary)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary)]/90 shadow-[var(--shadow-sm)]",
                                "transition-all duration-[var(--transition-fast)] cursor-pointer"
                            )}
                            title={isCollapsed ? "Expandir menú de configuración" : "Contraer menú de configuración"}
                        >
                            {isCollapsed ? <ChevronRight size={12} strokeWidth={2.5} /> : <ChevronLeft size={12} strokeWidth={2.5} />}
                        </button>
                    )}

                    {isLoading ? (
                        <SettingsNavSkeleton isCollapsed={isCollapsed} />
                    ) : (
                        <div className="space-y-5">
                            {filteredGroups.map((group) => (
                                <div key={group.groupLabel}>
                                    {!isCollapsed ? (
                                        <p className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)] truncate">
                                            {group.groupLabel}
                                        </p>
                                    ) : (
                                        <div className="h-px bg-[var(--color-border-subtle)]/70 my-3 mx-2" />
                                    )}
                                    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] overflow-hidden">
                                        {group.items.map((item, idx) => (
                                            <SettingsNavItem
                                                key={item.path}
                                                {...item}
                                                isFirst={idx === 0}
                                                isLast={idx === group.items.length - 1}
                                                isCollapsed={isCollapsed}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </aside>

            {/* ── Área de contenido dinámica ───────────────────────────────── */}
            <main className="flex-1 min-w-0">
                {isLoading ? (
                    <SettingsContentSkeleton />
                ) : isRoot ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-24 px-8">
                        <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
                            <ShieldCheck size={26} className="text-[var(--color-text-tertiary)]" />
                        </div>
                        <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">
                            Selecciona una opción
                        </p>
                        <p className="text-[13px] text-[var(--color-text-tertiary)] max-w-xs">
                            Elige una sección del panel izquierdo para comenzar a configurar.
                        </p>
                    </div>
                ) : (
                    <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] p-4 lg:p-6 min-h-[400px]">
                        <Outlet />
                    </div>
                )}
            </main>

            {/* ── Bottom Sheet — solo móvil ────────────────────────────────── */}
            <BottomSheet
                open={sheetOpen}
                onClose={closeSheet}
                activePath={location.pathname}
                onNavigate={closeSheet}
                groups={filteredGroups}
            />
        </div>
    );
};

export default memo(SettingsPage);
