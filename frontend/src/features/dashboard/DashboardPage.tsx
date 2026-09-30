import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    RefreshCw,
} from 'lucide-react';

import usePermissions from '../../hooks/usePermissions';
import useAuthStore from '../../app/useAuthStore';
import useCoreStore from '../../app/useCoreStore';
import { useLandingPath } from '../../hooks/useLandingPath';
import iconoDashboard from '../../assets/img/Isotipo.webp';

/* ─── Helpers de Fecha y Saludo ─────────────────────────────────────────────── */
const getGreeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
};

const formatDate = (date: Date): string =>
    new Intl.DateTimeFormat('es-EC', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);

const formatTime = (date: Date): string =>
    new Intl.DateTimeFormat('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(date);


const DashboardPage = () => {
    const { has, isSuperuser } = usePermissions();
    const canView = isSuperuser || has('dashboard.view');
    const user = useAuthStore((s) => s.user);
    const selectedGroup = useAuthStore((s) => s.selectedGroup);
    const organization = useCoreStore((s) => s.organization);
    const fetchOrganization = useCoreStore((s) => s.fetchOrganization);
    const loadingOrg = useCoreStore((s) => s.loadingOrg);
    const landingPath = useLandingPath();
    const navigate = useNavigate();

    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // Reloj digital continuo
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Actualización manual de datos
    const handleRefresh = useCallback(async () => {
        try {
            await fetchOrganization();
        } catch (error) {
            console.error('Error al actualizar datos del dashboard:', error);
        }
    }, [fetchOrganization]);

    // Redirección si no tiene permisos
    useEffect(() => {
        if (!canView && landingPath !== '/dashboard') {
            navigate(landingPath, { replace: true });
        }
    }, [canView, landingPath, navigate]);

    if (!canView) {
        return null;
    }


    return (
        <div className="min-h-full space-y-4 p-3 md:p-5">
            {/* ── Encabezado Principal ── */}
            <div className="flex flex-col gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <img
                        src={iconoDashboard}
                        alt="Logo"
                        className="h-10 w-10 shrink-0 rounded-md object-contain"
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base font-bold text-[var(--color-text-primary)] md:text-lg">
                                {getGreeting()}, {user?.first_name || user?.username || 'Usuario'}
                            </h1>
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)] bg-[var(--color-tag-bg,#ecfdf5)]">
                                {selectedGroup?.name || 'Administrador'}
                            </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                            {formatDate(currentTime)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border-subtle)] pt-2 sm:border-0 sm:pt-0">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--color-text-primary)]">
                        <Clock className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                        <span>{formatTime(currentTime)}</span>
                    </div>

                    <button
                        onClick={handleRefresh}
                        disabled={loadingOrg}
                        className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
                        title="Actualizar datos"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingOrg ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refrescar</span>
                    </button>
                </div>
            </div>


            {/* ── Información del Entorno y Sistema ── */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* Tarjeta de Organización */}
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Datos de la Entidad
                    </h3>
                    <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Razón Social:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                {organization?.name || 'No configurada'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">RUC / Identificación:</span>
                            <span className="font-mono font-medium text-[var(--color-text-primary)]">
                                {organization?.ruc || 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Dirección:</span>
                            <span className="font-medium text-[var(--color-text-primary)] truncate max-w-[200px]">
                                {organization?.address || 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-tertiary)]">Contacto:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                {organization?.phone || organization?.email || 'N/A'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Tarjeta de Sesión Actual */}
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Sesión Activa
                    </h3>
                    <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Usuario:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                {user?.username} ({user?.first_name} {user?.last_name})
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Correo:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                {user?.email || 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Rol / Perfil:</span>
                            <span className="font-semibold text-[var(--color-primary)]">
                                {selectedGroup?.name || 'Administrador'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-tertiary)]">Autenticación 2FA:</span>
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {isSuperuser ? 'Superusuario' : 'Habilitado'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;