/**
 * features/publicEvaluation/components/steps/Step0SoftwareRegistration.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Primera Pantalla (Paso 0): Registro integral de software FLOSS e historial local.
 * Diseñada para llenar armónicamente el 100% del alto y ancho disponible del viewport,
 * sin huecos vacíos en la parte inferior ni compresiones forzadas arriba.
 */

import React, { useState, useMemo, useEffect, memo } from 'react';
import { clsx } from 'clsx';
import {
    Package,
    Sparkles,
    ArrowRight,
    History,
    Trash2,
    Play,
    Clock,
    AlertCircle,
    ShieldCheck,
    Lock,
    ChevronDown,
    ChevronUp,
    ArrowLeftRight,
    Share2,
    Copy,
    Search,
    Eye,
} from 'lucide-react';

import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import ConfirmModal from '../../../../components/ui/ConfirmModal';
import PrivacyPolicyModal from '../ui/PrivacyPolicyModal';
import PublicEvaluationCompareModal from '../PublicEvaluationCompareModal';
import useOrganizationStore from '../../../../app/useOrganizationStore';
import type { EvaluationCreateInput } from '../../../../api/evaluationService';
import type { SavedEvaluationItem } from '../../utils/historyStorage';

interface Step0SoftwareRegistrationProps {
    onSubmit: (data: EvaluationCreateInput) => Promise<boolean>;
    isSubmitting?: boolean;
    savedEvaluations: SavedEvaluationItem[];
    initialDraft?: Partial<EvaluationCreateInput> | null;
    onResumeEvaluation: (uuid: string) => void;
    onCloneEvaluation?: (uuid: string) => void;
    onDeleteSavedEvaluation: (uuid: string) => void;
    onClearAllHistory: () => void;
    onShareEvaluation?: (uuid: string) => void;
}

const CATEGORIES = [
    'Base de Datos / Almacenamiento',
    'ERP / Gestión Empresarial',
    'LMS / Plataforma Educativa',
    'Ofimática y Colaboración',
    'Infraestructura y Servidores',
    'Ciberseguridad y Redes',
    'BI y Analítica de Datos',
    'Desarrollo y DevOps',
    'Sistema Operativo',
    'CMS y Web',
    'Otro Software Libre',
];

const SECTORS = [
    'Educación Superior / Universidades',
    'Gobierno / Sector Público',
    'Salud y Hospitales',
    'Banca y Finanzas',
    'Telecomunicaciones',
    'Empresa Privada / Servicios',
    'Industria y Manufactura',
    'Otro',
];

const DEFAULT_ORG_NAME = '';

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

export const Step0SoftwareRegistration: React.FC<Step0SoftwareRegistrationProps> = ({
    onSubmit,
    isSubmitting = false,
    savedEvaluations,
    initialDraft,
    onResumeEvaluation,
    onCloneEvaluation,
    onDeleteSavedEvaluation,
    onClearAllHistory,
    onShareEvaluation,
}) => {
    const { organization } = useOrganizationStore();

    // ── Pestaña activa en móvil y tablet (< lg) ──
    const [mobileTab, setMobileTab] = useState<'form' | 'history'>('form');

    // ── Estados del Formulario ──
    const [softwareName, setSoftwareName] = useState('');
    const [softwareVersion, setSoftwareVersion] = useState('');
    const [softwareCategory, setSoftwareCategory] = useState(CATEGORIES[0]);
    const [softwareRepoUrl, setSoftwareRepoUrl] = useState('');
    const [softwareDescription, setSoftwareDescription] = useState('');

    // null: el usuario aún no editó el campo; se muestra el nombre del store o el valor por defecto.
    const [orgNameDraft, setOrgNameDraft] = useState<string | null>(null);
    const orgName = orgNameDraft ?? organization?.name ?? DEFAULT_ORG_NAME;
    const [orgSector, setOrgSector] = useState(SECTORS[0]);
    const [orgDescription, setOrgDescription] = useState('');

    // ── Estados de Información Complementaria (Opcional) ──
    // En desktop (>= 1280px) inicia abierto para llenar armónicamente el espacio; en móviles/tablets colapsado por defecto.
    const [orgSize, setOrgSize] = useState(ORG_SIZES[0]);
    const [itStaff, setItStaff] = useState(IT_STAFF_OPTIONS[0]);
    const [replacedSoftware, setReplacedSoftware] = useState('');
    const [targetTimeline, setTargetTimeline] = useState(TIMELINE_OPTIONS[0]);
    const [currentPlatforms, setCurrentPlatforms] = useState(PLATFORM_OPTIONS[0]);
    const [mainGoal, setMainGoal] = useState(GOAL_OPTIONS[0]);
    const [isComplementaryOpen, setIsComplementaryOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1280;
        }
        return false;
    });

    const [aiEnabled, setAiEnabled] = useState(true);
    const [dataStorageConsent, setDataStorageConsent] = useState(false);
    const [aiProcessingConsent, setAiProcessingConsent] = useState(true);
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [compareUuids, setCompareUuids] = useState<string[]>([]);
    const [itemToDelete, setItemToDelete] = useState<SavedEvaluationItem | null>(null);
    const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Precargar datos si el usuario solicitó "Re-evaluar / Nueva versión"
    useEffect(() => {
        if (!initialDraft) return;
        setSoftwareName(initialDraft.software_name || '');
        setSoftwareVersion(initialDraft.software_version || '');
        if (initialDraft.software_category && CATEGORIES.includes(initialDraft.software_category)) {
            setSoftwareCategory(initialDraft.software_category);
        }
        setSoftwareRepoUrl(initialDraft.software_repo_url || '');
        setSoftwareDescription(initialDraft.software_description || '');
        if (initialDraft.org_name) {
            setOrgNameDraft(initialDraft.org_name);
        }
        if (initialDraft.org_sector && SECTORS.includes(initialDraft.org_sector)) {
            setOrgSector(initialDraft.org_sector);
        }
        setOrgDescription(initialDraft.org_description || '');
        setOrgSize(initialDraft.org_size || ORG_SIZES[0]);
        setItStaff(initialDraft.it_staff || IT_STAFF_OPTIONS[0]);
        setReplacedSoftware(initialDraft.replaced_software || '');
        setTargetTimeline(initialDraft.target_timeline || TIMELINE_OPTIONS[0]);
        setCurrentPlatforms(initialDraft.current_platforms || PLATFORM_OPTIONS[0]);
        setMainGoal(initialDraft.main_goal || GOAL_OPTIONS[0]);
        if (typeof initialDraft.ai_enabled === 'boolean') {
            setAiEnabled(initialDraft.ai_enabled);
        }
        setMobileTab('form');
    }, [initialDraft]);

    const historyCounts = useMemo(() => {
        const completed = savedEvaluations.filter(
            (e) => e.status === 'completed' || Boolean(e.recommendation)
        ).length;
        return {
            all: savedEvaluations.length,
            completed,
            in_progress: savedEvaluations.length - completed,
        };
    }, [savedEvaluations]);

    const filteredEvaluations = useMemo(() => {
        const query = historySearch.trim().toLowerCase();
        return savedEvaluations.filter((item) => {
            const isComp = item.status === 'completed' || Boolean(item.recommendation);
            if (historyFilter === 'completed' && !isComp) return false;
            if (historyFilter === 'in_progress' && isComp) return false;
            if (!query) return true;
            return (
                item.software_name.toLowerCase().includes(query) ||
                item.org_name.toLowerCase().includes(query) ||
                (item.software_version && item.software_version.toLowerCase().includes(query)) ||
                (item.recommendation && `veredicto ${item.recommendation.toLowerCase()}`.includes(query))
            );
        });
    }, [savedEvaluations, historySearch, historyFilter]);

    const handleToggleCompareUuid = (uuid: string) => {
        setCompareUuids((prev) => {
            if (prev.includes(uuid)) {
                return prev.filter((id) => id !== uuid);
            }
            if (prev.length >= 2) {
                return [prev[1], uuid];
            }
            return [...prev, uuid];
        });
    };

    // RF-IA-01: La IA requiere al menos URL de repositorio o descripción técnica
    const isAIAvailable = useMemo(() => {
        return Boolean(
            softwareRepoUrl.trim() ||
            softwareDescription.trim() ||
            orgDescription.trim()
        );
    }, [softwareRepoUrl, softwareDescription, orgDescription]);

    const isConsentValid = useMemo(() => {
        if (!dataStorageConsent) return false;
        if (isAIAvailable && aiEnabled && !aiProcessingConsent) return false;
        return true;
    }, [dataStorageConsent, isAIAvailable, aiEnabled, aiProcessingConsent]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const cleanSoftware = softwareName.trim();
        const cleanOrg = orgName.trim();

        const newErrors: Record<string, string> = {};
        if (!cleanSoftware) {
            newErrors.softwareName = 'Nombre requerido';
        }
        if (!cleanOrg) {
            newErrors.orgName = 'Organización requerida';
        }
        if (!dataStorageConsent) {
            newErrors.dataStorageConsent = 'Debe autorizar el almacenamiento anónimo de datos para fines estadísticos.';
        }
        if (isAIAvailable && aiEnabled && !aiProcessingConsent) {
            newErrors.aiProcessingConsent = 'Debe autorizar el procesamiento mediante Inteligencia Artificial.';
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
            org_size: orgSize === 'Sin indicar' ? '' : orgSize,
            it_staff: itStaff === 'Sin indicar' ? '' : itStaff,
            replaced_software: replacedSoftware.trim(),
            target_timeline: targetTimeline === 'Sin indicar' ? '' : targetTimeline,
            current_platforms: currentPlatforms === 'Sin indicar' ? '' : currentPlatforms,
            main_goal: mainGoal === 'Sin indicar' ? '' : mainGoal,
            ai_enabled: isAIAvailable ? aiEnabled : false,
            auto_compute_literature: true,
            data_storage_consent: dataStorageConsent,
            ai_processing_consent: (isAIAvailable && aiEnabled) ? aiProcessingConsent : false,
            privacy_policy_version: '1.0',
        };

        await onSubmit(payload);
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat('es-EC', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
            }).format(date);
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="w-full flex-1 min-h-0 lg:h-full flex flex-col lg:overflow-hidden animate-fadeIn">
            {/* ── Segmented Control para Móvil / Tablet (< lg) ── */}
            <div className="flex lg:hidden items-center bg-[var(--color-bg-elevated)] p-1 rounded-[8px] border border-[var(--color-border-default)] mb-2.5 sm:mb-3 shrink-0 shadow-xs">
                <button
                    type="button"
                    data-tour-action="step0-tab-form"
                    onClick={() => setMobileTab('form')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-3 rounded-[6px] text-xs font-bold transition-all cursor-pointer select-none',
                        mobileTab === 'form'
                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                >
                    <Package size={14} className="shrink-0" />
                    <span>Registrar Software</span>
                </button>
                <button
                    type="button"
                    data-tour-action="step0-tab-history"
                    onClick={() => setMobileTab('history')}
                    className={clsx(
                        'flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 px-3 rounded-[6px] text-xs font-bold transition-all cursor-pointer select-none relative',
                        mobileTab === 'history'
                            ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    )}
                >
                    <History size={14} className="shrink-0" />
                    <span>Historial</span>
                    <span
                        className={clsx(
                            'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full leading-none',
                            mobileTab === 'history'
                                ? 'bg-black/25 text-white'
                                : 'bg-[var(--color-bg-page)] text-[var(--color-primary)] border border-[var(--color-border-subtle)]'
                        )}
                    >
                        {savedEvaluations.length}
                    </span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 flex-1 min-h-0 lg:h-full lg:overflow-hidden">
                {/* ── COLUMNA IZQUIERDA: Formulario de Registro (8 de 12 cols en desktop, 1 col en móvil) ── */}
                <div
                    className={clsx(
                        'lg:col-span-8 flex-col min-h-0 lg:h-full lg:overflow-hidden',
                        mobileTab === 'form' ? 'flex flex-1' : 'hidden lg:flex'
                    )}
                >
                    <form
                        onSubmit={handleSubmit}
                        className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-[8px] p-3.5 sm:p-5 lg:p-6 shadow-[var(--shadow-sm)] flex flex-col min-h-0 lg:h-full lg:overflow-hidden"
                    >
                        {/* Cabecera del Formulario */}
                        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-2.5 sm:pb-3 shrink-0 gap-2">
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                                <div className="p-1.5 sm:p-2 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] shrink-0">
                                    <Package size={17} />
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)] truncate">
                                        Registro del Software Candidato (FLOSS)
                                    </h2>
                                    <p className="text-[10px] sm:text-[11px] text-[var(--color-text-tertiary)] -mt-0.5 truncate">
                                        Defina los parámetros del software libre y la organización adoptante
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {savedEvaluations.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setMobileTab('history')}
                                        className="lg:hidden text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer"
                                        title="Ver evaluaciones guardadas en este navegador"
                                    >
                                        {savedEvaluations.length} guardada{savedEvaluations.length > 1 ? 's' : ''}
                                    </button>
                                )}
                                <span className="hidden sm:inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-[3px] bg-[var(--color-bg-page)] text-[var(--color-primary)] border border-[var(--color-border-subtle)]">
                                    Fase Inicial
                                </span>
                            </div>
                        </div>

                        {/* Cuerpo del Formulario que se expande armónicamente */}
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col lg:justify-between py-3 sm:py-4 space-y-3 sm:space-y-3.5 pr-0 sm:pr-1">
                            {/* Bloque 1 y 2: Identificación del Software y Organización */}
                            <div data-tour="step0-software-org" className="space-y-3 shrink-0">
                                {/* Fila 1: Nombre Software, Versión, Categoría */}
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 shrink-0">
                                    <div className="col-span-1 sm:col-span-7 xl:col-span-6">
                                        <Input
                                            label="Nombre del Software"
                                            placeholder="Ej: PostgreSQL, LibreOffice, Odoo..."
                                            value={softwareName}
                                            onChange={(e) => {
                                                 setSoftwareName(e.target.value);
                                                 if (errors.softwareName) setErrors((prev) => ({ ...prev, softwareName: '' }));
                                             }}
                                            error={errors.softwareName}
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="col-span-1 sm:col-span-5 xl:col-span-2">
                                        <Input
                                            label="Versión"
                                            placeholder="16.4 LTS"
                                            value={softwareVersion}
                                            onChange={(e) => setSoftwareVersion(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-1 sm:col-span-12 xl:col-span-4">
                                        <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                            Categoría Funcional <span className="text-[var(--color-danger)]">*</span>
                                        </label>
                                        <select
                                            value={softwareCategory}
                                            onChange={(e) => setSoftwareCategory(e.target.value)}
                                            className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] sm:text-[14px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]"
                                        >
                                            {CATEGORIES.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {cat}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Fila 2: Organización, Sector, Repositorio */}
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 shrink-0">
                                    <div className="col-span-1 sm:col-span-6 xl:col-span-5">
                                        <Input
                                            label="Organización Evaluadora"
                                            placeholder="Nombre de la institución"
                                            value={orgName}
                                            onChange={(e) => {
                                                 setOrgNameDraft(e.target.value);
                                                 if (errors.orgName) setErrors((prev) => ({ ...prev, orgName: '' }));
                                             }}
                                            error={errors.orgName}
                                            required
                                        />
                                    </div>
                                    <div className="col-span-1 sm:col-span-6 xl:col-span-3">
                                        <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                            Sector Institucional <span className="text-[var(--color-danger)]">*</span>
                                        </label>
                                        <select
                                            value={orgSector}
                                            onChange={(e) => setOrgSector(e.target.value)}
                                            className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] sm:text-[14px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] truncate"
                                        >
                                            {SECTORS.map((sec) => (
                                                <option key={sec} value={sec}>
                                                    {sec}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-1 sm:col-span-12 xl:col-span-4">
                                        <Input
                                            label="Repositorio de Código o Sitio Web"
                                            placeholder="https://github.com/..."
                                            value={softwareRepoUrl}
                                            onChange={(e) => setSoftwareRepoUrl(e.target.value)}
                                        />
                                        {/https?:\/\/(www\.)?(github|gitlab)\.com\/[^/]+\/[^/]+/i.test(softwareRepoUrl.trim()) && (
                                            <p className="mt-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 truncate">
                                                ✓ Repositorio detectado · Se auditará licencia OSI, actividad y releases
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Fila 3: Descripciones (Software y Entorno Operativo) */}
                            <div data-tour="step0-descriptions" className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5 flex-1 min-h-[140px] sm:min-h-[120px]">
                                <div className="flex flex-col min-h-[85px] sm:min-h-[90px] h-full">
                                    <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5">
                                        Descripción Técnica y Arquitectura del Software
                                    </label>
                                    <textarea
                                        placeholder="Capacidades principales, arquitectura (cliente-servidor, microservicios, monolito), tecnologías base o dependencias..."
                                        value={softwareDescription}
                                        onChange={(e) => setSoftwareDescription(e.target.value)}
                                        className="w-full flex-1 min-h-[75px] sm:min-h-[80px] text-[13px] font-normal rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] p-2.5 sm:p-3 focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] transition-colors resize-none leading-relaxed"
                                    />
                                </div>
                                <div className="flex flex-col min-h-[85px] sm:min-h-[90px] h-full">
                                    <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5">
                                        Necesidades del Entorno Institucional
                                    </label>
                                    <textarea
                                        placeholder="Infraestructura disponible (cloud u on-premise), volumen de usuarios estimados, criticidad operativa o restricciones..."
                                        value={orgDescription}
                                        onChange={(e) => setOrgDescription(e.target.value)}
                                        className="w-full flex-1 min-h-[75px] sm:min-h-[80px] text-[13px] font-normal rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] p-2.5 sm:p-3 focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] transition-colors resize-none leading-relaxed"
                                    />
                                </div>
                            </div>

                            {/* ── Sección de Información Complementaria (Opcional - Acordeón) ── */}
                            <div data-tour="step0-complementary" className="rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] shrink-0 overflow-hidden shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setIsComplementaryOpen(!isComplementaryOpen)}
                                    className="w-full p-3 sm:p-3.5 flex items-center justify-between text-left hover:bg-[var(--color-bg-elevated)]/60 transition-colors cursor-pointer select-none"
                                >
                                    <div>
                                        <h4 className="text-xs sm:text-[13px] font-bold text-[var(--color-text-primary)]">
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
                                    <div className="p-3 sm:p-3.5 pt-2 border-t border-[var(--color-border-subtle)]/60 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-fadeIn">
                                        {/* Fila 1: Tamaño de la organización | Personal de TI */}
                                        <div>
                                            <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                                Tamaño de la organización
                                            </label>
                                            <select
                                                value={orgSize}
                                                onChange={(e) => setOrgSize(e.target.value)}
                                                className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] cursor-pointer"
                                            >
                                                {ORG_SIZES.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                                Personal de TI
                                            </label>
                                            <select
                                                value={itStaff}
                                                onChange={(e) => setItStaff(e.target.value)}
                                                className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] cursor-pointer"
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
                                            <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                                Plazo previsto
                                            </label>
                                            <select
                                                value={targetTimeline}
                                                onChange={(e) => setTargetTimeline(e.target.value)}
                                                className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] cursor-pointer"
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
                                            <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                                Plataformas actuales
                                            </label>
                                            <select
                                                value={currentPlatforms}
                                                onChange={(e) => setCurrentPlatforms(e.target.value)}
                                                className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] cursor-pointer"
                                            >
                                                {PLATFORM_OPTIONS.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold tracking-tight leading-none text-[var(--color-text-secondary)] select-none mb-1.5 truncate">
                                                Objetivo principal
                                            </label>
                                            <select
                                                value={mainGoal}
                                                onChange={(e) => setMainGoal(e.target.value)}
                                                className="block w-full h-10 px-3.5 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-[4px] text-[13px] leading-tight text-[var(--color-text-primary)] font-medium outline-none transition-all duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] cursor-pointer"
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

                            {/* Bloque de Consentimiento Informado y Privacidad */}
                            <div data-tour="step0-consent" className="p-3 sm:p-3.5 rounded-[6px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-page)] space-y-2.5 shrink-0">
                                <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-primary)]">
                                        <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                                        <span>Seguridad, Privacidad y Consentimiento</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsPrivacyModalOpen(true)}
                                        className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        <Lock size={11} />
                                        <span>Ver Política de Privacidad</span>
                                    </button>
                                </div>

                                <div className="space-y-2 pt-1.5 border-t border-[var(--color-border-subtle)]/70 text-xs">
                                    {/* Checkbox 1: Almacenamiento Estadístico (Obligatorio) */}
                                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={dataStorageConsent}
                                            onChange={(e) => {
                                                setDataStorageConsent(e.target.checked);
                                                if (errors.dataStorageConsent) {
                                                    setErrors((prev) => ({ ...prev, dataStorageConsent: '' }));
                                                }
                                            }}
                                            className="w-4 h-4 mt-0.5 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer shrink-0"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[12px] text-[var(--color-text-primary)] font-medium leading-tight block">
                                                Autorizo el almacenamiento anónimo de los datos técnicos de esta evaluación para fines estadísticos y de investigación académica. <span className="text-rose-500 font-bold">*</span>
                                            </span>
                                            <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                                No se recopilan datos personales (cero PII). La información se almacena de forma agregada.
                                            </span>
                                            {errors.dataStorageConsent && (
                                                <span className="text-[11px] text-rose-500 font-medium block mt-1">
                                                    {errors.dataStorageConsent}
                                                </span>
                                            )}
                                        </div>
                                    </label>

                                    {/* Checkbox 2: Procesamiento por IA (Condicional / Visible cuando IA está activa) */}
                                    {isAIAvailable && aiEnabled && (
                                        <label className="flex items-start gap-2.5 cursor-pointer select-none pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={aiProcessingConsent}
                                                onChange={(e) => {
                                                    setAiProcessingConsent(e.target.checked);
                                                    if (errors.aiProcessingConsent) {
                                                        setErrors((prev) => ({ ...prev, aiProcessingConsent: '' }));
                                                    }
                                                }}
                                                className="w-4 h-4 mt-0.5 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[12px] text-[var(--color-text-primary)] font-medium leading-tight block">
                                                    Autorizo el análisis de la información funcional y técnica mediante modelos de Inteligencia Artificial para la búsqueda de literatura y asistencia metodológica. <span className="text-rose-500 font-bold">*</span>
                                                </span>
                                                <span className="text-[10px] text-[var(--color-text-tertiary)] block mt-0.5">
                                                    Procesado bajo estándares empresariales con retención cero (Zero Data Retention) en Azure OpenAI y Groq.
                                                </span>
                                                {errors.aiProcessingConsent && (
                                                    <span className="text-[11px] text-rose-500 font-medium block mt-1">
                                                        {errors.aiProcessingConsent}
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Barra Inferior: Switch IA y Botón de Inicio */}
                        <div data-tour="step0-submit-bar" className="pt-3 border-t border-[var(--color-border-subtle)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                            {/* Toggle IA */}
                            <div className="flex flex-col gap-0.5 text-xs max-w-lg">
                                <label
                                    htmlFor="ai-toggle-compact"
                                    className="font-bold text-[var(--color-text-primary)] flex items-center gap-1.5 cursor-pointer text-xs select-none"
                                >
                                    <input
                                        type="checkbox"
                                        id="ai-toggle-compact"
                                        checked={aiEnabled}
                                        disabled={!isAIAvailable}
                                        onChange={(e) => setAiEnabled(e.target.checked)}
                                        className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer disabled:cursor-not-allowed shrink-0"
                                    />
                                    <Sparkles size={14} className="text-[var(--color-primary)] shrink-0" />
                                    <span>Activar asistencia IA</span>
                                </label>
                                <p className="text-[10px] text-[var(--color-text-tertiary)] leading-tight pl-5.5">
                                    La IA sugiere valores con su justificación; usted decide cada uno. El dictamen lo calcula solo el motor de GUIOS.
                                </p>

                                {!isAIAvailable && (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium pl-5.5 pt-0.5">
                                        <AlertCircle size={12} className="shrink-0" />
                                        <span>(Ingrese URL o descripción para activar IA)</span>
                                    </span>
                                )}
                            </div>

                            {/* Botón Comenzar */}
                            <Button
                                type="submit"
                                variant="primary"
                                size="md"
                                disabled={isSubmitting || !isConsentValid}
                                className="w-full sm:w-auto min-h-[42px] sm:min-h-[38px] flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wider shadow-sm shrink-0"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Inicializando Catálogo...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Comenzar Evaluación</span>
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>

                {/* ── COLUMNA DERECHA: Historial en LocalStorage (4 de 12 cols en desktop, 1 col en móvil) ── */}
                <div
                    className={clsx(
                        'lg:col-span-4 flex-col min-h-0 lg:h-full lg:overflow-hidden',
                        mobileTab === 'history' ? 'flex flex-1' : 'hidden lg:flex'
                    )}
                >
                    <div data-tour="step0-history-panel" className="bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-[8px] p-4 sm:p-5 shadow-[var(--shadow-sm)] flex flex-col h-full min-h-0 overflow-hidden">
                        {/* Cabecera del Historial */}
                        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] pb-3 shrink-0 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <History size={16} className="text-[var(--color-primary)] shrink-0" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)] truncate">
                                    Evaluaciones Guardadas
                                </h3>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                {savedEvaluations.length >= 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsCompareModalOpen(true)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)] hover:text-[var(--color-text-on-primary)] text-[10px] font-bold transition-colors cursor-pointer"
                                        title="Comparar dos evaluaciones guardadas lado a lado"
                                    >
                                        <ArrowLeftRight size={11} />
                                        <span>
                                            Comparar{compareUuids.length > 0 ? ` (${compareUuids.length}/2)` : ''}
                                        </span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setMobileTab('form')}
                                    className="lg:hidden text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                    + Nueva
                                </button>
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-[3px] bg-[var(--color-bg-page)] text-[var(--color-primary)] border border-[var(--color-border-subtle)]">
                                    {savedEvaluations.length}
                                </span>
                            </div>
                        </div>

                        {/* Buscador y Filtros Rápidos del Historial */}
                        {savedEvaluations.length > 0 && (
                            <div className="pt-2.5 space-y-2 shrink-0">
                                {savedEvaluations.length >= 2 && (
                                    <div className="relative">
                                        <Search
                                            size={12}
                                            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"
                                        />
                                        <input
                                            type="text"
                                            value={historySearch}
                                            onChange={(e) => setHistorySearch(e.target.value)}
                                            placeholder="Buscar software u organización..."
                                            className="w-full h-7.5 pl-7 pr-2.5 rounded-[5px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center gap-1 text-[10px] font-mono">
                                    <button
                                        type="button"
                                        onClick={() => setHistoryFilter('all')}
                                        className={clsx(
                                            'px-2 py-0.5 rounded-[4px] font-semibold transition-all cursor-pointer border',
                                            historyFilter === 'all'
                                                ? 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-[var(--color-primary)]/30'
                                                : 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                                        )}
                                    >
                                        Todas ({historyCounts.all})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHistoryFilter('completed')}
                                        className={clsx(
                                            'px-2 py-0.5 rounded-[4px] font-semibold transition-all cursor-pointer border',
                                            historyFilter === 'completed'
                                                ? 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-[var(--color-primary)]/30'
                                                : 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                                        )}
                                    >
                                        Con dictamen ({historyCounts.completed})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHistoryFilter('in_progress')}
                                        className={clsx(
                                            'px-2 py-0.5 rounded-[4px] font-semibold transition-all cursor-pointer border',
                                            historyFilter === 'in_progress'
                                                ? 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-[var(--color-primary)]/30'
                                                : 'bg-[var(--color-bg-page)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                                        )}
                                    >
                                        En curso ({historyCounts.in_progress})
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Cuerpo del Historial (Llena armónicamente la altura en desktop, scroll en móvil) */}
                        {savedEvaluations.length > 0 ? (
                            <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 my-2.5 pr-1">
                                {filteredEvaluations.length > 0 ? (
                                    filteredEvaluations.map((item) => {
                                        const hasVerdict = item.status === 'completed' || Boolean(item.recommendation);
                                        return (
                                            <div
                                                key={item.uuid}
                                                className="p-3 rounded-[6px] bg-[var(--color-bg-page)] border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/50 transition-all space-y-2"
                                            >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate flex items-center gap-1.5">
                                                        <span>{item.software_name}</span>
                                                        {item.software_version && (
                                                            <span className="text-[9px] font-mono px-1 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] border border-[var(--color-border-subtle)]">
                                                                v{item.software_version}
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                                        {item.org_name}
                                                    </p>
                                                </div>

                                                {/* Badge Veredicto o Paso */}
                                                {item.recommendation ? (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] font-mono uppercase shrink-0 ${item.recommendation === 'A'
                                                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                            : item.recommendation === 'B'
                                                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                                        }`}>
                                                        Veredicto {item.recommendation}
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-[3px] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border border-[var(--color-primary)]/25 font-mono uppercase shrink-0">
                                                        Paso {item.step}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-[var(--color-text-tertiary)] pt-1.5 border-t border-[var(--color-border-subtle)]/60">
                                                <span className="flex items-center gap-1 text-[10px]">
                                                    <Clock size={11} />
                                                    <span>{formatDate(item.updated_at)}</span>
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    {savedEvaluations.length >= 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleCompareUuid(item.uuid)}
                                                            className={clsx(
                                                                'px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1',
                                                                compareUuids.includes(item.uuid)
                                                                    ? 'bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)] border-[var(--color-primary)]/40'
                                                                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
                                                            )}
                                                            title="Seleccionar para comparar"
                                                        >
                                                            <ArrowLeftRight size={10} />
                                                            <span>
                                                                {compareUuids.includes(item.uuid)
                                                                    ? `Comp. #${compareUuids.indexOf(item.uuid) + 1}`
                                                                    : 'Comparar'}
                                                            </span>
                                                        </button>
                                                    )}

                                                    {onCloneEvaluation && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onCloneEvaluation(item.uuid)}
                                                            className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft-bg)] transition-colors cursor-pointer"
                                                            title="Re-evaluar o evaluar nueva versión precargando los datos de este software y organización"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    )}

                                                    {onShareEvaluation && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onShareEvaluation(item.uuid)}
                                                            className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-soft-bg)] transition-colors cursor-pointer"
                                                            title="Copiar enlace directo a esta evaluación"
                                                        >
                                                            <Share2 size={12} />
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => setItemToDelete(item)}
                                                        className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                        title="Eliminar del almacenamiento local"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => onResumeEvaluation(item.uuid)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[var(--color-primary)] text-[var(--color-text-on-primary)] text-[10px] font-bold hover:bg-[var(--color-primary)]/90 transition-all cursor-pointer shadow-xs"
                                                        title={hasVerdict ? 'Ver evaluación y resultados del dictamen' : 'Reanudar evaluación en curso'}
                                                    >
                                                        {hasVerdict ? (
                                                            <>
                                                                <Eye size={11} />
                                                                <span>Ver</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play size={10} fill="currentColor" />
                                                                <span>Reanudar</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                                ) : (
                                    <div className="p-5 text-center border border-dashed border-[var(--color-border-subtle)] rounded-[6px] bg-[var(--color-bg-page)]/40 space-y-2">
                                        <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                            Sin resultados para este filtro
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHistorySearch('');
                                                setHistoryFilter('all');
                                            }}
                                            className="text-[11px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                                        >
                                            Mostrar todas las evaluaciones
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-3 border border-dashed border-[var(--color-border-subtle)] rounded-[6px] bg-[var(--color-bg-page)]/40 space-y-2.5 min-h-[160px]">
                                <div className="w-12 h-12 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-tertiary)] shadow-xs">
                                    <History size={22} />
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-[var(--color-text-primary)]">
                                    Sin evaluaciones guardadas
                                </p>
                                <p className="text-xs text-[var(--color-text-tertiary)] max-w-[260px] leading-relaxed">
                                    Las evaluaciones iniciadas en este navegador se guardan automáticamente para que pueda reanudarlas en cualquier momento.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setMobileTab('form')}
                                    className="inline-flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[var(--color-primary)] text-[var(--color-text-on-primary)] text-xs font-bold hover:bg-[var(--color-primary)]/90 transition-all cursor-pointer shadow-xs mt-2"
                                >
                                    <Package size={13} />
                                    <span>Registrar una evaluación</span>
                                </button>
                            </div>
                        )}

                        {/* Pie del Historial */}
                        <div className="pt-2.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)] shrink-0">
                            <span>Almacenamiento local del navegador</span>
                            {savedEvaluations.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setIsClearAllModalOpen(true)}
                                    className="font-semibold text-rose-500 hover:underline cursor-pointer"
                                >
                                    Limpiar todo
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación para Eliminar una Evaluación Guardada */}
            <ConfirmModal
                isOpen={Boolean(itemToDelete)}
                onClose={() => setItemToDelete(null)}
                onConfirm={() => {
                    if (itemToDelete) {
                        onDeleteSavedEvaluation(itemToDelete.uuid);
                        setItemToDelete(null);
                    }
                }}
                variant="danger"
                title="Eliminar evaluación del historial local"
                message={
                    itemToDelete
                        ? `¿Deseas quitar la evaluación de "${itemToDelete.software_name}" (${itemToDelete.org_name}) del historial guardado en este navegador?`
                        : ''
                }
                cancelText="Cancelar"
                confirmText="Sí, Eliminar"
            />

            {/* Modal de Confirmación para Limpiar Todo el Historial */}
            <ConfirmModal
                isOpen={isClearAllModalOpen}
                onClose={() => setIsClearAllModalOpen(false)}
                onConfirm={() => {
                    setIsClearAllModalOpen(false);
                    onClearAllHistory();
                }}
                variant="danger"
                title="Limpiar todo el historial local"
                message={`¿Estás seguro de que deseas borrar las ${savedEvaluations.length} evaluaciones guardadas en el almacenamiento local de este navegador?`}
                cancelText="Cancelar"
                confirmText="Sí, Limpiar Historial"
            />

            {/* Modal de Política de Privacidad y Tratamiento de Datos */}
            <PrivacyPolicyModal
                isOpen={isPrivacyModalOpen}
                onClose={() => setIsPrivacyModalOpen(false)}
            />

            {/* Modal Comparador de Evaluaciones Guardadas */}
            <PublicEvaluationCompareModal
                isOpen={isCompareModalOpen}
                onClose={() => setIsCompareModalOpen(false)}
                savedEvaluations={savedEvaluations}
                initialUuid1={compareUuids[0]}
                initialUuid2={compareUuids[1]}
                onResumeEvaluation={onResumeEvaluation}
            />
        </div>
    );
};

export default memo(Step0SoftwareRegistration);
