/**
 * features/guios/evaluations/components/detail/FactorSourcesModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de Inspección Académica de Literatura Científica Indexada (GUIOS):
 * Presenta las fuentes bibliográficas, citas y artículos recuperados de OpenAlex
 * con sus DOIs oficiales y evidencias textuales.
 *
 * Principio de diseño:
 * - Estética editorial académica (estilo Nature / IEEE / SciPy).
 * - Sin cajas anidadas, sin badges verdes estridentes ni contenedores redundantes.
 * - Tipografía sobria, jerarquía clara y enlaces DOI discretos y elegantes.
 */

import React, { memo } from 'react';
import {
    BookOpen,
    ExternalLink,
    FileText,
    Sparkles,
} from 'lucide-react';
import Modal from '../../../../../components/ui/Modal';
import Button from '../../../../../components/ui/Button';
import type { EvaluationFactorItem, AISourceItem } from '../../../../../api/evaluationService';

interface FactorSourcesModalProps {
    isOpen: boolean;
    onClose: () => void;
    factor: EvaluationFactorItem | null;
}

const getCleanDoi = (doi?: string): string => {
    if (!doi) return '';
    return doi
        .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
        .replace(/^doi:\s*/i, '')
        .trim();
};

export const FactorSourcesModal: React.FC<FactorSourcesModalProps> = ({
    isOpen,
    onClose,
    factor,
}) => {
    if (!factor) return null;

    const sources: AISourceItem[] = factor.ai_literature_sources || [];
    const ratio = Number(factor.citation_ratio || 0).toFixed(2);
    const il = factor.literature_importance_calculated || 1;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-[var(--color-text-secondary)] shrink-0" />
                    <span className="font-bold text-sm tracking-tight text-[var(--color-text-primary)]">
                        Literatura Científica Indexada: {factor.factor_name}
                    </span>
                </div>
            }
            size="lg"
        >
            <div className="space-y-4 font-sans text-xs">
                {/* ── 1. Franja Metodológica Unificada (Sin cajas anidadas) ── */}
                <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-4 py-2 px-3 rounded-[var(--radius-xs)] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] font-mono text-[11px] text-[var(--color-text-secondary)]">
                    <div>
                        <span className="text-[var(--color-text-tertiary)] mr-1">Dimensión:</span>
                        <strong className="text-[var(--color-text-primary)]">{factor.dimension_name}</strong>
                    </div>
                    <div>
                        <span className="text-[var(--color-text-tertiary)] mr-1">Razón rᵢ:</span>
                        <strong className="text-[var(--color-text-primary)]">{ratio}</strong>
                    </div>
                    <div>
                        <span className="text-[var(--color-text-tertiary)] mr-1">Citas Auditadas:</span>
                        <strong className="text-[var(--color-text-primary)]">{factor.citations_count} citas</strong>
                    </div>
                    <div>
                        <span className="text-[var(--color-text-tertiary)] mr-1">Clasificación:</span>
                        <strong className="text-[var(--color-text-primary)]">IL {il} / 4</strong>
                    </div>
                </div>

                {/* ── 2. Criterio Técnico del Motor de IA (Diseño Editorial sobrio) ── */}
                {factor.ai_id_justification && (
                    <p className="text-xs leading-relaxed">
                        <Sparkles size={12} className="inline mr-1 text-amber-400" />
                        <span className="ai-platinum-text">
                            Sugerencia IA
                            {factor.ai_suggested_id ? ` (${factor.ai_suggested_id}/4)` : ''}:{' '}
                            {factor.ai_id_justification}
                        </span>
                    </p>
                )}

                {/* ── 3. Listado Editorial de Publicaciones Científicas ── */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[var(--color-border-subtle)]">
                        <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <FileText size={13} className="text-[var(--color-text-tertiary)]" />
                            <span>Publicaciones Indexadas ({sources.length})</span>
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
                            Base: OpenAlex + DOIs Registrados
                        </span>
                    </div>

                    {sources.length > 0 ? (
                        <div className="divide-y divide-[var(--color-border-subtle)]/60 max-h-[420px] overflow-y-auto pr-1">
                            {sources.map((src, idx) => {
                                const cleanDoi = getCleanDoi(src.doi);
                                const doiUrl = cleanDoi ? `https://doi.org/${cleanDoi}` : null;
                                const externalUrl = src.url && src.url !== doiUrl ? src.url : null;

                                return (
                                    <article
                                        key={idx}
                                        className="py-3 px-1 hover:bg-[var(--color-bg-page)]/40 transition-colors space-y-1.5"
                                    >
                                        {/* Título de la Publicación y Subfactor Vinculado */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                                <span className="font-mono text-[11px] font-bold text-[var(--color-text-tertiary)] mt-0.5 shrink-0">
                                                    [{idx + 1}]
                                                </span>
                                                <h5 className="font-semibold text-xs sm:text-[13px] text-[var(--color-text-primary)] leading-snug">
                                                    {src.title || `Publicación Científica #${idx + 1}`}
                                                </h5>
                                            </div>

                                            {src.subfactor_id && (
                                                <span
                                                    className="font-mono text-[10px] text-[var(--color-text-tertiary)] shrink-0 pt-0.5 max-w-[45%] text-right"
                                                    title={src.subfactor_description || undefined}
                                                >
                                                    Subfactor #{src.subfactor_id}
                                                    {src.match_origin === 'keyword_backfill' ? ' · coincidencia automática' : ''}
                                                </span>
                                            )}
                                        </div>

                                        {src.subfactor_description && (
                                            <p className="pl-5 text-[11px] text-[var(--color-text-tertiary)] leading-snug">
                                                Respalda: {src.subfactor_description}
                                            </p>
                                        )}

                                        {/* Identificadores Persistentes (DOI / URL) en formato bibliográfico */}
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 font-mono text-[11px]">
                                            {cleanDoi ? (
                                                <a
                                                    href={doiUrl!}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="inline-flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline transition-colors font-medium"
                                                    title="Abrir publicación científica en doi.org"
                                                >
                                                    <span>doi:{cleanDoi}</span>
                                                    <ExternalLink size={10} className="text-[var(--color-text-tertiary)]" />
                                                </a>
                                            ) : (
                                                <span className="text-[var(--color-text-tertiary)] text-[10px]">
                                                    Fuente Técnica Registrada
                                                </span>
                                            )}

                                            {externalUrl && (
                                                <a
                                                    href={externalUrl}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    className="inline-flex items-center gap-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:underline transition-colors"
                                                >
                                                    <span>Repositorio / Fuente externa</span>
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>

                                        {/* Evidencia Textual / Abstract */}
                                        {src.snippet && (
                                            <p className="pl-5 text-[11px] text-[var(--color-text-secondary)] italic leading-relaxed">
                                                «{src.snippet}»
                                            </p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-xs text-[var(--color-text-tertiary)] italic border border-dashed border-[var(--color-border-subtle)] rounded-[var(--radius-xs)] bg-[var(--color-bg-page)]/40 font-mono">
                            No se registraron citas con snippet externo para este factor (cálculo de literatura base o sin IA activada).
                        </div>
                    )}
                </div>

                {/* ── 4. Pie con Botón de Cierre ── */}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)] text-[10px] font-mono text-[var(--color-text-tertiary)]">
                    <span>Repositorio Bibliográfico GUIOS</span>
                    <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
                        Cerrar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default memo(FactorSourcesModal);
