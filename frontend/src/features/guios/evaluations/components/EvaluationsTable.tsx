import React, { memo } from 'react';
import { clsx } from 'clsx';
import {
    Clock,
    CheckCircle2,
    Sparkles,
    Trash2,
    Calendar,
    ArrowRight,
    Building2,
    Layers,
    AlertCircle,
    CheckCheck,
    AlertTriangle,
    Cpu,
    FileDown,
    FileSpreadsheet,
    ArrowLeftRight,
} from 'lucide-react';
import Loading from '../../../../components/ui/Loading';
import PermissionGuard from '../../../../components/ui/PermissionGuard';
import type { EvaluationItem, RecommendationType } from '../../../../api/evaluationService';
import evaluationService from '../../../../api/evaluationService';
import { downloadBlob } from '../../../../utils/fileDownloader';
import { getErrorDetail } from '../../../../utils/errorUtils';
import useToastStore from '../../../../app/useToastStore';

interface EvaluationsTableProps {
    evaluations: EvaluationItem[];
    loading: boolean;
    onViewDetail: (evaluation: EvaluationItem) => void;
    onDelete: (evaluation: EvaluationItem) => void;
    onViewAILogs: (evaluation: EvaluationItem) => void;
    selectedIds?: number[];
    onToggleSelect?: (id: number) => void;
}

const RecommendationBadge: React.FC<{ recommendation: RecommendationType | null }> = ({ recommendation }) => {
    if (!recommendation) {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[2px] bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)] font-mono">
                <Clock size={11} /> Pendiente
            </span>
        );
    }

    if (recommendation === 'A') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success-border)]">
                <CheckCheck size={12} className="text-[var(--color-success)]" />
                Rec. A (Adoptar sin obs.)
            </span>
        );
    }

    if (recommendation === 'B') {
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)]">
                <AlertTriangle size={12} className="text-[var(--color-warning-text)]" />
                Rec. B (Adoptar con matices)
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[2px] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger-border)]">
            <AlertCircle size={12} className="text-[var(--color-danger-text)]" />
            Rec. C (Posponer adopción)
        </span>
    );
};

export const EvaluationsTable: React.FC<EvaluationsTableProps> = ({
    evaluations,
    loading,
    onViewDetail,
    onDelete,
    onViewAILogs,
    selectedIds = [],
    onToggleSelect,
}) => {
    const { addToast } = useToastStore();
    const [downloadingId, setDownloadingId] = React.useState<number | null>(null);
    const [downloadType, setDownloadType] = React.useState<'pdf' | 'excel' | null>(null);

    const handleDownloadPdf = async (e: React.MouseEvent, item: EvaluationItem) => {
        e.stopPropagation();
        setDownloadingId(item.id);
        setDownloadType('pdf');
        try {
            const { blob, contentDisposition } = await evaluationService.exportPdf(item.id);
            downloadBlob(blob, `Evaluacion_GUIOS_${item.software_name}.pdf`, contentDisposition);
            addToast({ type: 'success', message: `Dossier PDF de ${item.software_name} descargado con éxito.` });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el dossier PDF.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingId(null);
            setDownloadType(null);
        }
    };

    const handleDownloadExcel = async (e: React.MouseEvent, item: EvaluationItem) => {
        e.stopPropagation();
        setDownloadingId(item.id);
        setDownloadType('excel');
        try {
            const { blob, contentDisposition } = await evaluationService.exportExcel(item.id);
            downloadBlob(blob, `Evaluacion_GUIOS_${item.software_name}.xlsx`, contentDisposition);
            addToast({ type: 'success', message: `Libro Excel de ${item.software_name} descargado con éxito.` });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el libro Excel.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingId(null);
            setDownloadType(null);
        }
    };

    if (loading && evaluations.length === 0) {
        return (
            <div className="py-16 flex justify-center items-center bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px]">
                <Loading label="Cargando evaluaciones de software..." />
            </div>
        );
    }

    if (!loading && evaluations.length === 0) {
        return (
            <div className="py-16 text-center bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] p-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-text-tertiary)]">
                    <Layers size={22} />
                </div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">
                    No se encontraron evaluaciones
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                    No hay registros que coincidan con los filtros aplicados o aún no se ha iniciado ninguna sesión de evaluación.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto border border-[var(--color-border-subtle)] rounded-[4px] bg-[var(--color-bg-page)]">
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                    <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        <th className="px-3 py-2.5 text-center w-10" title="Seleccionar para comparar (máx. 2)">
                            <span className="sr-only">Comparar</span>
                            <ArrowLeftRight size={13} className="mx-auto text-[var(--color-text-tertiary)]" />
                        </th>
                        <th className="px-3.5 py-2.5">Software Candidato</th>
                        <th className="px-3 py-2.5">Organización Evaluadora</th>
                        <th className="px-3 py-2.5 text-center">Estado Metodológico</th>
                        <th className="px-3 py-2.5 text-center">Dictamen Final</th>
                        <th className="px-3 py-2.5 text-center">IA</th>
                        <th className="px-3 py-2.5 text-center">Fecha Inicio</th>
                        <th className="px-3 py-2.5 text-right w-24">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {evaluations.map((item) => {
                        const isSelected = selectedIds.includes(item.id);
                        const isMaxReached = selectedIds.length >= 2;
                        const isDisabled = !isSelected && isMaxReached;

                        return (
                            <tr
                                key={item.id}
                                className={clsx(
                                    'hover:bg-[var(--color-bg-elevated)] transition-colors group cursor-pointer',
                                    isSelected && 'bg-[var(--color-primary-soft-bg)]/40 border-l-2 border-l-[var(--color-primary)]'
                                )}
                                onClick={() => onViewDetail(item)}
                            >
                                {/* Checkbox de Comparación */}
                                <td className="px-3 py-3 text-center w-10" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        onChange={() => onToggleSelect?.(item.id)}
                                        className="w-4 h-4 rounded border-[var(--color-border-strong)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all accent-[var(--color-primary)]"
                                        title={
                                            isDisabled
                                                ? 'Solo se pueden comparar 2 evaluaciones a la vez'
                                                : isSelected
                                                ? 'Deseleccionar de la comparación'
                                                : 'Seleccionar para comparar'
                                        }
                                    />
                                </td>

                                {/* Software Candidato */}
                                <td className="px-3.5 py-3">
                                <div className="flex items-start gap-2">
                                    <div className="p-1 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] shrink-0 mt-0.5">
                                        <Layers size={14} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 font-bold text-[var(--color-text-primary)] text-xs">
                                            <span>{item.software_name}</span>
                                            {item.software_version && (
                                                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                                                    v{item.software_version}
                                                </span>
                                            )}
                                        </div>
                                        {item.software_category && (
                                            <span className="inline-block text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                                                {item.software_category}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </td>

                            {/* Organización Evaluadora */}
                            <td className="px-3 py-3">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-primary)] font-medium">
                                    <Building2 size={12} className="text-[var(--color-text-tertiary)] shrink-0" />
                                    <span>{item.org_name}</span>
                                </div>
                                {item.org_sector && (
                                    <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                        {item.org_sector}
                                    </span>
                                )}
                            </td>

                            {/* Estado */}
                            <td className="px-3 py-3 text-center">
                                {item.status === 'completed' ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[2px] bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]/20">
                                        <CheckCircle2 size={11} /> Completada
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[2px] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)]">
                                        <Clock size={11} /> En Progreso
                                    </span>
                                )}
                            </td>

                            {/* Dictamen / Recomendación */}
                            <td className="px-3 py-3 text-center">
                                <RecommendationBadge recommendation={item.recommendation} />
                            </td>

                            {/* Asistencia de IA */}
                            <td className="px-3 py-3 text-center">
                                {item.ai_enabled ? (
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                                        title={`Estado IA: ${item.ai_status}`}
                                    >
                                        <Sparkles size={10} /> IA Activa
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-[var(--color-text-tertiary)]">
                                        Base
                                    </span>
                                )}
                            </td>

                            {/* Fechas */}
                            <td className="px-3 py-3 text-center text-[11px] text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                                <span className="inline-flex items-center gap-1">
                                    <Calendar size={11} className="text-[var(--color-text-tertiary)]" />
                                    {new Date(item.started_at).toLocaleDateString()}
                                </span>
                            </td>

                            {/* Acciones */}
                            <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                    <PermissionGuard require="guios.evaluation_export">
                                        <button
                                            type="button"
                                            onClick={(e) => void handleDownloadPdf(e, item)}
                                            disabled={downloadingId === item.id}
                                            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                            title="Descargar Dossier Oficial en PDF"
                                        >
                                            <FileDown size={14} className={downloadingId === item.id && downloadType === 'pdf' ? 'animate-bounce text-rose-500' : ''} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => void handleDownloadExcel(e, item)}
                                            disabled={downloadingId === item.id}
                                            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                            title="Descargar Libro de Métricas en Excel"
                                        >
                                            <FileSpreadsheet size={14} className={downloadingId === item.id && downloadType === 'excel' ? 'animate-bounce text-emerald-600' : ''} />
                                        </button>
                                    </PermissionGuard>

                                    <button
                                        type="button"
                                        onClick={() => onViewAILogs(item)}
                                        className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft-bg)] transition-colors cursor-pointer"
                                        title="Inspeccionar logs de Inteligencia Artificial"
                                    >
                                        <Cpu size={14} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onViewDetail(item)}
                                        className="p-1 rounded-[2px] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft-bg)] transition-colors cursor-pointer"
                                        title="Abrir Asistente / Ver Evaluación"
                                    >
                                        <ArrowRight size={14} />
                                    </button>

                                    <PermissionGuard require="guios.evaluation_delete">
                                        <button
                                            type="button"
                                            onClick={() => onDelete(item)}
                                            className="p-1 rounded-[2px] text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] transition-colors cursor-pointer"
                                            title="Eliminar sesión de evaluación"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </PermissionGuard>
                                </div>
                            </td>
                        </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default memo(EvaluationsTable);
