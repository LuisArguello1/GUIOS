import React, { useState, memo } from 'react';
import { Layers, Building2, Sparkles, Globe, Tag, Info, Sliders } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type { EvaluationCreateInput } from '../../../../api/evaluationService';

interface EvaluationCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: EvaluationCreateInput) => Promise<unknown>;
}

interface EvaluationCreateContentProps {
    onClose: () => void;
    onSubmit: (data: EvaluationCreateInput) => Promise<unknown>;
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

const EvaluationCreateContent: React.FC<EvaluationCreateContentProps> = ({ onClose, onSubmit }) => {
    const [softwareName, setSoftwareName] = useState('');
    const [orgName, setOrgName] = useState('Universidad Estatal de Milagro (UNEMI)');
    const [softwareCategory, setSoftwareCategory] = useState('Base de Datos');
    const [softwareVersion, setSoftwareVersion] = useState('');
    const [softwareRepoUrl, setSoftwareRepoUrl] = useState('');
    const [softwareDescription, setSoftwareDescription] = useState('');
    const [orgSector, setOrgSector] = useState('Educación Superior');
    const [orgDescription, setOrgDescription] = useState('');
    const [aiEnabled, setAiEnabled] = useState(false);

    const [softwareNameError, setSoftwareNameError] = useState<string | null>(null);
    const [orgNameError, setOrgNameError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanSoftware = softwareName.trim();
        const cleanOrg = orgName.trim();

        let hasError = false;
        if (!cleanSoftware) {
            setSoftwareNameError('El nombre del software candidato es obligatorio.');
            hasError = true;
        } else {
            setSoftwareNameError(null);
        }

        if (!cleanOrg) {
            setOrgNameError('El nombre de la organización evaluadora es obligatorio.');
            hasError = true;
        } else {
            setOrgNameError(null);
        }

        if (hasError) return;

        setIsSubmitting(true);
        const payload: EvaluationCreateInput = {
            software_name: cleanSoftware,
            org_name: cleanOrg,
            software_category: softwareCategory,
            software_version: softwareVersion.trim(),
            software_repo_url: softwareRepoUrl.trim() || undefined,
            software_description: softwareDescription.trim(),
            org_sector: orgSector.trim(),
            org_description: orgDescription.trim(),
            ai_enabled: aiEnabled,
            auto_compute_literature: true,
        };

        const result = await onSubmit(payload);
        setIsSubmitting(false);
        if (result) {
            onClose();
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            size="lg"
            title={
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                        <Layers size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                            Iniciar Nueva Evaluación de Software Libre
                        </h3>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                            Registra el software candidato y la entidad evaluadora para el flujo metodológico GUIOS
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="text-[11px] text-[var(--color-text-tertiary)]">
                        * Inicializa automáticamente el cálculo de cuartiles base
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !softwareName.trim() || !orgName.trim()}
                        >
                            {isSubmitting ? 'Iniciando...' : 'Iniciar Evaluación'}
                        </Button>
                    </div>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── Datos del Software Candidato ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <Sliders size={13} className="text-[var(--color-primary)]" />
                            1. Software Candidato (FLOSS)
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            Producto evaluado
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <Input
                                label="Nombre del Software *"
                                icon={Layers}
                                value={softwareName}
                                onChange={(e) => {
                                    setSoftwareName(e.target.value);
                                    if (softwareNameError) setSoftwareNameError(null);
                                }}
                                placeholder="Ej: PostgreSQL, Moodle, Nextcloud, Ubuntu Server..."
                                error={softwareNameError || undefined}
                                required
                            />
                        </div>

                        <div>
                            <Input
                                label="Versión"
                                value={softwareVersion}
                                onChange={(e) => setSoftwareVersion(e.target.value)}
                                placeholder="Ej: 16.2, 4.3 LTS..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                                <Tag size={12} className="text-[var(--color-primary)]" />
                                Categoría Funcional
                            </label>
                            <select
                                value={softwareCategory}
                                onChange={(e) => setSoftwareCategory(e.target.value)}
                                className="w-full py-1.5 px-2.5 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
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
                                label="Repositorio / Sitio Web"
                                icon={Globe}
                                type="url"
                                value={softwareRepoUrl}
                                onChange={(e) => setSoftwareRepoUrl(e.target.value)}
                                placeholder="https://github.com/..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                            Descripción / Perfil Funcional
                        </label>
                        <textarea
                            rows={2}
                            value={softwareDescription}
                            onChange={(e) => setSoftwareDescription(e.target.value)}
                            placeholder="Breve reseña sobre arquitectura, casos de uso o alcance de la solución..."
                            className="w-full p-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] resize-y"
                        />
                    </div>
                </div>

                {/* ── Datos de la Organización Evaluadora ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <Building2 size={13} className="text-[var(--color-primary)]" />
                            2. Organización Evaluadora
                        </span>
                        <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            Contexto de adopción
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Input
                                label="Nombre de la Institución *"
                                icon={Building2}
                                value={orgName}
                                onChange={(e) => {
                                    setOrgName(e.target.value);
                                    if (orgNameError) setOrgNameError(null);
                                }}
                                placeholder="Ej: UNEMI, Hospital General, GAD Municipal..."
                                error={orgNameError || undefined}
                                required
                            />
                        </div>

                        <div>
                            <Input
                                label="Sector / Rubro"
                                value={orgSector}
                                onChange={(e) => setOrgSector(e.target.value)}
                                placeholder="Ej: Educación Superior, Salud, Gobierno..."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
                            Contexto de Necesidades TI
                        </label>
                        <textarea
                            rows={2}
                            value={orgDescription}
                            onChange={(e) => setOrgDescription(e.target.value)}
                            placeholder="Requerimientos específicos, infraestructura disponible o metas del proyecto..."
                            className="w-full p-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] resize-y"
                        />
                    </div>
                </div>

                {/* ── Asistencia de Inteligencia Artificial ── */}
                <div className="p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[4px]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-[2px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                                    Asistencia de Inteligencia Artificial
                                </span>
                                <span className="text-[10px] text-[var(--color-text-secondary)] block">
                                    Habilita la extracción semántica de evidencias web y justificaciones en el informe final.
                                </span>
                            </div>
                        </div>

                        <input
                            type="checkbox"
                            checked={aiEnabled}
                            onChange={(e) => setAiEnabled(e.target.checked)}
                            className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer"
                        />
                    </div>

                    <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                        <Info size={11} className="shrink-0 text-[var(--color-info-text)]" />
                        <span>
                            Si la IA se encuentra inactiva, se emplearán las citas bibliográficas base del catálogo de la tesis doctoral.
                        </span>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export const EvaluationCreateModal: React.FC<EvaluationCreateModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    if (!isOpen) return null;

    return <EvaluationCreateContent key="new-evaluation" onClose={onClose} onSubmit={onSubmit} />;
};

export default memo(EvaluationCreateModal);
