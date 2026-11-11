import { useCallback, memo, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../../app/useAuthStore';
import useThemeStore from '../../app/useThemeStore';
import useCoreStore from '../../app/useCoreStore';
import { UserCog, Users, MonitorDot, LogOut, Sun, Moon, ArrowRight } from 'lucide-react';
import authService from '../../api/authService';
import { getImageUrl } from '../../utils/imageUtils';
import isotipo from '../../assets/img/Isotipo.webp';

const containerVariants = {
    hidden:  { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25, staggerChildren: 0.06 } },
};

const cardVariants = {
    hidden:  { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

const getRoleData = (name: string) => {
    const r = (name || '').toLowerCase();
    if (r.includes('admin') || r.includes('gerencia') || r.includes('administrador'))
        return { Icon: UserCog, description: 'Administración y gestión global del sistema' };
    if (r.includes('atencion') || r.includes('modulo'))
        return { Icon: Users, description: 'Atención directa y gestión de turnos' };
    if (r.includes('pantalla') || r.includes('visor'))
        return { Icon: MonitorDot, description: 'Pantalla pública y visualizador de turnos' };
    return { Icon: UserCog, description: 'Acceso a módulos autorizados' };
};

const RoleSelectionPage = () => {
    const navigate = useNavigate();
    const { user, groups, setRole, logout } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();

    useEffect(() => {
        const hasBypass = user?.is_superuser || user?.is_staff;
        if (groups.length === 0 && !hasBypass) {
            navigate('/no-role', { replace: true });
        }
    }, [groups, user, navigate]);

    type RoleGroup = (typeof groups)[number];

    const userInitials = useMemo(() => {
        if (!user) return '??';
        const first = user.first_name?.[0] || user.username?.[0] || '';
        const last  = user.last_name?.[0]  || '';
        return (first + last).toUpperCase();
    }, [user]);

    const handleSelectRole = useCallback((group: RoleGroup) => {
        setRole(group);
        void useCoreStore.getState().fetchMenu({ force: true, roleId: group.id });
        navigate('/dashboard');
    }, [setRole, navigate]);

    const handleLogout = useCallback(async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.warn('Logout remoto falló, continuando con logout local.', error);
        } finally {
            logout();
            navigate('/login');
        }
    }, [logout, navigate]);

    return (
        <div className="min-h-screen w-full flex flex-col justify-between bg-[var(--color-bg-page)] text-[var(--color-text-primary)] transition-colors duration-200 select-none">
            {/* ════════════════════════════════════════
                1. HEADER SUPERIOR TIKTOK STYLE
            ════════════════════════════════════════ */}
            <header className="w-full flex items-center justify-between px-6 sm:px-10 py-4 h-16 shrink-0">
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="relative h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center">
                        <img
                            src={isotipo}
                            alt="GUIOS Logo"
                            className="h-full w-full object-contain select-none transition-transform group-hover:scale-105 pointer-events-none"
                            draggable={false}
                            onContextMenu={(e) => e.preventDefault()}
                        />
                        <div
                            className="absolute inset-0 z-10 cursor-pointer"
                            onContextMenu={(e) => e.preventDefault()}
                        />
                    </div>
                    <span className="text-[17px] sm:text-[19px] font-black tracking-tight text-[var(--color-text-primary)] select-none">
                        GUIOS
                    </span>
                </Link>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={toggleTheme}
                        className="flex items-center justify-center w-8 h-8 rounded-[4px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
                        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    >
                        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                </div>
            </header>

            {/* ════════════════════════════════════════
                2. CONTENIDO PRINCIPAL CENTRADO
            ════════════════════════════════════════ */}
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 w-full max-w-[560px] mx-auto">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-full space-y-6"
                >
                    {/* Tarjeta de Usuario Identificado */}
                    <div className="flex items-center justify-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] flex items-center justify-center shrink-0">
                            {user?.avatar ? (
                                <img
                                    src={getImageUrl(user.avatar)}
                                    alt={user.username}
                                    draggable={false}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="w-full h-full object-cover select-none pointer-events-none"
                                />
                            ) : (
                                <span className="text-[13px] font-black tracking-tight text-[var(--color-primary)]">
                                    {userInitials}
                                </span>
                            )}
                            <div className="absolute inset-0 z-10 cursor-default" onContextMenu={(e) => e.preventDefault()} />
                        </div>
                        <div className="text-left">
                            <p className="text-[13px] font-bold text-[var(--color-text-primary)] leading-tight">
                                {user?.first_name || user?.username}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] font-medium">
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    {/* Título Principal y Subtítulo */}
                    <div className="text-center space-y-1.5">
                        <h1 className="text-[28px] sm:text-[32px] font-black tracking-tight text-[var(--color-text-primary)]">
                            Selecciona tu rol
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-normal">
                            Tu cuenta tiene múltiples roles asignados. Elige el área de trabajo a la que deseas acceder.
                        </p>
                    </div>

                    {/* Lista de Roles */}
                    <div className="space-y-2.5 pt-2">
                        {groups.map((group) => {
                            const { Icon, description } = getRoleData(group.name);
                            return (
                                <motion.button
                                    key={group.id}
                                    variants={cardVariants}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    onClick={() => handleSelectRole(group)}
                                    className="group w-full flex items-center justify-between p-4 rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]/60 transition-all duration-150 cursor-pointer shadow-xs text-left"
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="w-10 h-10 rounded-[6px] bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-primary)]/10 transition-colors">
                                            <Icon
                                                size={20}
                                                strokeWidth={2}
                                                className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors"
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[14px] font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors truncate">
                                                {group.name}
                                            </p>
                                            <p className="text-[11.5px] text-[var(--color-text-tertiary)] truncate font-normal">
                                                {description}
                                            </p>
                                        </div>
                                    </div>

                                    <ArrowRight
                                        size={16}
                                        className="text-[var(--color-text-disabled)] group-hover:text-[var(--color-primary)] group-hover:translate-x-0.5 transition-all shrink-0 ml-3"
                                    />
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Cerrar Sesión */}
                    <div className="text-center pt-3">
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                        >
                            <LogOut size={13} />
                            <span>Cerrar sesión e ingresar con otra cuenta</span>
                        </button>
                    </div>
                </motion.div>
            </main>

            {/* ════════════════════════════════════════
                3. FOOTER INFERIOR OFICIAL
            ════════════════════════════════════════ */}
            <footer className="w-full bg-[var(--color-bg-page)] border-t border-[var(--color-border-subtle)] px-6 sm:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-text-tertiary)]">
                <div>
                    <span>¿Necesitas ayuda con tus accesos? </span>
                    <a href="mailto:soporte@guios.com" className="text-[var(--color-primary)] font-bold hover:underline">
                        Contactar a Soporte
                    </a>
                </div>
                <div className="font-medium text-center sm:text-right">
                    © {new Date().getFullYear()} GUIOS
                </div>
            </footer>
        </div>
    );
};

export default memo(RoleSelectionPage);