/**
 * frontend/src/features/guios/evaluations/components/AILogsModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal interactivo para auditoría e inspección forense de logs de IA (GUIOS).
 * Utiliza estrictamente la paleta de colores institucional y componentes UI
 * del sistema (Select, Input, Button, Modal, Alert, Loading).
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
    Cpu,
    RefreshCw,
    Search,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Copy,
    Check,
    ChevronRight,
    FileText,
    Sliders,
    BookOpen,
    Sparkles,
    CheckSquare,
    Layers,
} from 'lucide-react';

import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select, { type SelectOption } from '../../../../components/ui/Select';
import Alert from '../../../../components/ui/Alert';
import Loading from '../../../../components/ui/Loading';
import { useAILogs } from '../../../../hooks/useAILogs';
import type { AILogItem } from '../../../../api/aiLogService';

interface AILogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    evaluationId?: number | string | null;
    evaluationName?: string | null;
}

const REQUEST_TYPE_OPTIONS: SelectOption[] = [
    { value: '', label: 'Todos los tipos' },
    { value: 'literature_search', label: 'Búsqueda de Literatura' },
    { value: 'factor_importance', label: 'Importancia Decisor' },
    { value: 'subfactor_rating', label: 'Calificación Subfactor' },
    { value: 'executive_summary', label: 'Resumen Ejecutivo' },
];

const STATUS_OPTIONS: SelectOption[] = [
    { value: '', label: 'Todos los estados' },
    { value: 'success', label: 'Éxito' },
    { value: 'error', label: 'Error' },
    { value: 'timeout', label: 'Timeout' },
];

export const AILogsModal: React.FC<AILogsModalProps> = ({
    isOpen,
    onClose,
    evaluationId,
    evaluationName,
}) => {
    const {
        logs,
        loading,
        selectedLog,
        detailLoading,
        filters,
        setFilters,
        fetchLogs,
        fetchLogDetail,
        closeDetail,
    } = useAILogs({ evaluationId, autoFetch: isOpen });

    const [copiedTab, setCopiedTab] = useState<'payload' | 'response' | null>(null);
    const [activeTab, setActiveTab] = useState<'payload' | 'response'>('response');

    // Manejador de copia al portapapeles
    const handleCopy = useCallback((text: string, tab: 'payload' | 'response') => {
        navigator.clipboard.writeText(text);
        setCopiedTab(tab);
        setTimeout(() => setCopiedTab(null), 2000);
    }, []);

    // Determinar si un log aplicó contingencia heurística
    const isFallback = useCallback((log: AILogItem) => {
        return (log.error_message || '').toUpperCase().includes('FALLBACK');
    }, []);

    // Ícono según tipo de solicitud con tokens de tema
    const getRequestIcon = useCallback((type: string) => {
        switch (type) {
            case 'literature_search':
                return <BookOpen size={14} className="text-[var(--color-info)]" />;
            case 'factor_importance':
                return <Sliders size={14} className="text-[var(--color-primary)]" />;
            case 'subfactor_rating':
                return <CheckSquare size={14} className="text-[var(--color-success)]" />;
            case 'executive_summary':
                return <Sparkles size={14} className="text-[var(--color-warning)]" />;
            default:
                return <FileText size={14} className="text-[var(--color-text-tertiary)]" />;
        }
    }, []);

    const safeLogs = useMemo(() => (Array.isArray(logs) ? logs : []), [logs]);

    const formattedPayload = useMemo(() => {
        if (!selectedLog?.request_payload) return '';
        try {
            return JSON.stringify(selectedLog.request_payload, null, 2);
        } catch {
            return String(selectedLog.request_payload);
        }
    }, [selectedLog]);

    const formattedResponse = useMemo(() => {
        if (!selectedLog?.response_payload) return '';
        try {
            return JSON.stringify(selectedLog.response_payload, null, 2);
        } catch {
            return String(selectedLog.response_payload);
        }
    }, [selectedLog]);

    const suggestionLines = useMemo(() => {
        const payload = selectedLog?.response_payload;
        if (!payload) return [];
        const lines: string[] = [];
        const justification = typeof payload.justification === 'string' ? payload.justification.trim() : '';
        const score = payload.suggested_id ?? payload.suggested_rating;
        if (justification) {
            lines.push(score != null ? `Sugerencia IA (${score}/4): ${justification}` : `Sugerencia IA: ${justification}`);
        }
        const ratings = payload.ratings;
        if (ratings && typeof ratings === 'object' && !Array.isArray(ratings)) {
            Object.entries(ratings).forEach(([id, item]) => {
                if (!item || typeof item !== 'object') return;
                const row = item as Record<string, unknown>;
                const text = typeof row.justification === 'string' ? row.justification.trim() : '';
                const rating = row.rating ?? row.suggested_rating;
                if (text) {
                    lines.push(`Subfactor ${id}${rating != null ? ` (${rating}/4)` : ''}: ${text}`);
                }
            });
        }
        return lines;
    }, [selectedLog]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => {
                closeDetail();
                onClose();
            }}
            size="full"
            title={
                <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Cpu size={18} />
                    </span>
                    <div>
                        <h2 className="text-xs sm:text-sm font-bold text-[var(--color-text-primary)]">
                            {evaluationId
                                ? `Auditoría IA — ${evaluationName || `Evaluación #${evaluationId}`}`
                                : 'Auditoría Global de Inteligencia Artificial (GUIOS)'}
                        </h2>
                        <p className="text-[11px] text-[var(--color-text-secondary)] font-normal">
                            Registro de peticiones, latencias, motor Groq, Cohere y contingencia heurística
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] text-[var(--color-text-tertiary)] font-mono">
                        {safeLogs.length} eventos registrados
                    </span>
                    <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
                        Cerrar Auditoría
                    </Button>
                </div>
            }
        >
            <div className="space-y-3 -mt-1">
                {/* ── Barra de Filtros con Componentes del Sistema ── */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] rounded-[var(--radius-md)]">
                    <div className="flex-1 min-w-[220px] max-w-sm">
                        <Input
                            placeholder="Buscar en logs (software, factor, error)..."
                            value={filters.search || ''}
                            onChange={(e) => setFilters({ search: e.target.value })}
                            icon={Search}
                        />
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Selector de Tipo de Solicitud con Select UI */}
                        <div className="w-[190px]">
                            <Select
                                placeholder=""
                                options={REQUEST_TYPE_OPTIONS}
                                value={filters.request_type || ''}
                                onChange={(e) => setFilters({ request_type: e.target.value })}
                            />
                        </div>

                        {/* Selector de Estado con Select UI */}
                        <div className="w-[160px]">
                            <Select
                                placeholder=""
                                options={STATUS_OPTIONS}
                                value={filters.status || ''}
                                onChange={(e) => setFilters({ status: e.target.value })}
                            />
                        </div>

                        <Button
                            variant="secondary"
                            onClick={() => fetchLogs()}
                            disabled={loading}
                            className="flex items-center gap-1.5 h-10 px-3 text-xs"
                            title="Recargar logs"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                            <span>Actualizar</span>
                        </Button>
                    </div>
                </div>

                {/* ── Vista Dividida: Lista de Logs y Panel Inspector ── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[480px]">
                    {/* Panel Izquierdo: Lista de Logs (5 columnas) */}
                    <div className="lg:col-span-5 flex flex-col border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] bg-[var(--color-bg-primary)] overflow-hidden">
                        <div className="p-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/50 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                Historial de Solicitudes
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-[var(--color-text-secondary)]">
                                {safeLogs.length} eventos
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-[var(--color-border-subtle)] custom-scrollbar">
                            {loading ? (
                                <div className="py-12">
                                    <Loading label="Consultando logs de auditoría..." />
                                </div>
                            ) : safeLogs.length === 0 ? (
                                <div className="p-10 text-center text-xs text-[var(--color-text-tertiary)] flex flex-col items-center gap-2">
                                    <Cpu size={26} className="opacity-40" />
                                    <span>No se encontraron registros de IA para los criterios seleccionados.</span>
                                </div>
                            ) : (
                                safeLogs.map((log) => {
                                    const isSelected = selectedLog?.id === log.id;
                                    const hasFallback = isFallback(log);

                                    return (
                                        <div
                                            key={log.id}
                                            onClick={() => fetchLogDetail(log.id)}
                                            className={`p-3 cursor-pointer transition-colors text-left flex items-start justify-between gap-2.5 ${
                                                isSelected
                                                    ? 'bg-[var(--color-primary-soft-bg)] border-l-2 border-l-[var(--color-primary)]'
                                                    : 'hover:bg-[var(--color-bg-secondary)]/60'
                                            }`}
                                        >
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {getRequestIcon(log.request_type)}
                                                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                                                        {log.request_type_display}
                                                    </span>
                                                </div>

                                                <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1.5 truncate">
                                                    <span className="font-medium text-[var(--color-text-primary)]">
                                                        {log.software_name}
                                                    </span>
                                                    {log.factor_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-[var(--color-text-tertiary)] truncate">
                                                                {log.factor_name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] font-mono">
                                                    <span>
                                                        {new Date(log.requested_at).toLocaleTimeString('es-ES', {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            second: '2-digit',
                                                        })}
                                                    </span>
                                                    {log.response_time_ms !== null && (
                                                        <span className="flex items-center gap-0.5 text-[var(--color-info-text)]">
                                                            <Clock size={10} />
                                                            {log.response_time_ms} ms
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Badges de estado con tokens semánticos */}
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {log.status === 'success' && !hasFallback && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20">
                                                        <CheckCircle2 size={11} /> Éxito
                                                    </span>
                                                )}
                                                {log.status === 'success' && hasFallback && (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/20"
                                                        title="Fallo en motor primario mitigado por contingencia"
                                                    >
                                                        <AlertTriangle size={11} /> Fallback
                                                    </span>
                                                )}
                                                {log.status === 'error' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-bold bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/20">
                                                        <XCircle size={11} /> Error
                                                    </span>
                                                )}
                                                <ChevronRight size={13} className="text-[var(--color-text-tertiary)] mt-0.5" />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Panel Derecho: Inspector de JSON y Diagnóstico (7 columnas) */}
                    <div className="lg:col-span-7 flex flex-col border border-[var(--color-border-subtle)] rounded-[var(--radius-md)] bg-[var(--color-bg-primary)] overflow-hidden">
                        {detailLoading ? (
                            <div className="py-20 flex-1 flex items-center justify-center">
                                <Loading label="Cargando detalle técnico del log..." />
                            </div>
                        ) : !selectedLog ? (
                            <div className="p-16 text-center text-xs text-[var(--color-text-tertiary)] flex flex-col items-center justify-center flex-1 gap-3">
                                <div className="p-3 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]">
                                    <Layers size={28} className="text-[var(--color-text-tertiary)]" />
                                </div>
                                <div>
                                    <p className="font-semibold text-[var(--color-text-secondary)]">
                                        Selecciona una interacción en la lista
                                    </p>
                                    <p className="text-[11px] mt-0.5 max-w-sm text-[var(--color-text-tertiary)]">
                                        Podrás inspeccionar el payload exacto enviado al modelo de IA, los metadatos de respuesta, tiempos de respuesta y errores de red o cuota.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                {/* Encabezado del Detalle */}
                                <div className="p-3.5 bg-[var(--color-bg-secondary)]/50 border-b border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-[var(--color-primary)]">
                                                Log #{selectedLog.id}
                                            </span>
                                            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                                                {selectedLog.request_type_display}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                            Evaluación: <strong>{selectedLog.software_name}</strong> ({selectedLog.org_name})
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="text-right text-[11px] font-mono">
                                            <span className="text-[var(--color-text-tertiary)] block">Latencia</span>
                                            <span className="font-semibold text-[var(--color-info-text)]">
                                                {selectedLog.response_time_ms ? `${selectedLog.response_time_ms} ms` : 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Banner de Error / Fallback con componente Alert del sistema */}
                                {selectedLog.error_message && (
                                    <div className="p-3 border-b border-[var(--color-border-subtle)]">
                                        <Alert
                                            type={isFallback(selectedLog) ? 'warning' : 'error'}
                                            title={isFallback(selectedLog) ? 'Contingencia Heurística Activada' : 'Fallo en la Petición'}
                                            message={selectedLog.error_message}
                                        />
                                    </div>
                                )}

                                {/* Pestañas de Inspección */}
                                <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-3 pt-2 bg-[var(--color-bg-primary)]">
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('response')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-t-[var(--radius-sm)] transition-colors border-b-2 cursor-pointer ${
                                                activeTab === 'response'
                                                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-bg-secondary)]/40'
                                                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                        >
                                            Respuesta Recibida (Output)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('payload')}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-t-[var(--radius-sm)] transition-colors border-b-2 cursor-pointer ${
                                                activeTab === 'payload'
                                                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-bg-secondary)]/40'
                                                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                            }`}
                                        >
                                            Payload Enviado (Input)
                                        </button>
                                    </div>

                                    {/* Botón copiar contenido activo */}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                            handleCopy(
                                                activeTab === 'response' ? formattedResponse : formattedPayload,
                                                activeTab === 'response' ? 'response' : 'payload'
                                            )
                                        }
                                        className="text-[11px] flex items-center gap-1 py-1"
                                        title="Copiar contenido JSON"
                                    >
                                        {copiedTab === (activeTab === 'response' ? 'response' : 'payload') ? (
                                            <>
                                                <Check size={11} className="text-[var(--color-success)]" />
                                                <span>Copiado</span>
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={11} />
                                                <span>Copiar JSON</span>
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {activeTab === 'response' && suggestionLines.length > 0 && (
                                    <div className="px-3.5 py-3 border-b border-[var(--color-border-subtle)] space-y-2">
                                        {suggestionLines.map((line) => (
                                            <p key={line} className="text-xs leading-relaxed">
                                                <span className="ai-platinum-text">{line}</span>
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {/* Visor de Código JSON */}
                                <div className="flex-1 p-3.5 overflow-y-auto max-h-[380px] bg-[var(--color-bg-secondary)]/40 font-mono text-[11px] custom-scrollbar">
                                    {activeTab === 'response' ? (
                                        formattedResponse ? (
                                            <pre className="text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                                                {formattedResponse}
                                            </pre>
                                        ) : (
                                            <span className="text-[var(--color-text-tertiary)] italic">
                                                Sin payload de respuesta registrado.
                                            </span>
                                        )
                                    ) : formattedPayload ? (
                                        <pre className="text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                                            {formattedPayload}
                                        </pre>
                                    ) : (
                                        <span className="text-[var(--color-text-tertiary)] italic">
                                            Sin payload de entrada registrado.
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AILogsModal;
