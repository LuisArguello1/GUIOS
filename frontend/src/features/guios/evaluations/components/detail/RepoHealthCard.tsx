/**
 * features/guios/evaluations/components/detail/RepoHealthCard.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tarjeta editorial de telemetría viva para repositorios GitHub / GitLab.
 * Muestra evidencia objetiva verificable (licencia OSI, actividad reciente,
 * último release, comunidad, bus factor y alertas de obsolescencia).
 */

import React, { memo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    ExternalLink,
    GitBranch,
    GitFork,
    RefreshCw,
    Scale,
    Star,
    Tag,
    Users,
} from 'lucide-react';
import { clsx } from 'clsx';

import Button from '../../../../../components/ui/Button';
import type { RepoHealthMetrics } from '../../../../../api/evaluationService';

interface RepoHealthCardProps {
    repoUrl?: string | null;
    metrics?: RepoHealthMetrics | null;
    onSync?: (customRepoUrl?: string) => Promise<void> | void;
    isSyncing?: boolean;
    allowEditUrl?: boolean;
    compact?: boolean;
}

const ACTIVITY_LABELS: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
    active: {
        label: 'Mantenimiento Activo',
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    },
    moderate: {
        label: 'Actividad Moderada',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
    },
    stale: {
        label: 'Sin Actividad Reciente',
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25',
    },
    archived: {
        label: 'Repositorio Archivado',
        dotClass: 'bg-rose-600',
        badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
    },
    unknown: {
        label: 'Sin dato temporal',
        dotClass: 'bg-zinc-400',
        badgeClass: 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]',
    },
};

function formatCompactNumber(value?: number | null): string {
    if (value === undefined || value === null) return '—';
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return String(value);
}

function formatDaysAgo(days?: number | null): string {
    if (days === undefined || days === null) return 'N/D';
    if (days === 0) return 'Hoy';
    if (days === 1) return 'Hace 1 día';
    if (days < 30) return `Hace ${days}d`;
    if (days < 365) return `Hace ${Math.floor(days / 30)}m`;
    return `Hace ${(days / 365).toFixed(1)}a`;
}

export const RepoHealthCard: React.FC<RepoHealthCardProps> = ({
    repoUrl,
    metrics,
    onSync,
    isSyncing = false,
    allowEditUrl = false,
    compact = false,
}) => {
    const [draftUrl, setDraftUrl] = useState<string>(repoUrl || '');
    const [showUrlInput, setShowUrlInput] = useState<boolean>(false);

    const isOk = metrics?.status === 'ok';
    const activity = ACTIVITY_LABELS[metrics?.activity_status || 'unknown'] || ACTIVITY_LABELS.unknown;
    const score = metrics?.health_score ?? 0;
    const scoreClass =
        score >= 80
            ? 'text-emerald-600 dark:text-emerald-400'
            : score >= 60
            ? 'text-[var(--color-text-primary)]'
            : score >= 40
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-rose-600 dark:text-rose-400';

    const handleTriggerSync = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!onSync) return;
        const target = showUrlInput ? draftUrl.trim() : undefined;
        await onSync(target || undefined);
        setShowUrlInput(false);
    };

    // Estado sin telemetría cargada aún o error/no compatible
    if (!isOk) {
        const statusMsg =
            metrics?.status === 'error'
                ? metrics.error_message
                : metrics?.status === 'unsupported'
                ? metrics.message
                : repoUrl
                ? 'Sincroniza el repositorio para extraer licencia OSI, últimos commits, releases y comunidad en tiempo real.'
                : 'Agrega la URL de GitHub o GitLab del software para auditar su vitalidad técnica real.';

        return (
            <div
                className={clsx(
                    'rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]',
                    compact ? 'px-3 py-2' : 'p-3.5 sm:p-4'
                )}
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <GitBranch size={14} className="text-[var(--color-text-secondary)] shrink-0" />
                        <div className="min-w-0">
                            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-[var(--color-text-primary)]">
                                Pulso Vivo de Repositorio (GitHub / GitLab)
                            </span>
                            <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-2xl">
                                {statusMsg}
                            </p>
                        </div>
                    </div>

                    {onSync && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {allowEditUrl && !showUrlInput && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowUrlInput(true)}
                                    className="text-[11px]"
                                >
                                    {repoUrl ? 'Cambiar URL' : 'Ingresar URL Repo'}
                                </Button>
                            )}
                            {(repoUrl || showUrlInput) && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    isLoading={isSyncing}
                                    onClick={() => handleTriggerSync()}
                                    className="text-[11px] inline-flex items-center gap-1"
                                >
                                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                                    <span>Auditar Repo</span>
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {showUrlInput && onSync && (
                    <form onSubmit={handleTriggerSync} className="mt-2 flex items-center gap-2">
                        <input
                            type="url"
                            value={draftUrl}
                            onChange={(e) => setDraftUrl(e.target.value)}
                            placeholder="https://github.com/organizacion/repositorio"
                            className="flex-1 h-8 px-2.5 text-xs rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-border-focus)]"
                            required
                        />
                        <Button type="submit" variant="primary" size="sm" isLoading={isSyncing}>
                            Sincronizar
                        </Button>
                    </form>
                )}
            </div>
        );
    }

    return (
        <div
            className={clsx(
                'rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]',
                compact ? 'px-3 py-2 space-y-2' : 'p-4 space-y-3 shadow-xs'
            )}
        >
            {/* Cabecera Editorial del Repositorio */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                <div className="flex items-center gap-2 min-w-0">
                    <GitBranch size={14} className="text-[var(--color-text-primary)] shrink-0" />
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                        {metrics.provider === 'gitlab' ? 'GitLab' : 'GitHub'}
                    </span>
                    <a
                        href={metrics.repo_url || repoUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono font-bold text-[var(--color-text-primary)] hover:text-[var(--color-primary)] inline-flex items-center gap-1 truncate"
                    >
                        <span className="truncate">{metrics.repo_full_name}</span>
                        <ExternalLink size={11} className="shrink-0 opacity-70" />
                    </a>
                    {metrics.primary_language && (
                        <span className="hidden sm:inline-block text-[10px] font-mono text-[var(--color-text-tertiary)]">
                            · {metrics.primary_language}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={clsx(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] border text-[10px] font-mono font-semibold',
                            activity.badgeClass
                        )}
                    >
                        <span className={clsx('w-1.5 h-1.5 rounded-full', activity.dotClass)} />
                        {activity.label}
                    </span>

                    <div className="inline-flex items-baseline gap-1 px-2 py-0.5 rounded-[3px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]">
                        <span className="text-[9px] font-mono uppercase text-[var(--color-text-tertiary)]">
                            Vitalidad
                        </span>
                        <span className={clsx('text-xs font-mono font-bold', scoreClass)}>
                            {score}/100
                        </span>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                            ({metrics.health_grade})
                        </span>
                    </div>

                    {onSync && (
                        <button
                            type="button"
                            onClick={() => handleTriggerSync()}
                            disabled={isSyncing}
                            title="Actualizar telemetría en vivo desde el repositorio"
                            className="p-1 rounded-[4px] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-page)] transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                        </button>
                    )}
                </div>
            </div>

            {/* Tira de Métricas Verificadas */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="px-2.5 py-1.5 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]/70">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--color-text-tertiary)]">
                        <Scale size={10} />
                        <span>Licencia OSI</span>
                    </div>
                    <div className="font-mono font-bold text-[var(--color-text-primary)] truncate mt-0.5">
                        {metrics.license_spdx || 'No declarada'}
                    </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]/70">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--color-text-tertiary)]">
                        <Activity size={10} />
                        <span>Último Push</span>
                    </div>
                    <div className="font-mono font-bold text-[var(--color-text-primary)] truncate mt-0.5">
                        {formatDaysAgo(metrics.days_since_last_push)}
                    </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]/70">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--color-text-tertiary)]">
                        <Tag size={10} />
                        <span>Últ. Release</span>
                    </div>
                    <div className="font-mono font-bold text-[var(--color-text-primary)] truncate mt-0.5">
                        {metrics.latest_release?.tag_name || 'Sin release'}
                    </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]/70">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--color-text-tertiary)]">
                        <Star size={10} />
                        <span>Adopción</span>
                    </div>
                    <div className="font-mono font-bold text-[var(--color-text-primary)] truncate mt-0.5 inline-flex items-center gap-1.5">
                        <span>{formatCompactNumber(metrics.stars)} ★</span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-normal inline-flex items-center gap-0.5">
                            <GitFork size={9} />
                            {formatCompactNumber(metrics.forks)}
                        </span>
                    </div>
                </div>

                <div className="px-2.5 py-1.5 rounded-[4px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)]/70 col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--color-text-tertiary)]">
                        <Users size={10} />
                        <span>Comunidad</span>
                    </div>
                    <div className="font-mono font-bold text-[var(--color-text-primary)] truncate mt-0.5">
                        {metrics.contributors_count !== null && metrics.contributors_count !== undefined
                            ? `${metrics.contributors_count} contrib.`
                            : `${formatCompactNumber(metrics.open_issues)} issues`}
                    </div>
                </div>
            </div>

            {/* Alertas Técnicas Objetivas (si existen y no es ultra-compacto) */}
            {!compact && metrics.alerts && metrics.alerts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {metrics.alerts.map((alert, idx) => (
                        <div
                            key={idx}
                            className={clsx(
                                'inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-[11px] border',
                                alert.level === 'danger'
                                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                                    : alert.level === 'warning'
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25'
                                    : 'bg-[var(--color-bg-page)] text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]'
                            )}
                        >
                            <AlertTriangle size={11} className="shrink-0" />
                            <span>{alert.message}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default memo(RepoHealthCard);
