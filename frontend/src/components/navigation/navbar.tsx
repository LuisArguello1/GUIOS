import { memo, useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRightLeft,
    LogOut,
    Menu as MenuIcon,
    Moon,
    Sun,
    User as UserIcon,
    UserCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

import { useSidebar } from '../../hooks/useSidebar';
import useAuthStore from '../../app/useAuthStore';
import authService from '../../api/authService';
import useThemeStore from '../../app/useThemeStore';
import { getImageUrl } from '../../utils/imageUtils';

interface NavbarProps {
    title?: string;
}

interface UserAvatarProps {
    avatar?: string | null;
    alt: string;
    className?: string;
}

const HEADER_NAME_MAP: Record<string, string> = {
    dashboard: 'Panel Principal',
    perfil: 'Mi Perfil',
    configuracion: 'Configuración',
    organizacion: 'Organización',
    permisos: 'Roles y Permisos',
    usuarios: 'Usuarios',
    users: 'Usuarios',
    auditoria: 'Auditoría',
    menu: 'Menú del Sistema',
};

const isIdentifierSegment = (segment: string) =>
    /^\d+$/.test(segment)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment);

const toDisplayName = (segment: string) => {
    const mapped = HEADER_NAME_MAP[segment.toLowerCase()];
    if (mapped) return mapped;
    return segment
        .split('-')
        .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : part))
        .join(' ');
};

const UserAvatar = memo(({ avatar, alt, className = '' }: UserAvatarProps) => {
    const avatarUrl = useMemo(() => (avatar ? getImageUrl(avatar) : null), [avatar]);

    return (
        <div
            className={clsx(
                'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[var(--color-primary)]',
                className,
            )}
        >
            {avatarUrl ? (
                <img src={avatarUrl} alt={alt} className="h-full w-full object-cover" loading="lazy" />
            ) : (
                <UserIcon size={16} />
            )}
        </div>
    );
});
UserAvatar.displayName = 'UserAvatar';

const Navbar = ({ title }: NavbarProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toggleMobile } = useSidebar();
    const { user, logout, selectedGroup, groups } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();

    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const hasMultipleRoles = (groups?.length || 0) > 1 || (user?.is_superuser && (groups?.length || 0) > 0);

    const pageTitle = useMemo(() => {
        if (title) return title;
        const segments = location.pathname
            .split('/')
            .filter(Boolean)
            .filter((segment) => !isIdentifierSegment(segment));

        if (segments.length === 0) return 'Panel Principal';
        return toDisplayName(segments[segments.length - 1]);
    }, [location.pathname, title]);

    const userDisplayName = useMemo(() => {
        const first = user?.first_name?.trim() || '';
        const last = user?.last_name?.trim() || '';
        const full = `${first} ${last}`.trim();
        return full || user?.username || 'Usuario';
    }, [user?.first_name, user?.last_name, user?.username]);

    const roleLabel = selectedGroup?.name || (user?.is_superuser ? 'Superadministrador' : 'Usuario');
    const emailLabel = user?.email || 'Sin correo registrado';

    useEffect(() => {
        if (!isProfileOpen) return undefined;

        const handleWindowKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsProfileOpen(false);
            }
        };

        window.addEventListener('keydown', handleWindowKeyDown);
        return () => window.removeEventListener('keydown', handleWindowKeyDown);
    }, [isProfileOpen]);

    const handleToggleProfile = useCallback(() => setIsProfileOpen((prev) => !prev), []);
    const handleCloseProfile = useCallback(() => setIsProfileOpen(false), []);

    const handleProfileKeyDown = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsProfileOpen((prev) => !prev);
        }
    }, []);

    const handleSwitchRole = useCallback(() => {
        setIsProfileOpen(false);
        navigate('/select-role');
    }, [navigate]);

    const handleLogout = useCallback(async () => {
        setIsProfileOpen(false);
        try {
            await authService.logout();
        } catch (err) {
            const error = err as { response?: { status?: number } };
            if (error?.response?.status !== 401) {
                console.error('Logout error:', err);
            }
        } finally {
            logout();
            navigate('/login');
        }
    }, [logout, navigate]);

    return (
        <header className="sticky top-0 z-30 shrink-0 bg-[var(--color-bg-page)]/85 backdrop-blur-md transition-colors duration-200 lg:rounded-t-xs">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-6">
                {/* Lado Izquierdo: Botón Menú Móvil + Título de Página */}
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        onClick={toggleMobile}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] lg:hidden"
                        aria-label="Abrir menú"
                    >
                        <MenuIcon size={18} />
                    </button>

                    <div className="min-w-0">
                        <p className="hidden text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-primary)] sm:block">
                            GUIOS
                        </p>
                        <h1 className="truncate text-[13px] sm:text-[14px] font-black tracking-tight text-[var(--color-text-primary)]">
                            {pageTitle}
                        </h1>
                    </div>
                </div>

                {/* Lado Derecho: Tema + Menú de Perfil */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Botón de Alternancia de Tema */}
                    <button
                        onClick={toggleTheme}
                        className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                        aria-label="Alternar tema"
                        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                    </button>

                    {/* Menú de Perfil de Usuario */}
                    <div className="relative">
                        <button
                            onClick={handleToggleProfile}
                            onKeyDown={handleProfileKeyDown}
                            className={clsx(
                                'group flex items-center gap-2.5 p-1 rounded-[4px] sm:rounded-[6px] transition-all duration-150',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40',
                                isProfileOpen
                                    ? 'bg-[var(--color-bg-secondary)] ring-1 ring-[var(--color-primary)]/50'
                                    : 'hover:bg-[var(--color-bg-secondary)]',
                            )}
                            aria-expanded={isProfileOpen}
                            aria-haspopup="menu"
                            aria-label="Abrir menú de perfil"
                        >
                            <div className="hidden min-w-0 text-right sm:block pl-2">
                                <p className="truncate text-[12px] font-bold leading-tight text-[var(--color-text-primary)]">
                                    {userDisplayName}
                                </p>
                                <p className="truncate text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                                    {roleLabel}
                                </p>
                            </div>
                            <UserAvatar avatar={user?.avatar} alt={userDisplayName} />
                        </button>

                        <AnimatePresence>
                            {isProfileOpen && (
                                <>
                                    <button
                                        type="button"
                                        className="fixed inset-0 z-10 h-full w-full cursor-default"
                                        onClick={handleCloseProfile}
                                        aria-label="Cerrar menú de perfil"
                                    />

                                    <motion.div
                                        role="menu"
                                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                        transition={{ duration: 0.15, ease: 'easeOut' }}
                                        className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] shadow-xl"
                                    >
                                        {/* Cabecera del Dropdown */}
                                        <div className="flex items-center gap-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/60 px-4 py-3.5">
                                            <UserAvatar avatar={user?.avatar} alt={userDisplayName} className="h-10 w-10" />
                                            <div className="min-w-0">
                                                <p className="truncate text-[13px] font-bold text-[var(--color-text-primary)]">
                                                    {userDisplayName}
                                                </p>
                                                <p className="truncate text-[11px] text-[var(--color-text-tertiary)]">
                                                    {emailLabel}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Opciones de Navegación */}
                                        <div className="p-1.5 space-y-0.5">
                                            <Link
                                                to="/dashboard/perfil"
                                                onClick={handleCloseProfile}
                                                className="flex items-center gap-2.5 rounded-[4px] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                                                role="menuitem"
                                            >
                                                <UserCircle size={16} />
                                                <span>Mi Perfil</span>
                                            </Link>

                                            {hasMultipleRoles && (
                                                <button
                                                    onClick={handleSwitchRole}
                                                    className="flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                                                    role="menuitem"
                                                >
                                                    <ArrowRightLeft size={16} />
                                                    <span>Cambiar Rol</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Cerrar Sesión */}
                                        <div className="border-t border-[var(--color-border-subtle)] p-1.5">
                                            <button
                                                onClick={handleLogout}
                                                className="flex w-full items-center gap-2.5 rounded-[4px] px-3 py-2 text-left text-[12px] font-bold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                                                role="menuitem"
                                            >
                                                <LogOut size={16} />
                                                <span>Cerrar Sesión</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default memo(Navbar);
