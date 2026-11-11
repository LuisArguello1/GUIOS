/**
 * features/publicEvaluation/components/InitialEvaluationModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal de inicio para el registro del software candidato y organización evaluadora.
 * Cumple con RF-PUB-01, US-08 y la regla de activación de IA condicional (RF-IA-01).
 */

import React, { useState, useMemo, memo } from 'react';
import { Layers, Building2, Sparkles, Tag, Info } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import type { EvaluationCreateInput } from '../../../api/evaluationService';

interface InitialEvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: EvaluationCreateInput) => Promise<boolean>;
    isSubmitting?: boolean;
}

const CATEGORIES = [
    'Base de Datos',
    'Ofimática / Productividad',
    'ERP / Gestión Empresarial',
    'LMS / Educación',
    'Seguridad / Ciberseguridad',
    'Infraestructura / Servidores',
    'BI / Analítica de Datos',
    'Desarrollo / DevOps',
    'Otro',
];

export const InitialEvaluationModal: React.FC<InitialEvaluationModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    isSubmitting = false,
}) => {
    const [softwareName, setSoftwareName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [softwareCategory, setSoftwareCategory] = useState('Base de Datos');
    const [softwareVersion, setSoftwareVersion] = useState('');
    const [softwareRepoUrl, setSoftwareRepoUrl] = useState('');
    const [softwareDescription, setSoftwareDescription] = useState('');
    const [orgSector, setOrgSector] = useState('Educación Superior');
    const [orgDescription, setOrgDescription] = useState('');
    const [aiEnabled, setAiEnabled] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // RF-IA-01: La IA solo puede habilitarse si se proporcionó descripción o repositorio
    const isAIAvailable = useMemo(() => {
        return Boolean(
            softwareRepoUrl.trim() ||
            softwareDescription.trim() ||
            orgDescription.trim()
        );
    }, [softwareRepoUrl, softwareDescription, orgDescription]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanSoftware = softwareName.trim();
        const cleanOrg = orgName.trim();

        const newErrors: Record<string, string> = {};
        if (!cleanSoftware) {
            newErrors.softwareName = 'El nombre del software candidato es obligatorio.';
        }
        if (!cleanOrg) {
            newErrors.orgName = 'El nombre de la organización evaluadora es obligatorio.';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        const payload: EvaluationCreateInput = {
            software_name: cleanSoftware,
            org_name: cleanOrg,
            software_category: softwareCategory,
            software_version: softwareVersion.trim(),
            software_repo_url: softwareRepoUrl.trim() || undefined,
            software_description: softwareDescription.trim(),
            org_sector: orgSector.trim(),
            org_description: orgDescription.trim(),
            ai_enabled: isAIAvailable ? aiEnabled : false,
            auto_compute_literature: true,
            data_storage_consent: true,
            ai_processing_consent: isAIAvailable ? aiEnabled : false,
            privacy_policy_version: '1.0',
        };

        const success = await onSubmit(payload);
        if (success) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                            Iniciar Nueva Evaluación de Software (FLOSS)
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                            Guía metodológica GUIOS para evaluación objetiva de adopción institucional
                        </p>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── Sección 1: Datos Básicos del Software (Obligatorios) ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[6px] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                        <Tag size={13} className="text-[var(--color-primary)]" />
                        <span>Identificación del Software Candidato</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <Input
                                label="Nombre del software *"
                                placeholder="Ej: PostgreSQL, LibreOffice, Odoo..."
                                value={softwareName}
                                onChange={(e) => {
                                    setSoftwareName(e.target.value);
                                    if (errors.softwareName) setErrors((prev) => ({ ...prev, softwareName: '' }));
                                }}
                                error={errors.softwareName}
                                required
                            />
                        </div>
                        <div>
                            <Input
                                label="Versión"
                                placeholder="Ej: 16.2, 7.6..."
                                value={softwareVersion}
                                onChange={(e) => setSoftwareVersion(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                                Categoría del Software
                            </label>
                            <select
                                value={softwareCategory}
                                onChange={(e) => setSoftwareCategory(e.target.value)}
                                className="w-full text-xs rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] px-2.5 py-2 focus:outline-none focus:border-[var(--color-primary)]"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <Input
                                label="Repositorio o Sitio Web"
                                placeholder="https://github.com/postgres/postgres"
                                value={softwareRepoUrl}
                                onChange={(e) => setSoftwareRepoUrl(e.target.value)}
                            />
                            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                                Recomendado para habilitar la búsqueda semántica de IA.
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                            Descripción Funcional y Arquitectura
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Breve resumen de capacidades, módulos clave o arquitectura del software candidato..."
                            value={softwareDescription}
                            onChange={(e) => setSoftwareDescription(e.target.value)}
                            className="w-full text-xs rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] p-2.5 focus:outline-none focus:border-[var(--color-primary)] resize-none"
                        />
                    </div>
                </div>

                {/* ── Sección 2: Datos de la Organización Evaluadora ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[6px] space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                        <Building2 size={13} className="text-[var(--color-primary)]" />
                        <span>Contexto Organizacional e Institucional</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Input
                                label="Nombre de la Organización *"
                                placeholder="Nombre de la empresa o entidad"
                                value={orgName}
                                onChange={(e) => {
                                    setOrgName(e.target.value);
                                    if (errors.orgName) setErrors((prev) => ({ ...prev, orgName: '' }));
                                }}
                                error={errors.orgName}
                                required
                            />
                        </div>
                        <div>
                            <Input
                                label="Sector o Rubro"
                                placeholder="Ej: Educación Superior, Salud, Banca..."
                                value={orgSector}
                                onChange={(e) => setOrgSector(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                            Necesidades Específicas y Contexto de TI
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Describa requerimientos críticos, volumen de usuarios o restricciones de infraestructura..."
                            value={orgDescription}
                            onChange={(e) => setOrgDescription(e.target.value)}
                            className="w-full text-xs rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] p-2.5 focus:outline-none focus:border-[var(--color-primary)] resize-none"
                        />
                    </div>
                </div>

                {/* ── Sección 3: Activación de IA Asistida (RF-IA-01) ── */}
                <div className="p-3 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] flex items-start gap-3">
                    <div className="pt-0.5">
                        <input
                            type="checkbox"
                            id="ai-toggle-public"
                            checked={aiEnabled}
                            disabled={!isAIAvailable}
                            onChange={(e) => setAiEnabled(e.target.checked)}
                            className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer disabled:cursor-not-allowed"
                        />
                    </div>
                    <div className="flex-1 text-xs">
                        <label
                            htmlFor="ai-toggle-public"
                            className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5 cursor-pointer"
                        >
                            <Sparkles size={13} className="text-[var(--color-primary)]" />
                            <span>Habilitar Asistente de Inteligencia Artificial (Groq / Cohere)</span>
                        </label>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                            Proporcionará sugerencias orientativas de importancia (ID), pre-calificación técnica de subfactores
                            y generará el Resumen Ejecutivo y Plan de Mitigación al finalizar.
                        </p>
                        {!isAIAvailable && (
                            <p className="text-[10px] text-[var(--color-warning-text)] mt-1 flex items-center gap-1 font-mono">
                                <Info size={11} />
                                Ingrese una descripción de la organización o URL del repositorio para habilitar la IA.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Botones de Acción ── */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
                    <Button variant="secondary" size="md" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5"
                    >
                        {isSubmitting ? 'Iniciando sesión...' : 'Comenzar Evaluación'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default memo(InitialEvaluationModal);
