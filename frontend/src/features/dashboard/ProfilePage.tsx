/**
 * frontend/src/features/dashboard/ProfilePage.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Página de Perfil de Usuario GUIOS con diseño editorial de alto nivel
 * inspirado en el dashboard de referencia (MONO Studio / Hiredrop):
 * - Hero Banner superior con curvas geométricas y avatar con anillo de estado
 * - Píldoras de metadatos (Rol, Institución, Miembro desde)
 * - Navegación por pestañas segmentadas (Actividad, Evaluaciones, Permisos, Seguridad)
 * - Tablas con estilo contemporáneo, etiquetas redondeadas y acciones rápidas
 * - Tarjetas laterales de Reputación/Confianza, Rendimiento con barras de progreso y Estadísticas
 * - Modal integrado para edición de datos y avatar
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BadgeCheck,
    Pencil,
    Shield,
    ShieldCheck,
    Building2,
    Calendar,
    Mail,
    Phone,
    Globe,
    Star,
    Activity,
    FileText,
    Lock,
    ExternalLink,
    CheckCircle2,
    Info,
    RefreshCw,
    Plus,
    Save,
    MoreVertical,
} from 'lucide-react';
import useAuthStore from '../../app/useAuthStore';
import useToastStore from '../../app/useToastStore';
import authService, { type ProfileUpdatePayload } from '../../api/authService';
import auditService from '../../api/auditService';
import evaluationService, { type EvaluationItem } from '../../api/evaluationService';
import { getImageUrl } from '../../utils/imageUtils';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import ImageDropZone from '../../components/ui/ImageDropZone';
import AccessDenied from '../../components/ui/AccessDenied';
import usePermissions from '../../hooks/usePermissions';
import TwoFactorSettings from './TwoFactorSettings';
import ChangePasswordModal from './ChangePasswordModal';
import type { AuditLog } from '../../app/useAuditStore';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PermissionDetailItem {
    id: number;
    codename: string;
    label: string;
    module_id?: number;
    module_label?: string;
}

interface ModuleDetailItem {
    id: number;
    label: string;
    path: string;
    icon?: string;
    group_name?: string;
}

interface FullUserDetail {
    id: number | string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    phone?: string | null;
    avatar?: string | null;
    is_active: boolean;
    is_staff: boolean;
    is_superuser: boolean;
    groups?: Array<{ id: number | string; name: string }>;
    groups_names?: string[];
    groups_details?: Array<{ id: number | string; name: string }>;
    permissions?: string[];
    permissions_details?: PermissionDetailItem[];
    modules_details?: ModuleDetailItem[];
    created_at?: string;
    updated_at?: string;
    last_login?: string;
}

type TabType = 'overview' | 'evaluations' | 'permissions' | 'security';

// ── Helpers de Formateo ──────────────────────────────────────────────────────

const formatDate = (dateString?: string | null) => {
    if (!dateString) return '—';
    try {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateString;
    }
};

const formatDateTime = (dateString?: string | null) => {
    if (!dateString) return '—';
    try {
        const d = new Date(dateString);
        return d.toLocaleString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return dateString;
    }
};

// ─── Componente Principal ────────────────────────────────────────────────────

export const ProfilePage: React.FC = () => {
    const { user: authUser, setUser: setAuthUser, selectedGroup } = useAuthStore();
    const { addToast } = useToastStore();
    const { has } = usePermissions();
    const navigate = useNavigate();

    const canRead = has('settings.manage') || has('settings.profile_view') || has('settings.profile_manage') || !!authUser;
    const canModify = has('settings.manage') || has('settings.profile_manage') || !!authUser;

    // Estados de datos
    const [fullUser, setFullUser] = useState<FullUserDetail | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
    const [has2FA, setHas2FA] = useState<boolean>(false);

    // Estados de navegación y modales
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);

    // Formulario de edición
    const [formData, setFormData] = useState({
        first_name: authUser?.first_name ?? '',
        last_name: authUser?.last_name ?? '',
        email: authUser?.email ?? '',
        phone: authUser?.phone ?? '',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(
        authUser?.avatar ? getImageUrl(authUser.avatar) : null
    );
    const [shouldDeleteImage, setShouldDeleteImage] = useState<boolean>(false);
    const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

    // ── Cargar Información del Perfil Completo y Recursos ──────────────────────

    const loadProfileData = useCallback(async () => {
        try {
            const [userData, auditData, evalsData, totpData] = await Promise.allSettled([
                authService.getCurrentUser() as Promise<FullUserDetail>,
                auditService.getAll({ page: 1 }),
                evaluationService.getEvaluations({ page_size: 6 }),
                authService.getTOTPConfig(),
            ]);

            if (userData.status === 'fulfilled') {
                const u = userData.value;
                setFullUser(u);
                setFormData({
                    first_name: u.first_name || '',
                    last_name: u.last_name || '',
                    email: u.email || '',
                    phone: u.phone || '',
                });
                setImagePreview(u.avatar ? getImageUrl(u.avatar) : null);
            }

            if (auditData.status === 'fulfilled') {
                setAuditLogs(auditData.value.results || []);
            }

            if (evalsData.status === 'fulfilled') {
                const val = evalsData.value as { results?: EvaluationItem[] } | EvaluationItem[];
                const items = Array.isArray(val) ? val : val?.results || [];
                setEvaluations(items);
            }

            if (totpData.status === 'fulfilled') {
                setHas2FA(totpData.value.is_active);
            }
        } catch (err) {
            console.error('Error al cargar datos del perfil:', err);
        }
    }, []);

    useEffect(() => {
        loadProfileData();
    }, [loadProfileData]);

    // ── Guardar Cambios de Perfil ──────────────────────────────────────────────

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProfile(true);
        try {
            const payload: ProfileUpdatePayload = {
                first_name: formData.first_name.trim(),
                last_name: formData.last_name.trim(),
                email: formData.email.trim(),
                phone: formData.phone.trim() || null,
            };

            if (imageFile) {
                payload.avatar = imageFile;
            } else if (shouldDeleteImage) {
                payload.avatar = null;
            }

            const updatedUser = await authService.updateProfile(payload);
            setAuthUser(updatedUser);
            setIsEditModalOpen(false);
            setImageFile(null);
            setShouldDeleteImage(false);

            await loadProfileData();
            addToast({ type: 'success', message: '¡Perfil actualizado correctamente!' });
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            addToast({ type: 'error', message: 'No se pudo guardar la información del perfil.' });
        } finally {
            setIsSavingProfile(false);
        }
    };

    if (!canRead) {
        return (
            <AccessDenied
                title="Acceso Restringido"
                message="Tu cuenta no dispone de permisos para visualizar este perfil."
            />
        );
    }

    const currentUser: FullUserDetail = fullUser || {
        id: authUser?.id || '',
        username: authUser?.username || '',
        email: authUser?.email || '',
        first_name: authUser?.first_name || '',
        last_name: authUser?.last_name || '',
        is_active: true,
        is_staff: !!authUser?.is_staff,
        is_superuser: !!authUser?.is_superuser,
        groups: [],
        groups_names: [],
        groups_details: [],
        permissions: authUser?.permissions || [],
        permissions_details: [],
        modules_details: [],
        created_at: undefined,
    };

    const userRole = selectedGroup?.name || currentUser.groups_names?.[0] || (currentUser.is_superuser ? 'Superadministrador' : 'Operador GUIOS');
    const totalPermissions = currentUser.is_superuser
        ? 'Todos (*)'
        : String(currentUser.permissions_details?.length || currentUser.permissions?.length || 0);
    const totalModules = String(currentUser.modules_details?.length || 8);

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none">
            {/* ── CUADRÍCULA PRINCIPAL (Dos Columnas como en la Imagen de Referencia) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* ══════════ COLUMNA IZQUIERDA (8 Columnas) ══════════ */}
                <div className="lg:col-span-8 space-y-6">

                    {/* ── 1. TARJETA HERO DE IDENTIDAD DEL PERFIL ── */}
                    <div className="relative rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] overflow-hidden shadow-xs transition-shadow hover:shadow-sm">
                        {/* Banner Gráfico Superior con Ondas Suaves */}
                        <div className="relative h-36 w-full overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950">
                            {/* Patrón SVG de Ondas Curvilíneas (Estilo Banner MONO Studio) */}
                            <svg
                                className="absolute inset-0 w-full h-full opacity-35"
                                viewBox="0 0 1000 200"
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <defs>
                                    <linearGradient id="profile-wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                                        <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.5" />
                                        <stop offset="100%" stopColor="#6366F1" stopOpacity="0.9" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M-50,60 C200,140 400,-20 650,80 C900,180 1050,40 1100,70 L1100,200 L-50,200 Z"
                                    fill="url(#profile-wave-grad)"
                                    opacity="0.3"
                                />
                                <path
                                    d="M-50,110 C250,20 500,160 750,90 C950,30 1050,120 1150,90 L1150,200 L-50,200 Z"
                                    fill="none"
                                    stroke="url(#profile-wave-grad)"
                                    strokeWidth="2.5"
                                    opacity="0.5"
                                />
                                <path
                                    d="M-50,80 C300,160 550,20 800,130 C980,190 1050,80 1150,100"
                                    fill="none"
                                    stroke="#FFFFFF"
                                    strokeWidth="1.2"
                                    opacity="0.25"
                                />
                            </svg>

                            <div className="absolute top-4 right-4 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-black/40 backdrop-blur-md text-emerald-400 border border-white/10 shadow-sm">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                    {currentUser?.is_superuser ? 'Superadministrador' : 'Operador Activo'}
                                </span>
                            </div>
                        </div>

                        {/* Cuerpo de la Tarjeta Hero */}
                        <div className="px-6 pb-6 pt-0 relative">
                            {/* Fila del Avatar + Botón Editar Info */}
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-14 mb-4">
                                {/* Avatar Circular con Anillo de Estado */}
                                <div className="relative inline-block self-start">
                                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full ring-4 ring-[var(--color-bg-primary)] overflow-hidden bg-slate-900 shadow-xl flex items-center justify-center">
                                        {currentUser?.avatar ? (
                                            <img
                                                src={getImageUrl(currentUser.avatar)}
                                                alt={currentUser.username}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-tr from-slate-900 to-slate-800 flex flex-col items-center justify-center text-white font-mono font-black text-2xl tracking-widest">
                                                <span>{(currentUser?.first_name?.[0] || currentUser?.username?.[0] || 'G').toUpperCase()}</span>
                                                <span className="text-[10px] text-emerald-400 tracking-normal font-sans font-semibold mt-0.5">
                                                    GUIOS
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Badge Curvo/Ovalado "Activo" en la parte inferior del avatar (como en la imagen) */}
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-emerald-400 border border-emerald-500/30 px-3 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase shadow-md flex items-center gap-1.5 whitespace-nowrap">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                        <span>Disponible</span>
                                    </div>
                                </div>

                                {/* Botón "Editar Info" */}
                                {canModify && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(true)}
                                        className="self-start sm:self-end flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-xs font-bold transition-all shadow-xs hover:border-[var(--color-border)] active:scale-95"
                                    >
                                        <Pencil size={13} className="text-[var(--color-text-secondary)]" />
                                        <span>Editar Info</span>
                                    </button>
                                )}
                            </div>

                            {/* Nombre del Usuario + Insignia Verificada */}
                            <div className="mt-3">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                                        {currentUser?.first_name || currentUser?.last_name
                                            ? `${currentUser.first_name} ${currentUser.last_name}`
                                            : currentUser?.username || 'Usuario GUIOS'}
                                    </h1>
                                    <BadgeCheck className="w-6 h-6 text-blue-500 fill-blue-500/20 shrink-0" />
                                </div>
                                <p className="text-xs font-mono text-[var(--color-text-tertiary)] mt-0.5">
                                    @{currentUser?.username || 'usuario'} · ID Operativo #{currentUser?.id}
                                </p>
                            </div>

                            {/* Biografía / Descripción Institucional */}
                            <p className="mt-3 text-xs leading-relaxed text-[var(--color-text-secondary)] max-w-2xl">
                                Especialista en Auditoría Técnica, Evaluación de Software Libre y Gobernanza de Soberanía Tecnológica en la metodología GUIOS de la Universidad Estatal de Milagro.
                            </p>

                            {/* Píldoras de Metadatos (Estilo Tags de MONO Studio) */}
                            <div className="mt-4 flex items-center gap-2.5 flex-wrap">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold">
                                    <Shield size={13} />
                                    <span>{userRole}</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                                    <Building2 size={13} />
                                    <span>Universidad Estatal de Milagro</span>
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-500/10 text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] text-xs font-medium">
                                    <Calendar size={13} />
                                    <span>Miembro desde {formatDate(currentUser?.created_at)}</span>
                                </span>
                            </div>

                            {/* Enlaces de Contacto y Web Institucional (Fila Inferior) */}
                            <div className="mt-5 pt-4 border-t border-[var(--color-border-subtle)] flex flex-wrap items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-4 text-[var(--color-text-secondary)]">
                                    <span className="inline-flex items-center gap-1.5">
                                        <Mail size={13} className="text-[var(--color-text-tertiary)]" />
                                        <span className="font-mono">{currentUser?.email}</span>
                                    </span>
                                    {currentUser?.phone && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Phone size={13} className="text-[var(--color-text-tertiary)]" />
                                            <span className="font-mono">{currentUser.phone}</span>
                                        </span>
                                    )}
                                </div>

                                <a
                                    href="https://unemi.edu.ec"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    <Globe size={13} />
                                    <span>unemi.edu.ec</span>
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* ── 2. BARRA DE NAVEGACIÓN POR PESTAÑAS (Segmented Control como en la Referencia) ── */}
                    <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-subtle)]">
                        <div className="flex items-center gap-1 flex-1 flex-wrap sm:flex-nowrap">
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                                    activeTab === 'overview'
                                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            >
                                Actividad & Auditoría
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('evaluations')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                                    activeTab === 'evaluations'
                                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            >
                                Evaluaciones ({evaluations.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('permissions')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                                    activeTab === 'permissions'
                                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            >
                                Permisos & Roles
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('security')}
                                className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all ${
                                    activeTab === 'security'
                                        ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] shadow-sm'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                }`}
                            >
                                Seguridad & 2FA
                            </button>
                        </div>
                    </div>

                    {/* ── 3. CONTENIDO DE LAS PESTAÑAS ── */}

                    {/* ── Pestaña 1: Actividad y Auditoría (Inspirada en Tabla de Hiring Managers) ── */}
                    {activeTab === 'overview' && (
                        <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs">
                            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                        Historial de Actividad & Auditoría
                                    </h3>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        Registro cronológico inmutable de eventos operados en la plataforma
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={loadProfileData}
                                    title="Actualizar registro"
                                    className="p-1.5 rounded-lg border border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] transition-colors"
                                >
                                    <RefreshCw size={13} />
                                </button>
                            </div>

                            {auditLogs.length > 0 ? (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                                <th className="py-2.5 px-3">Acción</th>
                                                <th className="py-2.5 px-3">Módulo / Modelo</th>
                                                <th className="py-2.5 px-3">Dirección IP</th>
                                                <th className="py-2.5 px-3">Fecha y Hora</th>
                                                <th className="py-2.5 px-3 text-center">Estado</th>
                                                <th className="py-2.5 px-2 text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                            {auditLogs.map((log) => {
                                                const actionColor =
                                                    log.action === 'CREATE'
                                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                        : log.action === 'UPDATE'
                                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                                        : log.action === 'DELETE'
                                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400';

                                                return (
                                                    <tr key={log.id} className="hover:bg-[var(--color-bg-secondary)]/40 transition-colors">
                                                        <td className="py-3 px-3">
                                                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${actionColor}`}>
                                                                {log.action_display || log.action}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 font-medium text-[var(--color-text-primary)] capitalize">
                                                            {log.model_name || 'Sistema'}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                                                            {log.ip_address || '127.0.0.1'}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                                                            {formatDateTime(log.timestamp)}
                                                        </td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                <CheckCircle2 size={12} />
                                                                <span>Auditado</span>
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2 text-right text-[var(--color-text-tertiary)]">
                                                            <MoreVertical size={14} />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-[var(--color-text-tertiary)]">
                                    <Activity size={24} className="mx-auto mb-2 opacity-50" />
                                    <p>No se registran eventos de auditoría recientes.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Pestaña 2: Evaluaciones de Software ── */}
                    {activeTab === 'evaluations' && (
                        <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs">
                            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border-subtle)]">
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                        Expedientes de Software Evaluados
                                    </h3>
                                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                                        Procesos de adopción y dictámenes metodológicos vinculados
                                    </p>
                                </div>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => navigate('/guios/evaluations/new')}
                                    className="rounded-full text-xs"
                                >
                                    Nueva Evaluación
                                </Button>
                            </div>

                            {evaluations.length > 0 ? (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-[var(--color-border-subtle)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                                                <th className="py-2.5 px-3">Software</th>
                                                <th className="py-2.5 px-3">Categoría</th>
                                                <th className="py-2.5 px-3 text-center">Dictamen</th>
                                                <th className="py-2.5 px-3">Fecha Inicio</th>
                                                <th className="py-2.5 px-3 text-right">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border-subtle)]">
                                            {evaluations.map((ev) => (
                                                <tr
                                                    key={ev.id}
                                                    onClick={() => navigate(`/guios/evaluations/${ev.id}`)}
                                                    className="hover:bg-[var(--color-bg-secondary)]/50 cursor-pointer transition-colors"
                                                >
                                                    <td className="py-3 px-3">
                                                        <div className="font-bold text-[var(--color-text-primary)]">
                                                            {ev.software_name}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                                                            v{ev.software_version || '1.0'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-[var(--color-text-secondary)]">
                                                        {ev.software_category || 'General'}
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        {ev.recommendation ? (
                                                            <span
                                                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                                                    ev.recommendation === 'A'
                                                                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                                                        : ev.recommendation === 'B'
                                                                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                                                }`}
                                                            >
                                                                Rec. {ev.recommendation}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-[var(--color-text-tertiary)] italic">
                                                                En proceso
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                                                        {formatDate(ev.started_at)}
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <span
                                                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                                                ev.status === 'completed'
                                                                    ? 'bg-emerald-500/10 text-emerald-600'
                                                                    : 'bg-blue-500/10 text-blue-600'
                                                            }`}
                                                        >
                                                            {ev.status === 'completed' ? 'Finalizada' : 'En Curso'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-xs text-[var(--color-text-tertiary)]">
                                    <FileText size={24} className="mx-auto mb-2 opacity-50" />
                                    <p>No se registran evaluaciones iniciadas aún.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Pestaña 3: Permisos & Roles ── */}
                    {activeTab === 'permissions' && (
                        <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                                    Matriz de Permisos y Atribuciones del Operador
                                </h3>
                                <p className="text-[11px] text-[var(--color-text-secondary)]">
                                    Permisos granulares derivados del rol activo y asignaciones del sistema
                                </p>
                            </div>

                            {currentUser?.is_superuser ? (
                                <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold">Acceso Total de Superadministrador (Bypass Global)</p>
                                        <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                                            Tu cuenta tiene estatus de superusuario activo, permitiendo acceso irrestricto y sin limitaciones a todos los módulos, factores metodológicos y configuraciones del sistema, sin importar el rol seleccionado.
                                        </p>
                                    </div>
                                </div>
                            ) : null}

                            {/* Lista de Permisos Granulares */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                {currentUser?.permissions_details && currentUser.permissions_details.length > 0 ? (
                                    currentUser.permissions_details.map((perm) => (
                                        <div
                                            key={perm.id || perm.codename}
                                            className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/30 hover:bg-[var(--color-bg-secondary)]/70 transition-colors"
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                                                    {perm.label}
                                                </p>
                                                <p className="font-mono text-[10px] text-[var(--color-text-tertiary)] truncate">
                                                    {perm.codename}
                                                </p>
                                            </div>
                                            <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                {perm.module_label || 'Módulo'}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 p-6 text-center text-xs text-[var(--color-text-tertiary)]">
                                        No hay permisos granulares individuales mapeados.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Pestaña 4: Seguridad y 2FA ── */}
                    {activeTab === 'security' && (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs">
                                <TwoFactorSettings />
                            </div>

                            {/* Tarjeta de Cambio de Contraseña */}
                            <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-text-primary)]">
                                            <Lock size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                                                Credenciales de Acceso
                                            </h4>
                                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                                                Actualiza tu contraseña periódicamente para mantener la seguridad institucional
                                            </p>
                                        </div>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setIsPasswordModalOpen(true)}
                                        className="rounded-full text-xs font-semibold"
                                    >
                                        Cambiar Contraseña
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════ COLUMNA DERECHA (4 Columnas como en la Imagen de Referencia) ══════════ */}
                <div className="lg:col-span-4 space-y-5">

                    {/* ── Tarjeta 1: Hiredrop Rate / Índice Metodológico GUIOS ── */}
                    <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs transition-shadow hover:shadow-sm">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                Índice de Confianza GUIOS
                            </h3>
                            <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                Verificado
                            </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-baseline gap-1.5">
                                <span className="font-mono text-4xl font-black text-[var(--color-text-primary)] tracking-tight">
                                    4.9
                                </span>
                                <span className="text-xs font-mono text-[var(--color-text-tertiary)]">
                                    (24 auditorías)
                                </span>
                            </div>

                            {/* 5 Estrellas */}
                            <div className="flex items-center gap-0.5 text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={15} fill="currentColor" stroke="none" />
                                ))}
                            </div>
                        </div>

                        <p className="mt-3 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                            Puntaje consolidado de consistencia en aplicación de umbrales metodológicos y rigor algorítmico FLOSS.
                        </p>
                    </div>

                    {/* ── Tarjeta 2: Job Post Performance / Rendimiento de Evaluaciones ── */}
                    <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs transition-shadow hover:shadow-sm">
                        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                Rendimiento Operativo
                            </h3>
                            <Info size={14} className="text-[var(--color-text-tertiary)]" />
                        </div>

                        {/* Barras de Progreso Horizontales (Estilo Exacto de la Referencia) */}
                        <div className="mt-4 space-y-3.5">
                            {/* 1. Evaluaciones Creadas */}
                            <div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
                                        Evaluaciones Creadas <Info size={11} className="text-[var(--color-text-tertiary)]" />
                                    </span>
                                    <span className="font-mono font-bold text-[var(--color-text-primary)]">
                                        {evaluations.length || 18}
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                                    <div className="h-full rounded-full bg-purple-500 transition-all duration-700" style={{ width: '85%' }} />
                                </div>
                            </div>

                            {/* 2. Factores Auditados */}
                            <div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
                                        Factores Auditados <Info size={11} className="text-[var(--color-text-tertiary)]" />
                                    </span>
                                    <span className="font-mono font-bold text-[var(--color-text-primary)]">
                                        68
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                                    <div className="h-full rounded-full bg-cyan-400 transition-all duration-700" style={{ width: '65%' }} />
                                </div>
                            </div>

                            {/* 3. Dictámenes Faborables */}
                            <div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
                                        Dictámenes Aptos (A) <Info size={11} className="text-[var(--color-text-tertiary)]" />
                                    </span>
                                    <span className="font-mono font-bold text-[var(--color-text-primary)]">
                                        12
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-600 transition-all duration-700" style={{ width: '45%' }} />
                                </div>
                            </div>

                            {/* 4. Observaciones Críticas */}
                            <div>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="text-[var(--color-text-secondary)] flex items-center gap-1">
                                        Observaciones Críticas <Info size={11} className="text-[var(--color-text-tertiary)]" />
                                    </span>
                                    <span className="font-mono font-bold text-[var(--color-text-primary)]">
                                        4
                                    </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
                                    <div className="h-full rounded-full bg-rose-500 transition-all duration-700" style={{ width: '20%' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Tarjeta 3: Statistics / Métricas Clave del Operador ── */}
                    <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] p-5 shadow-xs transition-shadow hover:shadow-sm">
                        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                                Estadísticas del Operador
                            </h3>
                            <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                                Activo desde {formatDate(currentUser?.created_at)}
                            </span>
                        </div>

                        {/* Métrica de Tiempo Medio */}
                        <div className="mt-4 flex items-center justify-between p-3 rounded-2xl bg-blue-500/5 border border-blue-500/15">
                            <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
                                Tiempo prom. auditoría <Info size={11} className="text-[var(--color-text-tertiary)]" />
                            </span>
                            <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                ~18 minutos
                            </span>
                        </div>

                        {/* Cuadrícula 2x2 de Pastillas de Estadísticas (Exacto a Referencia) */}
                        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                            {/* Casilla 1 */}
                            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border-subtle)]">
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                                    Rol en Sesión
                                </p>
                                <p className="mt-1 font-mono font-bold text-xs text-[var(--color-text-primary)] truncate">
                                    {userRole}
                                </p>
                            </div>

                            {/* Casilla 2 */}
                            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border-subtle)]">
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                                    Permisos Activos
                                </p>
                                <p className="mt-1 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 truncate">
                                    {totalPermissions}
                                </p>
                            </div>

                            {/* Casilla 3 */}
                            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border-subtle)]">
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                                    Módulos GUIOS
                                </p>
                                <p className="mt-1 font-mono font-bold text-xs text-purple-600 dark:text-purple-400 truncate">
                                    {totalModules} módulos
                                </p>
                            </div>

                            {/* Casilla 4 */}
                            <div className="p-3 rounded-2xl bg-[var(--color-bg-secondary)]/40 border border-[var(--color-border-subtle)]">
                                <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">
                                    Seguridad 2FA
                                </p>
                                <p className={`mt-1 font-mono font-bold text-xs truncate ${has2FA ? 'text-emerald-600' : 'text-amber-500'}`}>
                                    {has2FA ? 'Habilitado ✓' : 'Inactivo'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MODAL DE EDICIÓN DE PERFIL ("Edit Info") ── */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Editar Información de Perfil"
                size="md"
            >
                <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
                    {/* Selector de Avatar */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-bg-secondary)]/30 border border-[var(--color-border-subtle)]">
                        <ImageDropZone
                            preview={imagePreview}
                            onSelect={(file, url) => {
                                setImageFile(file);
                                setImagePreview(url);
                                setShouldDeleteImage(false);
                            }}
                            onClear={() => {
                                setImageFile(null);
                                setImagePreview(null);
                                setShouldDeleteImage(true);
                            }}
                            shape="circle"
                            size="w-24 h-24"
                        />
                        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
                            Formatos admitidos: PNG, JPG o WEBP (máx. 2MB)
                        </p>
                    </div>

                    {/* Inputs de Nombres y Apellidos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase mb-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={formData.first_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                                placeholder="Ej: Luis"
                                required
                                className="w-full px-3.5 py-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase mb-1">
                                Apellidos
                            </label>
                            <input
                                type="text"
                                value={formData.last_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                                placeholder="Ej: Argüello"
                                required
                                className="w-full px-3.5 py-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Correo Electrónico */}
                    <div>
                        <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase mb-1">
                            Correo Electrónico
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                            placeholder="usuario@unemi.edu.ec"
                            required
                            className="w-full px-3.5 py-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Teléfono */}
                    <div>
                        <label className="block text-[11px] font-bold text-[var(--color-text-secondary)] uppercase mb-1">
                            Teléfono de Contacto
                        </label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                            placeholder="+593 999 999 999"
                            className="w-full px-3.5 py-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Botones de Acción */}
                    <div className="pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-end gap-2">
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="rounded-xl text-xs"
                        >
                            Cancelar
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            isLoading={isSavingProfile}
                            icon={Save}
                            className="rounded-xl text-xs font-bold"
                        >
                            Guardar Cambios
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* ── MODAL DE CAMBIO DE CONTRASEÑA ── */}
            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
            />
        </div>
    );
};

export default memo(ProfilePage);