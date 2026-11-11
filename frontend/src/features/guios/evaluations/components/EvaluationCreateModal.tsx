import React, { useState, memo } from 'react';
import { Layers, Building2, Sparkles, Globe, Tag, Info, Sliders, ShieldCheck, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import PrivacyPolicyModal from '../../../publicEvaluation/components/ui/PrivacyPolicyModal';
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

const ORG_SIZES = [
    'Sin indicar',
    '1 a 10 colaboradores (Micro)',
    '11 a 50 colaboradores (Pequeña)',
    '51 a 250 colaboradores (Mediana)',
    '251 a 1.000 colaboradores (Grande)',
    'Más de 1.000 colaboradores (Corporativa)',
];

const IT_STAFF_OPTIONS = [
    'Sin indicar',
    'Sin personal de TI dedicado',
    '1 a 5 personas',
    '6 a 15 personas',
    '16 a 50 personas',
    'Más de 50 personas',
];

const TIMELINE_OPTIONS = [
    'Sin indicar',
    'Menos de 1 mes',
    '1 a 3 meses',
    '3 a 6 meses',
    '6 a 12 meses',
    'Más de 1 año',
];

const PLATFORM_OPTIONS = [
    'Sin indicar',
    'Windows',
    'Linux',
    'macOS',
    'Mixto (Windows / Linux)',
    'Mixto (Windows / macOS / Linux)',
    'Nube / Web independiente',
];

const GOAL_OPTIONS = [
    'Sin indicar',
    'Reducción de costos de licenciamiento',
    'Independencia de proveedor (Vendor Lock-in)',
    'Mayor control y personalización',
    'Seguridad y soberanía de datos',
    'Modernización tecnológica',
    'Cumplimiento normativo o legal',
];

const EvaluationCreateContent: React.FC<EvaluationCreateContentProps> = ({ onClose, onSubmit }) => {
    const [softwareName, setSoftwareName] = useState('');
    const [orgName, setOrgName] = useState('');
    const [softwareCategory, setSoftwareCategory] = useState('Base de Datos');
    const [softwareVersion, setSoftwareVersion] = useState('');
    const [softwareRepoUrl, setSoftwareRepoUrl] = useState('');
    const [softwareDescription, setSoftwareDescription] = useState('');
    const [orgSector, setOrgSector] = useState('Educación Superior');
    const [orgDescription, setOrgDescription] = useState('');

    // ── Estados de Información Complementaria (Opcional) ──
    const [orgSize, setOrgSize] = useState(ORG_SIZES[0]);
    const [itStaff, setItStaff] = useState(IT_STAFF_OPTIONS[0]);
    const [replacedSoftware, setReplacedSoftware] = useState('');
    const [targetTimeline, setTargetTimeline] = useState(TIMELINE_OPTIONS[0]);
    const [currentPlatforms, setCurrentPlatforms] = useState(PLATFORM_OPTIONS[0]);
    const [mainGoal, setMainGoal] = useState(GOAL_OPTIONS[0]);
    const [isComplementaryOpen, setIsComplementaryOpen] = useState(false);

    const [aiEnabled, setAiEnabled] = useState(false);
    const [dataStorageConsent, setDataStorageConsent] = useState(false);
    const [aiProcessingConsent, setAiProcessingConsent] = useState(true);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

    const [softwareNameError, setSoftwareNameError] = useState<string | null>(null);
    const [orgNameError, setOrgNameError] = useState<string | null>(null);
    const [consentError, setConsentError] = useState<string | null>(null);
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

        if (!dataStorageConsent) {
            setConsentError('Debe autorizar el almacenamiento seguro para fines estadísticos.');
            hasError = true;
        } else if (aiEnabled && !aiProcessingConsent) {
            setConsentError('Debe autorizar el análisis mediante Inteligencia Artificial.');
            hasError = true;
        } else {
            setConsentError(null);
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
            org_size: orgSize === 'Sin indicar' ? '' : orgSize,
            it_staff: itStaff === 'Sin indicar' ? '' : itStaff,
            replaced_software: replacedSoftware.trim(),
            target_timeline: targetTimeline === 'Sin indicar' ? '' : targetTimeline,
            current_platforms: currentPlatforms === 'Sin indicar' ? '' : currentPlatforms,
            main_goal: mainGoal === 'Sin indicar' ? '' : mainGoal,
            ai_enabled: aiEnabled,
            auto_compute_literature: true,
            data_storage_consent: dataStorageConsent,
            ai_processing_consent: aiEnabled ? aiProcessingConsent : false,
            privacy_policy_version: '1.0',
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
                            disabled={
                                isSubmitting ||
                                !softwareName.trim() ||
                                !orgName.trim() ||
                                !dataStorageConsent ||
                                (aiEnabled && !aiProcessingConsent)
                            }
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
                                placeholder="Ej: Hospital General, Alcaldía Municipal, Corporación..."
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

                {/* ── Información complementaria (opcional) ── */}
                <div className="rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setIsComplementaryOpen(!isComplementaryOpen)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--color-bg-elevated)]/50 transition-colors cursor-pointer select-none"
                    >
                        <div>
                            <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                                Información complementaria (opcional)
                            </h4>
                            <p className="text-[11px] text-[var(--color-text-tertiary)] -mt-0.5">
                                No cambia el dictamen.
                            </p>
                        </div>
                        <div className="p-1 text-[var(--color-text-secondary)]">
                            {isComplementaryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    </button>

                    {isComplementaryOpen && (
                        <div className="p-3 pt-2 border-t border-[var(--color-border-subtle)]/60 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
                            {/* Fila 1: Tamaño de la organización | Personal de TI */}
                            <div>
                                <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 truncate">
                                    Tamaño de la organización
                                </label>
                                <select
                                    value={orgSize}
                                    onChange={(e) => setOrgSize(e.target.value)}
                                    className="w-full h-8 px-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    {ORG_SIZES.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 truncate">
                                    Personal de TI
                                </label>
                                <select
                                    value={itStaff}
                                    onChange={(e) => setItStaff(e.target.value)}
                                    className="w-full h-8 px-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    {IT_STAFF_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Fila 2: Software que se reemplaza | Plazo previsto */}
                            <div>
                                <Input
                                    label="Software que se reemplaza"
                                    placeholder="Ej.: Microsoft Office 2019"
                                    value={replacedSoftware}
                                    onChange={(e) => setReplacedSoftware(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 truncate">
                                    Plazo previsto
                                </label>
                                <select
                                    value={targetTimeline}
                                    onChange={(e) => setTargetTimeline(e.target.value)}
                                    className="w-full h-8 px-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    {TIMELINE_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Fila 3: Plataformas actuales | Objetivo principal */}
                            <div>
                                <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 truncate">
                                    Plataformas actuales
                                </label>
                                <select
                                    value={currentPlatforms}
                                    onChange={(e) => setCurrentPlatforms(e.target.value)}
                                    className="w-full h-8 px-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    {PLATFORM_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] mb-1 truncate">
                                    Objetivo principal
                                </label>
                                <select
                                    value={mainGoal}
                                    onChange={(e) => setMainGoal(e.target.value)}
                                    className="w-full h-8 px-2 text-xs bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] rounded-[2px] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    {GOAL_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
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
                            Si la IA se encuentra inactiva, se emplearán las citas bibliográficas base del catálogo metodológico oficial.
                        </span>
                    </div>
                </div>

                {/* ── Seguridad, Privacidad y Consentimiento Informado ── */}
                <div className="p-3 bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] rounded-[4px] space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            Seguridad, Privacidad y Consentimiento
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsPrivacyModalOpen(true)}
                            className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                            <Lock size={11} />
                            <span>Ver Política de Privacidad</span>
                        </button>
                    </div>

                    <div className="space-y-2 pt-1.5 border-t border-[var(--color-border-subtle)] text-xs">
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={dataStorageConsent}
                                onChange={(e) => {
                                    setDataStorageConsent(e.target.checked);
                                    if (consentError) setConsentError(null);
                                }}
                                className="w-4 h-4 mt-0.5 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <span className="text-[12px] text-[var(--color-text-primary)] font-medium leading-tight block">
                                    Autorizo el almacenamiento de los datos técnicos de esta evaluación para fines estadísticos y de investigación. <span className="text-rose-500 font-bold">*</span>
                                </span>
                                <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                    Datos técnicos y de adopción agregados sin recolectar información personal identificable.
                                </span>
                            </div>
                        </label>

                        {aiEnabled && (
                            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
                                <input
                                    type="checkbox"
                                    checked={aiProcessingConsent}
                                    onChange={(e) => {
                                        setAiProcessingConsent(e.target.checked);
                                        if (consentError) setConsentError(null);
                                    }}
                                    className="w-4 h-4 mt-0.5 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[12px] text-[var(--color-text-primary)] font-medium leading-tight block">
                                        Autorizo el análisis de la información funcional y técnica mediante modelos de Inteligencia Artificial para la búsqueda de literatura y asistencia metodológica. <span className="text-rose-500 font-bold">*</span>
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                        Procesamiento con retención cero en Azure OpenAI y Groq bajo estándares empresariales.
                                    </span>
                                </div>
                            </label>
                        )}

                        {consentError && (
                            <p className="text-[11px] text-rose-500 font-medium">
                                {consentError}
                            </p>
                        )}
                    </div>
                </div>
            </form>

            {/* Modal de Política de Privacidad */}
            <PrivacyPolicyModal
                isOpen={isPrivacyModalOpen}
                onClose={() => setIsPrivacyModalOpen(false)}
            />
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
