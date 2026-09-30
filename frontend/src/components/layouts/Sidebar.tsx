import { memo, useCallback, useState, useEffect, type ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { clsx } from 'clsx';
import { LogOut, ChevronLeft, ChevronRight, X, HelpCircle } from 'lucide-react';

import useAuthStore from '../../app/useAuthStore';
import useCoreStore from '../../app/useCoreStore';
import authService from '../../api/authService';
import { getImageUrl } from '../../utils/imageUtils';
import { useMenu } from '../../hooks/useMenu';
import { useSidebar } from '../../hooks/useSidebar';
import MenuItem from './MenuItem';
import type { Organization } from '../../app/types/core';
import defaultAppLogo from '../../assets/img/Isotipo.webp';

// ─── Resolución de icono ──────────────────────────────────────────────────────
const resolveIcon = (iconName: string): ElementType => {
    const iconMap = LucideIcons as unknown as Record<string, ElementType>;
    return iconMap[iconName] || HelpCircle;
};

// ─── OrgLogo Protegido contra click derecho y arrastre ────────────────────────
interface OrgLogoProps {
    organization: Organization | null;
    size?: 'sm' | 'lg';
}

const OrgLogo = memo(({ organization, size = 'sm' }: OrgLogoProps) => {
    const dim = size === 'lg' ? 'w-8 h-8' : 'w-7 h-7';
    const logoSrc = organization?.logo ? getImageUrl(organization.logo) : defaultAppLogo;

    return (
        <div
            className="relative inline-flex items-center justify-center shrink-0 select-none"
            onContextMenu={(e) => e.preventDefault()}
        >
            <img
                src={logoSrc}
                alt="Logo"
                className={clsx(dim, 'object-contain shrink-0 select-none pointer-events-none')}
                draggable={false}
            />
            {/* Capa protectora transparente */}
            <div
                className="absolute inset-0 z-10 bg-transparent select-none"
                aria-hidden="true"
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
            />
        </div>
    );
});
OrgLogo.displayName = 'OrgLogo';

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = () => {
    const navigate = useNavigate();
    const { menu } = useMenu();
    const { organization } = useCoreStore();
    const { logout } = useAuthStore();
    const { 
        isCollapsed: sidebarCollapsed, 
        toggleSidebar, 
        isMobileOpen,
        setMobileOpen
    } = useSidebar();

    const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const handleResize = () => {
            clearTimeout(timer);
            timer = setTimeout(() => setIsDesktop(window.innerWidth >= 1024), 100);
        };
        window.addEventListener('resize', handleResize, { passive: true });
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const isCollapsed = sidebarCollapsed && isDesktop;

    const handleLogout = useCallback(async () => {
        try {
            await authService.logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            logout();
            navigate('/login');
        }
    }, [logout, navigate]);

    const closeMobile = () => setMobileOpen(false);

    const orgDisplayName = organization?.name || 'GUIOS';

    return (
        <>
            {/* Overlay móvil */}
            <div
                className={clsx(
                    'fixed inset-0 bg-black/70 backdrop-blur-xs z-[60] lg:hidden transition-opacity duration-200',
                    isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                onClick={closeMobile}
                aria-hidden="true"
            />

            {/* Panel Principal del Sidebar */}
            <aside
                className={clsx(
                    // Base y Móvil: Panel off-canvas deslizable
                    'fixed inset-y-0 left-0 z-[70] flex flex-col bg-[var(--color-bg-primary)] select-none',
                    'border-r border-[var(--color-border-subtle)]',
                    'transition-all duration-300 ease-in-out overflow-hidden',
                    isMobileOpen
                        ? 'w-[240px] translate-x-0'
                        : 'w-[240px] -translate-x-full',
                    // Desktop: Isla flotante con espacio perimetral (top, bottom, izquierda y derecha)
                    'lg:static lg:translate-x-0 lg:h-full lg:shrink-0',
                    'lg:rounded-xl lg:border lg:border-[var(--color-border-subtle)] lg:shadow-xs',
                    isCollapsed ? 'lg:w-[68px]' : 'lg:w-[240px]'
                )}
            >
                {/* Cabecera / Logo */}
                <div
                    className={clsx(
                        'h-14 flex items-center px-4 shrink-0',
                        isCollapsed ? 'justify-center' : 'justify-between gap-2.5'
                    )}
                >
                    {isCollapsed ? (
                        <OrgLogo organization={organization} size="lg" />
                    ) : (
                        <>
                            <div className="flex items-center gap-2.5 min-w-0">
                                <OrgLogo organization={organization} size="sm" />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[12px] font-black truncate tracking-tight text-[var(--color-text-primary)]">
                                        {orgDisplayName}
                                    </span>
                                    {organization?.slogan && (
                                        <span className="text-[9px] font-medium truncate text-[var(--color-text-tertiary)] italic">
                                            {organization.slogan}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={closeMobile}
                                className="lg:hidden w-8 h-8 flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
                                aria-label="Cerrar menú"
                            >
                                <X size={18} />
                            </button>
                        </>
                    )}
                </div>

                {/* Navegación Modular */}
                <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden custom-scrollbar px-2.5 space-y-4">
                    {menu.map((group) => (
                        <div key={group.id} className="space-y-1">
                            {!isCollapsed && group.name && (
                                <div className="px-2.5 pt-2 pb-1">
                                    <h3 className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)] opacity-80">
                                        {group.name}
                                    </h3>
                                </div>
                            )}

                            <div className="space-y-0.5">
                                {group.modules.map((module) => (
                                    <MenuItem
                                        key={module.id}
                                        icon={resolveIcon(module.icon)}
                                        label={module.label}
                                        path={module.path}
                                        isCollapsed={isCollapsed}
                                        onClick={closeMobile}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Pie del Sidebar: Ocultar Panel & Cerrar Sesión */}
                <div className="p-2.5 border-t border-[var(--color-border-subtle)] space-y-1 shrink-0 bg-[var(--color-bg-primary)]">
                    {/* Toggle — solo en desktop */}
                    {isDesktop && (
                        <button
                            onClick={toggleSidebar}
                            className={clsx(
                                'hidden lg:flex items-center text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] rounded-[4px]',
                                isCollapsed ? 'w-full h-9 justify-center' : 'w-full gap-2.5 px-3 h-9'
                            )}
                            title={isCollapsed ? 'Expandir panel' : 'Contraer panel'}
                        >
                            {isCollapsed ? (
                                <ChevronRight size={16} />
                            ) : (
                                <>
                                    <ChevronLeft size={16} />
                                    <span className="text-[11px] font-semibold">Contraer panel</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Botón de Logout */}
                    <button
                        onClick={handleLogout}
                        className={clsx(
                            'flex items-center text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] transition-colors rounded-[4px] font-bold',
                            isCollapsed ? 'w-full h-9 justify-center' : 'w-full gap-2.5 px-3 h-9'
                        )}
                        title={isCollapsed ? 'Cerrar sesión' : undefined}
                    >
                        <LogOut size={16} />
                        {!isCollapsed && <span className="text-[11px] font-bold">Cerrar sesión</span>}
                    </button>
                </div>
            </aside>
        </>
    );
};

export default memo(Sidebar);