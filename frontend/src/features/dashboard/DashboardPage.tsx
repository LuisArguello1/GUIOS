/**
 * frontend/src/features/dashboard/DashboardPage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Panel Principal del Sistema GUIOS — Metodología de Adopción de Software Libre.
 * Proporciona:
 * 1. KPIs ejecutivos de cartera, viabilidad y desempeño de IA.
 * 2. Visualización analítica interactiva (Recharts: Donut A/B/C, Dimensiones y FODA).
 * 3. Exportación de informes analíticos consolidados en PDF y Excel protegidos por RBAC.
 * 4. Cartera de software candidato con descarga individual de expedientes técnicos.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Clock,
    RefreshCw,
    FileDown,
    FileSpreadsheet,
    Shield,
} from 'lucide-react';

import usePermissions from '../../hooks/usePermissions';
import useAuthStore from '../../app/useAuthStore';
import useCoreStore from '../../app/useCoreStore';
import { useLandingPath } from '../../hooks/useLandingPath';
import useDashboardStats from '../../hooks/useDashboardStats';
import iconoDashboard from '../../assets/img/Isotipo.webp';

import DashboardKpiCards from './components/DashboardKpiCards';
import AdoptionVerdictDonut from './components/AdoptionVerdictDonut';
import DimensionRadarChart from './components/DimensionRadarChart';
import FodaBalanceWidget from './components/FodaBalanceWidget';
import TopSoftwareTable from './components/TopSoftwareTable';
import Loading from '../../components/ui/Loading';

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
    const canExport = isSuperuser || has('dashboard.export_report');

    const user = useAuthStore((s) => s.user);
    const selectedGroup = useAuthStore((s) => s.selectedGroup);
    const organization = useCoreStore((s) => s.organization);
    const fetchOrganization = useCoreStore((s) => s.fetchOrganization);
    const loadingOrg = useCoreStore((s) => s.loadingOrg);

    const landingPath = useLandingPath();
    const navigate = useNavigate();

    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // Hook analítico de estadísticas y reportes
    const {
        stats,
        loading: loadingStats,
        fetchStats,
        exportPdf,
        exportExcel,
        isExportingPdf,
        isExportingExcel,
    } = useDashboardStats(canView);

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
            await Promise.all([fetchOrganization(), fetchStats()]);
        } catch (error) {
            console.error('Error al actualizar datos del dashboard:', error);
        }
    }, [fetchOrganization, fetchStats]);

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
        <div className="min-h-full space-y-4 p-3 md:p-5 select-none">
            {/* ── 1. Encabezado Principal y Barra de Acciones ── */}
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

                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-subtle)] pt-2 sm:border-0 sm:pt-0">
                    <div className="hidden lg:flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--color-text-primary)] mr-2">
                        <Clock className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                        <span>{formatTime(currentTime)}</span>
                    </div>

                    {/* Botones de Descarga de Reportes (Gated por dashboard.export_report) */}
                    {canExport && (
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => void exportPdf()}
                                disabled={isExportingPdf || loadingStats}
                                className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
                                title="Descargar Reporte Ejecutivo en PDF"
                            >
                                <FileDown className="h-3.5 w-3.5 text-rose-500" />
                                <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
                            </button>

                            <button
                                onClick={() => void exportExcel()}
                                disabled={isExportingExcel || loadingStats}
                                className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] transition hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-50"
                                title="Descargar Libro Analítico en Excel"
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{isExportingExcel ? 'Generando Excel...' : 'Descargar Excel'}</span>
                            </button>
                        </div>
                    )}

                    <button
                        onClick={handleRefresh}
                        disabled={loadingOrg || loadingStats}
                        className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-tertiary)] disabled:opacity-50"
                        title="Actualizar datos"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${(loadingOrg || loadingStats) ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refrescar</span>
                    </button>
                </div>
            </div>

            {loadingStats && !stats ? (
                <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-8">
                    <Loading label="Calculando indicadores consolidados de GUIOS..." />
                </div>
            ) : stats ? (
                <>
                    {/* ── 2. Cuadrícula de KPIs Estratégicos ── */}
                    <DashboardKpiCards kpis={stats.kpis} />

                    {/* ── 3. Gráficos Analíticos de Adopción FLOSS ── */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        {/* Donut de Veredictos (A / B / C) */}
                        <div className="lg:col-span-1">
                            <AdoptionVerdictDonut
                                data={stats.verdict_distribution}
                                totalWithVerdict={stats.kpis.total_with_verdict}
                            />
                        </div>

                        {/* Comparativo de Rendimiento por Dimensión */}
                        <div className="lg:col-span-1">
                            <DimensionRadarChart data={stats.dimension_averages} />
                        </div>

                        {/* Balance Estratégico FODA */}
                        <div className="lg:col-span-1">
                            <FodaBalanceWidget
                                data={stats.foda_distribution}
                                fodaRatio={stats.kpis.foda_ratio}
                                totalStrengths={stats.kpis.foda_strengths}
                                totalWeaknesses={stats.kpis.foda_weaknesses}
                            />
                        </div>
                    </div>

                    {/* ── 4. Cartera de Software con Descarga Directa de Expedientes ── */}
                    <TopSoftwareTable items={stats.top_software} />
                </>
            ) : null}

            {/* ── 5. Información del Entorno Institucional y Sesión ── */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* Entidad Organizacional */}
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Entidad Evaluadora
                    </h3>
                    <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Razón Social:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                {organization?.name || 'Universidad Estatal de Milagro'}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">RUC / Identificación:</span>
                            <span className="font-mono font-medium text-[var(--color-text-primary)]">
                                {organization?.ruc || '0968533430001'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-tertiary)]">Sector Operativo:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                Educación Superior / TI Pública
                            </span>
                        </div>
                    </div>
                </div>

                {/* Sesión y Seguridad */}
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        Sesión y Credenciales Activas
                    </h3>
                    <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Usuario Operador:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                                {user?.username} ({user?.first_name} {user?.last_name})
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-[var(--color-border-subtle)] pb-1.5">
                            <span className="text-[var(--color-text-tertiary)]">Rol Asignado:</span>
                            <span className="font-semibold text-[var(--color-primary)]">
                                {selectedGroup?.name || 'Administrador'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--color-text-tertiary)]">Privilegio de Reportería:</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <Shield className="h-3 w-3" />
                                {canExport ? 'Habilitado (PDF/Excel)' : 'Solo Visualización'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;