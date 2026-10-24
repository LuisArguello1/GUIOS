/**
 * frontend/src/features/dashboard/components/TopSoftwareTable.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Tabla analítica de los software evaluados con mayor viabilidad y registro reciente.
 * Incluye acciones directas para descargar el Dossier Técnico oficial en PDF o Excel.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FileDown,
    FileSpreadsheet,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Clock,
} from 'lucide-react';
import type { TopSoftwareItem } from '../../../api/dashboardService';
import evaluationService from '../../../api/evaluationService';
import usePermissions from '../../../hooks/usePermissions';
import useToastStore from '../../../app/useToastStore';
import { downloadBlob } from '../../../utils/fileDownloader';
import { getErrorDetail } from '../../../utils/errorUtils';

interface TopSoftwareTableProps {
    items: TopSoftwareItem[];
}

export const TopSoftwareTable: React.FC<TopSoftwareTableProps> = ({ items }) => {
    const navigate = useNavigate();
    const { has, isSuperuser } = usePermissions();
    const canExport = isSuperuser || has('guios.evaluation_export');
    const { addToast } = useToastStore();

    const [downloadingId, setDownloadingId] = useState<number | null>(null);
    const [downloadType, setDownloadType] = useState<'pdf' | 'excel' | null>(null);

    const handleDownloadPdf = async (e: React.MouseEvent, item: TopSoftwareItem) => {
        e.stopPropagation();
        setDownloadingId(item.id);
        setDownloadType('pdf');
        try {
            const { blob, contentDisposition } = await evaluationService.exportPdf(item.id);
            downloadBlob(blob, `Evaluacion_GUIOS_${item.software_name}.pdf`, contentDisposition);
            addToast({ type: 'success', message: `Dossier PDF de ${item.software_name} descargado con éxito.` });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el dossier PDF de la evaluación.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingId(null);
            setDownloadType(null);
        }
    };

    const handleDownloadExcel = async (e: React.MouseEvent, item: TopSoftwareItem) => {
        e.stopPropagation();
        setDownloadingId(item.id);
        setDownloadType('excel');
        try {
            const { blob, contentDisposition } = await evaluationService.exportExcel(item.id);
            downloadBlob(blob, `Evaluacion_GUIOS_${item.software_name}.xlsx`, contentDisposition);
            addToast({ type: 'success', message: `Libro Excel de ${item.software_name} descargado con éxito.` });
        } catch (err: unknown) {
            const message = getErrorDetail(err, 'Error al descargar el libro Excel de la evaluación.');
            addToast({ type: 'error', message });
        } finally {
            setDownloadingId(null);
            setDownloadType(null);
        }
    };

    const renderVerdictBadge = (rec: 'A' | 'B' | 'C' | null) => {
        switch (rec) {
            case 'A':
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Rec. A (Adoptar)
                    </span>
                );
            case 'B':
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Rec. B (Mitigar)
                    </span>
                );
            case 'C':
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <XCircle className="h-3.5 w-3.5" />
                        Rec. C (Posponer)
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded bg-gray-500/10 px-2 py-0.5 text-xs font-semibold text-gray-500">
                        <Clock className="h-3 w-3" />
                        En Progreso
                    </span>
                );
        }
    };

    return (
        <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-4 shadow-xs">
            <div className="flex flex-col gap-1 border-b border-[var(--color-border-subtle)] pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                        Cartera Prioritaria de Software Evaluado
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                        Software evaluado con dictamen metodológico y descarga directa de expedientes
                    </p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/guios/evaluaciones')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                    Ver todas las evaluaciones
                    <ExternalLink className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead>
                        <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/50 text-[var(--color-text-secondary)]">
                            <th className="py-2.5 px-3 font-semibold">Software Candidato</th>
                            <th className="py-2.5 px-3 font-semibold">Categoría</th>
                            <th className="py-2.5 px-3 font-semibold">Organización</th>
                            <th className="py-2.5 px-3 font-semibold text-center">Dictamen</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Dossier y Reporte</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)]">
                        {items.length > 0 ? (
                            items.map((item) => (
                                <tr
                                    key={item.id}
                                    className="transition hover:bg-[var(--color-bg-secondary)]/40"
                                >
                                    <td className="py-2.5 px-3">
                                        <div className="font-bold text-[var(--color-text-primary)]">
                                            {item.software_name}
                                        </div>
                                        {item.software_version && (
                                            <div className="font-mono text-[11px] text-[var(--color-text-tertiary)]">
                                                v{item.software_version}
                                            </div>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">
                                        {item.software_category || 'General'}
                                    </td>
                                    <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">
                                        {item.org_name}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        {renderVerdictBadge(item.recommendation)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                        <div className="inline-flex items-center justify-end gap-1.5">
                                            {canExport && (
                                                <>
                                                    <button
                                                        onClick={(e) => void handleDownloadPdf(e, item)}
                                                        disabled={downloadingId === item.id}
                                                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50"
                                                        title="Descargar Dossier PDF"
                                                    >
                                                        <FileDown className="h-3.5 w-3.5 text-rose-500" />
                                                        <span>
                                                            {downloadingId === item.id && downloadType === 'pdf' ? '...' : 'PDF'}
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => void handleDownloadExcel(e, item)}
                                                        disabled={downloadingId === item.id}
                                                        className="inline-flex items-center gap-1 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-primary)] hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-50"
                                                        title="Descargar Libro Excel"
                                                    >
                                                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                                                        <span>
                                                            {downloadingId === item.id && downloadType === 'excel' ? '...' : 'Excel'}
                                                        </span>
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => navigate(`/dashboard/guios/evaluaciones`)}
                                                className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)]"
                                                title="Ver evaluación"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-6 text-center text-xs text-[var(--color-text-tertiary)]">
                                    No hay evaluaciones completadas para mostrar en la cartera.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TopSoftwareTable;
