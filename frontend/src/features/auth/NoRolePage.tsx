import { useState, useCallback, useEffect, useMemo, memo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, LogOut, RefreshCw, Sun, Moon } from 'lucide-react';
import useAuthStore from '../../app/useAuthStore';
import useThemeStore from '../../app/useThemeStore';
import useToastStore from '../../app/useToastStore';
import authService from '../../api/authService';
import { getImageUrl } from '../../utils/imageUtils';
import Button from '../../components/ui/Button';
import isotipo from '../../assets/img/Isotipo.webp';

const containerVariants = {
    hidden:  { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
};

const NoRolePage = () => {
    const navigate = useNavigate();
    const { user, groups, setUser, setGroups, setRole, logout, isAuthenticated } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const addToast = useToastStore((s) => s.addToast);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const hasBypass = !!(user?.is_superuser || user?.is_staff);

    // Redirección defensiva
    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login', { replace: true });
        } else if (groups.length > 0 || hasBypass) {
            if (groups.length === 1) {
                setRole(groups[0]);
                navigate('/dashboard', { replace: true });
            } else if (groups.length > 1) {
                navigate('/select-role', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [isAuthenticated, groups, user, hasBypass, setRole, navigate]);

    const userInitials = useMemo(() => {
        if (!user) return '??';
        const first = user.first_name?.[0] || user.username?.[0] || '';
        const last  = user.last_name?.[0]  || '';
        return (first + last).toUpperCase();
    }, [user]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            const updatedUser = await authService.getCurrentUser();
            const updatedGroups = (updatedUser as unknown as { groups?: Array<{ id: number | string; name: string }> }).groups || [];
            
            setUser(updatedUser);
            setGroups(updatedGroups);

            if (updatedGroups.length > 0) {
                addToast({
                    type: 'success',
                    message: '¡Permisos actualizados! Redirigiendo...',
                });
                
                if (updatedGroups.length === 1) {
                    setRole(updatedGroups[0]);
                    navigate('/dashboard', { replace: true });
                } else {
                    navigate('/select-role', { replace: true });
                }
            } else {
                addToast({
                    type: 'info',
                    message: 'Tu cuenta aún no tiene roles asignados. Contacta al administrador.',
                });
            }
        } catch (error) {
            console.error('Error al sincronizar el perfil:', error);
            addToast({
                type: 'error',
                message: 'No se pudo actualizar el estado de tu cuenta.',
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, setUser, setGroups, setRole, navigate, addToast]);

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

    if (!isAuthenticated || groups.length > 0 || hasBypass) {
        return null;
    }

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
            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 w-full max-w-[440px] mx-auto">
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-full text-center space-y-6"
                >
                    {/* Icono de Alerta de Acceso */}
                    <div className="mx-auto w-14 h-14 rounded-[8px] bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 flex items-center justify-center">
                        <ShieldAlert className="text-[var(--color-warning-text)] size-7" />
                    </div>

                    {/* Identificación del Usuario */}
                    <div className="inline-flex items-center gap-2.5 bg-[var(--color-bg-secondary)] px-3.5 py-1.5 rounded-full border border-[var(--color-border-subtle)]">
                        <div className="relative w-5 h-5 rounded-full overflow-hidden bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                            {user?.avatar ? (
                                <img
                                    src={getImageUrl(user.avatar)}
                                    alt={user.username}
                                    draggable={false}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="w-full h-full object-cover select-none pointer-events-none"
                                />
                            ) : (
                                <span className="text-[9px] font-black text-[var(--color-primary)]">
                                    {userInitials}
                                </span>
                            )}
                            <div className="absolute inset-0 z-10 cursor-default" onContextMenu={(e) => e.preventDefault()} />
                        </div>
                        <span className="text-[12px] font-semibold text-[var(--color-text-secondary)]">
                            {user?.email}
                        </span>
                    </div>

                    {/* Título y Mensaje */}
                    <div className="space-y-2">
                        <h1 className="text-[26px] sm:text-[30px] font-black tracking-tight text-[var(--color-text-primary)]">
                            Sin rol asignado
                        </h1>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-sm mx-auto font-normal">
                            Tu identidad ha sido verificada, pero tu cuenta aún no tiene ningún perfil o grupo de trabajo asignado en la plataforma.
                        </p>
                    </div>

                    {/* Acciones */}
                    <div className="space-y-3 pt-2">
                        <Button
                            variant="primary"
                            icon={RefreshCw}
                            isLoading={isRefreshing}
                            onClick={handleRefresh}
                            className="w-full h-11 rounded-[4px] text-[13px] font-bold"
                        >
                            Comprobar permisos
                        </Button>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors cursor-pointer"
                            >
                                <LogOut size={13} />
                                <span>Cerrar sesión e ingresar con otra cuenta</span>
                            </button>
                        </div>
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

export default memo(NoRolePage);
