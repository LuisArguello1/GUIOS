import React from 'react';
import { Clock, User as UserIcon, Database, Activity, Code } from 'lucide-react';
import { clsx } from 'clsx';
import SlidePanel from '../../../components/ui/SlidePanel';
import type { AuditLog } from '../../../app/useAuditStore';
import Button from '../../../components/ui/Button';

/* ─── Átomos iOS/Android ─────────────────────────────────────────────────────── */
const GroupLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-5 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--color-text-tertiary)]">
        {children}
    </p>
);

const InfoRow: React.FC<{ icon: React.ReactNode; iconBg: string; label: string; value: string | React.ReactNode; last?: boolean }> = ({ icon, iconBg, label, value, last }) => (
    <div className={clsx(
        'flex items-center gap-3 px-5 py-3 bg-[var(--color-bg-primary)]',
        !last && 'border-b border-[var(--color-border-subtle)]',
    )}>
        <div className={clsx('w-[28px] h-[28px] rounded-[7px] flex items-center justify-center flex-shrink-0', iconBg)}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] mb-0.5 leading-none">
                {label}
            </p>
            <div className="text-[13px] text-[var(--color-text-primary)] truncate font-medium">
                {value}
            </div>
        </div>
    </div>
);

const SettingsGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mx-5 rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)]">
        {children}
    </div>
);

interface DetailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    log: AuditLog | null;
}

export default function DetailPanel({ isOpen, onClose, log }: DetailPanelProps) {
    if (!log) return null;

    const formattedDate = !log.timestamp
        ? ''
        : new Date(log.timestamp).toLocaleString('es-ES', {
            dateStyle: 'long',
            timeStyle: 'medium',
        });

    const actionColors: Record<string, string> = {
        'CREATE': 'text-[var(--color-success)]',
        'UPDATE': 'text-blue-500',
        'DELETE': 'text-[var(--color-danger)]',
        'RESTORE': 'text-emerald-500',
        'EXPORT': 'text-purple-500',
    };

    const changedFieldsDisplay =
        log.changed_fields_display && log.changed_fields_display.length > 0
            ? log.changed_fields_display
            : log.changed_fields;
    const beforePayload = log.before_display ?? log.before;
    const afterPayload = log.after_display ?? log.after;
    const deletedSnapshotPayload = log.deleted_snapshot_display ?? log.deleted_snapshot;

    return (
        <SlidePanel
            isOpen={isOpen}
            onClose={onClose}
            title="Detalle de Auditoría"
            subtitle={`Log ID: ${log.id}`}
            width="max-w-md"
        >
            <div className="pb-8">
                <GroupLabel>Información Emisor</GroupLabel>
                <SettingsGroup>
                    <InfoRow 
                        icon={<UserIcon size={14} className="text-white" />} 
                        iconBg="bg-[var(--color-primary)]" 
                        label="Usuario Responsable" 
                        value={log.user_email || 'Sistema / Tarea Background (None)'}
                    />
                    <InfoRow 
                        icon={<Clock size={14} className="text-white" />} 
                        iconBg="bg-[var(--color-tertiary)]" 
                        label="Fecha y Hora de Evento" 
                        value={formattedDate}
                        last
                    />
                </SettingsGroup>

                <GroupLabel>Auditoría Técnica</GroupLabel>
                <SettingsGroup>
                    <InfoRow 
                        icon={<Activity size={14} className="text-white" />} 
                        iconBg="bg-blue-500" 
                        label="Acción Realizada" 
                        value={
                            <span className={clsx("font-bold", actionColors[log.action] || 'text-[var(--color-text-secondary)]')}>
                                {log.action_display.toUpperCase()} (vía {log.source_display})
                            </span>
                        }
                    />
                    <InfoRow 
                        icon={<Database size={14} className="text-white" />} 
                        iconBg="bg-[var(--color-accent)]" 
                        label="Módulo Afectado" 
                        value={<span className="font-mono">{log.model_name} <small className="opacity-50">#{log.object_id}</small></span>}
                    />
                    <InfoRow 
                        icon={<Code size={14} className="text-white" />} 
                        iconBg="bg-gray-500" 
                        label="Metadatos de Red" 
                        value={
                            <div className="space-y-0.5">
                                <p className="text-[11px] font-mono">IP: {log.ip_address || 'Internal'}</p>
                                <p className="text-[10px] font-mono text-[var(--color-text-tertiary)] truncate max-w-[200px]" title={log.request_id}>
                                    REQ: {log.request_id || 'N/A'}
                                </p>
                            </div>
                        }
                        last
                    />
                </SettingsGroup>

                {log.action === 'UPDATE' && changedFieldsDisplay.length > 0 && (
                    <div className="mx-5 mt-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1.5 px-1">
                            Campos modificados
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {changedFieldsDisplay.map((field) => (
                                <span key={field} className="px-2 py-0.5 rounded-sm bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] font-bold border border-[var(--color-primary)]/20">
                                    {field}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <GroupLabel>Inspección de Datos</GroupLabel>
                
                {/* Vista ANTES (Solo en updates y deletes) */}
                {(log.action === 'UPDATE' || log.action === 'DELETE') && beforePayload && (
                    <div className="mx-5 mb-4 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
                        <div className="bg-[var(--color-bg-secondary)] px-4 py-2 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-danger)]">
                                Estado Anterior
                            </span>
                        </div>
                        <div className="p-3 overflow-x-auto max-h-52 custom-scrollbar bg-red-50/10">
                            <pre className="text-[11px] font-mono leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                {JSON.stringify(beforePayload, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Vista DESPUÉS (En creaciones y updates) */}
                {(log.action === 'CREATE' || log.action === 'UPDATE') && afterPayload && (
                    <div className="mx-5 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
                        <div className="bg-[var(--color-bg-secondary)] px-4 py-2 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-success)]">
                                {log.action === 'CREATE' ? 'Datos Iniciales' : 'Nuevo Estado'}
                            </span>
                        </div>
                        <div className="p-3 overflow-x-auto max-h-52 custom-scrollbar bg-green-50/10">
                            <pre className="text-[11px] font-mono leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                {JSON.stringify(afterPayload, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Snapshot al eliminar */}
                {log.action === 'DELETE' && deletedSnapshotPayload && (
                    <div className="mx-5 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] overflow-hidden">
                        <div className="bg-[var(--color-bg-secondary)] px-4 py-2 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-danger)]">
                                Snapshot Final (Antes de Borrado)
                            </span>
                        </div>
                        <div className="p-3 overflow-x-auto max-h-60 custom-scrollbar">
                            <pre className="text-[11px] font-mono leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                {JSON.stringify(deletedSnapshotPayload, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}

                <div className="mx-5 mt-8">
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onClose}
                        className="w-full h-11 text-[11px] font-bold uppercase tracking-widest rounded-sm"
                    >
                        Cerrar detalle
                    </Button>
                </div>
            </div>
        </SlidePanel>
    );
}
