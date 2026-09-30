import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Activity, Search, RefreshCw, HelpCircle, User as UserIcon, Calendar, Database
} from 'lucide-react';
import { clsx } from 'clsx';

import Table, { type TableColumn } from '../../components/ui/Table';
import Pagination from '../../components/ui/Pagination';
import GenericHelpModal from '../../components/ui/GenericHelpModal';
import AccessDenied from '../../components/ui/AccessDenied';
import { DetailActionButton } from '../../components/ui/ActionIconButtons';

import auditService, { type AuditModelOption } from '../../api/auditService';

import useToastStore from '../../app/useToastStore';
import usePermissions from '../../hooks/usePermissions';
import type { AuditLog } from '../../app/useAuditStore';
import DetailPanel from './components/DetailPanel';
import { hasShortSearchTerm, normalizeSearchTerm } from '../../utils/search';

export default function AuditPage() {
    const { addToast } = useToastStore();
    const { has } = usePermissions();
    const canViewAudit = has('audit.view');

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [modelFilter, setModelFilter] = useState('');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const itemsPerPage = 20;

    // Modals & Panels state
    const [availableModels, setAvailableModels] = useState<AuditModelOption[]>([]);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const hasShortSearchInput = useMemo(() => hasShortSearchTerm(searchInput), [searchInput]);

    const fetchData = useCallback(async (page = 1) => {
        setIsLoading(true);

        setCurrentPage(page);
        try {
            const [logsData] = await Promise.all([
                auditService.getAll({
                    page,
                    search: searchTerm || undefined,
                    model_name: modelFilter
                }),
                new Promise(resolve => setTimeout(resolve, 500))
            ]);

            if (logsData.results) {
                setLogs(logsData.results);
                setTotalItems(logsData.count ?? logsData.results.length);
            } else {
                const arr = Array.isArray(logsData) ? (logsData as unknown as AuditLog[]) : [];
                setLogs(arr);
                setTotalItems(arr.length);
            }
        } catch (error: unknown) {
            const msg =
                typeof error === 'object' &&
                    error !== null &&
                    'response' in error &&
                    typeof (error as { response?: unknown }).response === 'object'
                    ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            addToast({ type: 'error', message: msg || 'Error al cargar los logs de auditoría.' });
        } finally {
            setIsLoading(false);
        }
    }, [searchTerm, modelFilter, addToast]);

    // Carga de modelos una sola vez
    useEffect(() => {
        if (canViewAudit) {
            auditService.getModels()
                .then(setAvailableModels)
                .catch(() => addToast({ type: 'error', message: 'No se pudo obtener la lista de tablas.' }));
        }
    }, [canViewAudit, addToast]);

    // Fetch reactivo a los cambios de filtros (debounced o disparado por dependencias)
    useEffect(() => {
        if (canViewAudit) {
            const t = setTimeout(() => fetchData(1), 0);
            return () => clearTimeout(t);
        }
    }, [fetchData, canViewAudit]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const normalized = normalizeSearchTerm(searchInput) ?? '';
            setSearchTerm((current) => (current === normalized ? current : normalized));
        }, 300);

        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value);
    };

    const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setSearchTerm(normalizeSearchTerm(searchInput) ?? '');
        }
    };

    const handleModelFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setModelFilter(e.target.value);
    };

    const handleOpenDetail = (log: AuditLog) => {
        setSelectedLog(log);
        setIsPanelOpen(true);
    };

    if (!canViewAudit) {
        return <AccessDenied />;
    }

    const columns: TableColumn<AuditLog>[] = [
        {
            header: 'Fecha y Hora',
            accessor: 'timestamp',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-[var(--color-text-disabled)]" />
                    <span>{new Date(row.timestamp).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
            )
        },
        {
            header: 'Usuario',
            accessor: 'user_email',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                        <UserIcon size={11} className="text-[var(--color-primary)]" />
                    </div>
                    <span className="font-medium text-[var(--color-text-secondary)]">
                        {row.user_email || 'Sistema (Ninguno)'}
                    </span>
                </div>
            )
        },
        {
            header: 'Acción',
            accessor: 'action',
            render: (row) => {
                const actionColors: Record<string, string> = {
                    'CREATE': 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20',
                    'UPDATE': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                    'DELETE': 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20',
                    'RESTORE': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                    'EXPORT': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                };
                return (
                    <span className={clsx(
                        'px-2.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-bold tracking-wide border',
                        actionColors[row.action] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    )}>
                        {row.action_display}
                    </span>
                );
            }
        },
        {
            header: 'Origen',
            accessor: 'source',
            render: (row) => (
                <span className="text-[10px] font-mono text-[var(--color-text-tertiary)] uppercase">{row.source_display}</span>
            )
        },
        {
            header: 'Módulo Afectado',
            accessor: 'model_name',
            render: (row) => (
                <div className="flex items-center gap-2">
                    <Database size={13} className="text-[var(--color-text-tertiary)]" />
                    <span className="text-[var(--color-text-secondary)] font-mono text-[12px]">{row.model_name} <span className="text-[var(--color-text-disabled)] text-[10px]">#{row.object_id}</span></span>
                </div>
            )
        },
        {
            header: 'Detalle',
            align: 'right',
            render: (row) => (
                <div className="flex items-center justify-end">
                    <DetailActionButton onClick={(e) => { e.stopPropagation(); handleOpenDetail(row); }} disabled={false} />
                </div>
            )
        }
    ];

    return (
        <div className="h-full flex flex-col p-4 md:p-6 pb-24 md:pb-6 overflow-hidden">
            <header className="mb-6 flex flex-col gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-[var(--color-primary)]/10 flex items-center justify-center border border-[var(--color-primary)]/20 shadow-sm">
                        <Activity className="text-[var(--color-primary)]" size={20} />
                    </div>
                    <div>
                        <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)] tracking-tight leading-tight">
                            Registro de Auditoría
                        </h1>
                        <p className="text-[13px] text-[var(--color-text-secondary)]">
                            Explora la trazabilidad del sistema interactuando con los logs de eventos.
                        </p>
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
                            placeholder="Buscar usuario... (min. 3 letras)"
                            value={searchInput}
                            onChange={handleSearch}
                            onKeyDown={handleSearchKey}
                            className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[13px] text-[var(--color-text-primary)] font-medium placeholder:text-[var(--color-text-disabled)] placeholder:font-normal focus:outline-none focus:border-[var(--color-primary)] transition-all"
                        />
                        {hasShortSearchInput && (
                            <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                                Escribe al menos 3 letras para buscar.
                            </p>
                        )}
                    </div>

                    {/* Filtro por Modelo */}
                    <select
                        className="h-9 px-3 rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] text-[13px] text-[var(--color-text-secondary)] font-medium focus:outline-none focus:border-[var(--color-primary)] transition-all cursor-pointer w-[180px]"
                        value={modelFilter}
                        onChange={handleModelFilter}
                    >
                        <option value="">Todos los módulos</option>
                        {availableModels.map((model) => (
                            <option key={model.value} value={model.value}>
                                {model.label}
                            </option>
                        ))}
                    </select>

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
                </div>
            </header>

            <main className="flex-1 min-h-0 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-xl)] flex flex-col shadow-[var(--shadow-sm)] overflow-hidden">
                <div className="flex-1 overflow-auto p-4 md:p-0">
                    {/* ── Mobile Cards (< md) ─────────────────────────────────── */}
                    <div className="md:hidden space-y-3">
                        {/* Skeleton mobile */}
                        {isLoading && Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 space-y-3 animate-pulse"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="h-4 w-24 bg-[var(--color-bg-secondary)] rounded" />
                                    <div className="h-5 w-16 bg-[var(--color-bg-secondary)] rounded-full" />
                                </div>
                                <div className="h-4 w-1/2 bg-[var(--color-bg-secondary)] rounded" />
                                <div className="h-3 w-3/4 bg-[var(--color-bg-secondary)] rounded pt-2" />
                            </div>
                        ))}

                        {/* Empty state mobile */}
                        {!isLoading && logs.length === 0 && (
                            <div className="py-10 text-center text-[11px] text-[var(--color-text-disabled)] uppercase tracking-widest">
                                {searchTerm || modelFilter ? 'No se encontraron registros de auditoría.' : 'No hay registros de auditoría.'}
                            </div>
                        )}

                        {/* Cards */}
                        {!isLoading && logs.map((log) => (
                            <div
                                key={log.id}
                                onClick={() => handleOpenDetail(log)}
                                className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 space-y-3 cursor-pointer hover:border-[var(--color-border-focus)] active:bg-[var(--color-primary)]/5 transition-all"
                            >
                                {/* Fecha/Hora + Acción */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-tertiary)]">
                                        <Calendar size={12} />
                                        <span>{new Date(log.timestamp).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                    </div>
                                    {(() => {
                                        const actionColors: Record<string, string> = {
                                            'CREATE': 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20',
                                            'UPDATE': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                                            'DELETE': 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20',
                                            'RESTORE': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                                            'EXPORT': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
                                        };
                                        return (
                                            <span className={clsx(
                                                'px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold tracking-wide border',
                                                actionColors[log.action] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                            )}>
                                                {log.action_display}
                                            </span>
                                        );
                                    })()}
                                </div>

                                {/* Usuario */}
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Usuario responsable</p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center shrink-0">
                                            <UserIcon size={11} className="text-[var(--color-primary)]" />
                                        </div>
                                        <span className="text-[12px] font-medium text-[var(--color-text-primary)]">
                                            {log.user_email || 'Sistema (Ninguno)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Módulo Afectado + Origen */}
                                <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-border-subtle)]/50 pt-2.5">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Módulo</p>
                                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] block truncate">
                                            {log.model_name} <span className="text-[var(--color-text-disabled)] text-[9px]">#{log.object_id}</span>
                                        </span>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">Origen</p>
                                        <span className="text-[11px] font-mono text-[var(--color-text-secondary)] block truncate uppercase">
                                            {log.source_display}
                                        </span>
                                    </div>
                                </div>

                                {/* Footer: Acción rápida (Detalle) */}
                                <div className="flex items-center justify-end border-t border-[var(--color-border-subtle)]/30 pt-2.5">
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <DetailActionButton onClick={() => handleOpenDetail(log)} disabled={false} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop Table (≥ md) ─────────────────────────────────── */}
                    <div className="hidden md:block">
                        <Table
                            columns={columns}
                            data={logs}
                            isLoading={isLoading}
                            emptyMessage={searchTerm || modelFilter ? 'No se encontraron registros de auditoría que coincidan con los filtros aplicados.' : 'No hay registros de auditoría en el sistema.'}
                        />
                    </div>
                </div>
                <div className="shrink-0 border-t border-[var(--color-border-subtle)] p-3 bg-[var(--color-bg-primary)]">
                    <Pagination
                        currentPage={currentPage}
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        onPageChange={fetchData}
                    />
                </div>
            </main>

            <GenericHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="Módulo de Auditoría">
                <p>
                    Este módulo registra automáticamente todas las modificaciones críticas del sistema. Un log inmutable se genera cada vez que un usuario interactúa para <strong className="font-semibold text-[var(--color-text-primary)]">CREAR</strong>, <strong className="font-semibold text-[var(--color-text-primary)]">ACTUALIZAR</strong> o <strong className="font-semibold text-[var(--color-text-primary)]">ELIMINAR</strong> a una entidad clave.
                </p>
                <ul className="mt-3 space-y-2 list-none pl-0">
                    <li className="flex items-start gap-2">
                        <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] opacity-60"></div>
                        <span className="text-[min(13px,1.1vw)]">Cada fila identifica el <strong>usuario responsable</strong> y la <strong>fecha exacta</strong> del cambio reportado por el servidor central.</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] opacity-60"></div>
                        <span className="text-[min(13px,1.1vw)]">Puedes ver <strong className="font-semibold text-[var(--color-text-primary)]">exactamente qué campos fueron modificados</strong> haciendo clic en el icono del ojo para abrir los detalles.</span>
                    </li>
                </ul>
            </GenericHelpModal>

            {/* Panel lateral de Detalle del Log */}
            {selectedLog && (
                <DetailPanel
                    isOpen={isPanelOpen}
                    onClose={() => {
                        setIsPanelOpen(false);
                        setTimeout(() => setSelectedLog(null), 300); // Wait for exit animation
                    }}
                    log={selectedLog}
                />
            )}
        </div>
    );
}
