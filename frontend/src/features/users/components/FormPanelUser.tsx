import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Mail, Phone, UserCog, Lock, Eye, EyeOff, Check,
    ArrowLeft, Save, Trash2, User, ShieldCheck, Crown,
    Info, Shield
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

import Toggle from '../../../components/ui/Toggle';
import ImageDropZone from '../../../components/ui/ImageDropZone';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

import userService from '../../../api/userService';
import type { GroupResponse } from '../../../api/groupService';
import groupService from '../../../api/groupService';
import useAuthStore from '../../../app/useAuthStore';
import useToastStore from '../../../app/useToastStore';
import { getImageUrl } from '../../../utils/imageUtils';
import { getErrorDetail } from '../../../utils/errorUtils';
import type { User as StoredUser } from '../../../app/useUserStore';
import { usePermissions } from '../../../hooks/usePermissions';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type UserListItem = StoredUser & {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string | null;
    avatar?: string | null;
};

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

/** Etiqueta de sección al estilo iOS pero adaptada a página completa */
const SectionLabel = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-[5px] bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Icon size={11} className="text-[var(--color-primary)]" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-text-tertiary)]">
            {children}
        </p>
    </div>
);

/** Tarjeta contenedora de grupo de campos */
const FieldCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={clsx(
        'rounded-[var(--radius-lg)] overflow-hidden',
        'border border-[var(--color-border-subtle)]',
        'shadow-[var(--shadow-sm)]',
        'bg-[var(--color-bg-primary)]',
        className,
    )}>
        {children}
    </div>
);

interface InputRowProps {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    last?: boolean;
    children: React.ReactNode;
}

const InputRow: React.FC<InputRowProps> = ({ icon, iconBg, label, last, children }) => (
    <div className={clsx(
        'flex items-start gap-3 px-4 py-3',
        !last && 'border-b border-[var(--color-border-subtle)]',
    )}>
        <div className={clsx('w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0 mt-0.5', iconBg)}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)] mb-0.5 leading-none">
                {label}
            </p>
            {children}
        </div>
    </div>
);

/* ─── Main Page ──────────────────────────────────────────────────────────────── */

interface UserFormPageProps {
    /** Si se pasa `userId` via prop (en lugar de react-router), usar esto */
    userId?: string | number;
    mode?: 'create' | 'edit';
    onSaved?: () => void;
    onCancel?: () => void;
    onDeleteUser?: (user: UserListItem) => void;
}

export default function UserFormPage({
    userId: userIdProp,
    mode: modeProp,
    onSaved,
    onCancel,
    onDeleteUser,
}: UserFormPageProps) {
    const navigate = useNavigate();
    // Si se usa react-router, el id vendrá de useParams; si no, de la prop
    const params = useParams<{ id?: string }>();
    const routeId = params?.id;
    const resolvedId = userIdProp ?? routeId;
    const mode: 'create' | 'edit' = modeProp ?? (resolvedId ? 'edit' : 'create');

    const { user: currentUser, setUser: updateGlobalUser } = useAuthStore();
    const { addToast } = useToastStore();

    const { isSuperuser, has } = usePermissions();

    const canDeleteAction = useMemo(() => isSuperuser || has('users.deactivate'), [isSuperuser, has]);
    const canAssignRoles = useMemo(() => isSuperuser || has('users.assign_roles'), [isSuperuser, has]);
    const canEditAction = useMemo(() => isSuperuser || has('users.edit'), [isSuperuser, has]);
    const canCreateAction = useMemo(() => isSuperuser || has('users.create'), [isSuperuser, has]);

    const [pageLoading, setPageLoading] = useState(mode === 'edit');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [availableRoles, setAvailableRoles] = useState<GroupResponse[]>([]);
    const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [shouldDeleteAvatar, setShouldDeleteAvatar] = useState(false);

    const defaultForm = {
        email: '', password: '', first_name: '', last_name: '', phone: '',
        is_staff: false, is_superuser: false,
        groups: [] as number[],
    };

    const [formData, setFormData] = useState(defaultForm);

    /* ── Load roles ── */
    const fetchRoles = useCallback(async () => {
        try {
            const data = await groupService.getAll();
            setAvailableRoles('results' in data ? data.results : data);
        } catch {
            setAvailableRoles([]);
        }
    }, []);

    const handleBack = useCallback(() => {
        if (onCancel) { onCancel(); return; }
        navigate(-1);
    }, [onCancel, navigate]);

    /* ── Load user (edit mode) ── */
    useEffect(() => {
        const t = setTimeout(() => {
            fetchRoles();
        }, 0);
        if (mode === 'edit' && resolvedId) {
            (async () => {
                setPageLoading(true);
                try {
                    const detail = await userService.getById(Number(resolvedId));
                    setEditingUser(detail as UserListItem);

                    // Extraer los IDs si los grupos vienen como objetos desde el serializador de detalle
                    const groupIds = (detail.groups || []).map((g: number | { id: number }) => 
                        typeof g === 'number' ? g : g.id
                    );

                    setFormData({
                        email: detail.email,
                        password: '',
                        first_name: detail.first_name || '',
                        last_name: detail.last_name || '',
                        phone: detail.phone || '',
                        is_staff: !!detail.is_staff,
                        is_superuser: !!detail.is_superuser,
                        groups: groupIds,
                    });
                    setAvatarPreview(detail.avatar ? getImageUrl(detail.avatar) : null);
                } catch (error) {
                    const msg = getErrorDetail(error, 'No se pudo cargar el usuario.');
                    addToast({ type: 'error', message: msg });
                    handleBack();
                } finally {
                    setPageLoading(false);
                }
            })();
        }
        return () => clearTimeout(t);
    }, [mode, resolvedId, fetchRoles, handleBack]); // eslint-disable-line react-hooks/exhaustive-deps



    /* ── Password strength ── */
    const passwordStrength = useMemo(() => {
        if (!formData.password) return 0;
        let s = 0;
        if (formData.password.length >= 8) s += 25;
        if (/[A-Z]/.test(formData.password)) s += 25;
        if (/[0-9]/.test(formData.password)) s += 25;
        if (/[^A-Za-z0-9]/.test(formData.password)) s += 25;
        return s;
    }, [formData.password]);

    const isPasswordValid = useMemo(() => {
        if (mode === 'create') return passwordStrength === 100;
        return formData.password ? passwordStrength === 100 : true;
    }, [mode, formData.password, passwordStrength]);

    const strengthColor =
        passwordStrength < 50 ? 'bg-[var(--color-danger)]' :
            passwordStrength < 100 ? 'bg-[var(--color-warning)]' :
                'bg-[var(--color-success)]';

    /* ── Submit ── */
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!isPasswordValid) {
            addToast({ type: 'warning', message: 'La contraseña debe ser robusta.' });
            return;
        }
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            if (mode === 'create') {
                const createPayload: Parameters<typeof userService.create>[0] = {
                    email: formData.email.trim(), password: formData.password,
                    first_name: formData.first_name, last_name: formData.last_name,
                    phone: formData.phone,
                    is_staff: formData.is_staff, is_superuser: formData.is_superuser,
                    is_active: true, groups: formData.groups,
                };
                await userService.create(createPayload);
                addToast({ type: 'success', message: 'Nuevo usuario creado con éxito.' });
            } else if (mode === 'edit' && editingUser) {
                const base = {
                    first_name: formData.first_name, last_name: formData.last_name,
                    phone: formData.phone,
                    is_staff: formData.is_staff, is_superuser: formData.is_superuser,
                    groups: formData.groups,
                    password: formData.password || undefined,
                };

                let response;
                if (avatarFile) {
                    const fd = new FormData();
                    Object.entries(base).forEach(([k, v]) => {
                        if (v !== undefined && v !== null && v !== '') {
                            if (Array.isArray(v)) v.forEach(val => fd.append(k, String(val)));
                            else fd.append(k, String(v));
                        }
                    });
                    fd.append('avatar', avatarFile);
                    response = await userService.update(editingUser.id, fd);
                } else {
                    const cleanBase = Object.fromEntries(
                        Object.entries(base).filter(([, v]) => v !== undefined && v !== '')
                    ) as Parameters<typeof userService.update>[1] & { avatar?: null };
                    if (shouldDeleteAvatar) cleanBase.avatar = null;
                    response = await userService.update(editingUser.id, cleanBase);
                }

                if (editingUser.id === currentUser?.id && response) {
                    updateGlobalUser(response as Partial<StoredUser>);
                }
                addToast({ type: 'success', message: 'Usuario actualizado correctamente.' });
            }

            if (onSaved) onSaved();
            else handleBack();
        } catch (error: unknown) {
            const msg = getErrorDetail(error, 'Error en la operación.');
            addToast({ type: 'error', message: msg });
        } finally {
            setIsSubmitting(false);
        }
    };

    const set = (key: string, value: unknown) =>
        setFormData(p => ({ ...p, [key]: value }));

    const toggleGroup = (id: number) =>
        setFormData(p => ({
            ...p,
            groups: p.groups.includes(id)
                ? p.groups.filter(g => g !== id)
                : [...p.groups, id],
        }));

    /* ── Loading skeleton ── */
    if (pageLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-[12px] text-[var(--color-text-tertiary)] animate-pulse uppercase tracking-widest">
                    Cargando usuario…
                </p>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div className="min-h-screen bg-[var(--color-bg-secondary)]">
            <form onSubmit={handleSubmit} noValidate>

                {/* ── Sticky header ── */}
                <div className={clsx(
                    'sticky top-0 z-30',
                    'bg-[var(--color-bg-primary)]/80 backdrop-blur-md',
                    'border-b border-[var(--color-border-subtle)]',
                    'shadow-[var(--shadow-sm)]',
                )}>
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                        {/* Back + title */}
                        <div className="flex items-center gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={handleBack}
                                className={clsx(
                                    'w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center shrink-0',
                                    'bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]',
                                    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                                    'hover:bg-[var(--color-bg-tertiary)] transition-all duration-[var(--transition-fast)]',
                                )}
                            >
                                <ArrowLeft size={15} />
                            </button>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] leading-none mb-0.5">
                                    {mode === 'edit' ? 'Editar usuario' : 'Nuevo usuario'}
                                </p>
                                <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                                    {mode === 'edit'
                                        ? (editingUser?.full_name || `${editingUser?.first_name ?? ''} ${editingUser?.last_name ?? ''}`.trim() || editingUser?.email)
                                        : 'Crear cuenta de acceso'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                            {mode === 'edit' && editingUser && onDeleteUser &&
                                currentUser?.id !== editingUser.id && canDeleteAction && (
                                    <Button
                                        type="button"
                                        variant="danger"
                                        onClick={() => onDeleteUser(editingUser)}
                                        className={clsx(
                                            'h-8 px-3 text-[12px]',
                                            'bg-transparent border border-[var(--color-danger)]/40',
                                            'text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white',
                                        )}
                                        icon={Trash2}
                                    >
                                        <span className="hidden sm:inline">Eliminar</span>
                                    </Button>
                                )}
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleBack}
                                className="h-8 px-3 text-[12px]"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={isSubmitting}
                                disabled={!isPasswordValid || (mode === 'edit' ? !canEditAction : !canCreateAction)}
                                className="h-8 px-4 text-[12px]"
                                icon={Save}
                            >
                                {mode === 'edit' ? 'Guardar' : 'Crear usuario'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Page body ── */}
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}

                        /**
                         * Layout:
                         * mobile  → 1 column
                         * tablet  → 2 columns (left=datos, right=permisos)
                         * desktop → 3 columns (left=datos, center=módulos, right=roles+admin)
                         */
                        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start"
                    >

                        {/* ══════════════════════════════════════
                            COLUMNA 1 — Datos de la cuenta
                            ══════════════════════════════════════ */}
                        <div className="space-y-5">

                            {/* Credenciales */}
                            <section>
                                <SectionLabel icon={Lock}>Credenciales</SectionLabel>
                                <FieldCard>
                                    <InputRow
                                        icon={<Mail size={13} className="text-white" />}
                                        iconBg="bg-[var(--color-primary)]"
                                        label="Correo electrónico"
                                    >
                                        <Input
                                            variant="embedded"
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => set('email', e.target.value)}
                                            disabled={mode === 'edit'}
                                            placeholder="usuario@empresa.com"
                                            mono
                                        />
                                    </InputRow>
                                    <InputRow
                                        icon={<Lock size={13} className="text-white" />}
                                        iconBg="bg-[var(--color-tertiary)]"
                                        label={mode === 'create' ? 'Contraseña' : 'Contraseña (opcional)'}
                                        last
                                    >
                                        <Input
                                            variant="embedded"
                                            type={showPassword ? 'text' : 'password'}
                                            required={mode === 'create'}
                                            value={formData.password}
                                            onChange={e => set('password', e.target.value)}
                                            placeholder={mode === 'create' ? 'Mínimo 8 caracteres' : 'Dejar vacío para no cambiar'}
                                            icon={showPassword ? EyeOff : Eye}
                                            onIconClick={() => setShowPassword(s => !s)}
                                        />
                                        {formData.password && (
                                            <div className="mt-2 space-y-1">
                                                <div className="h-[3px] w-full rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${passwordStrength}%` }}
                                                        className={clsx('h-full rounded-full transition-all', strengthColor)}
                                                    />
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[10px] text-[var(--color-text-disabled)]">Seguridad</span>
                                                    <span className={clsx(
                                                        'text-[10px] font-semibold',
                                                        passwordStrength === 100
                                                            ? 'text-[var(--color-success-text)]'
                                                            : 'text-[var(--color-text-disabled)]',
                                                    )}>
                                                        {passwordStrength === 100 ? 'Excelente' : `${passwordStrength}%`}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </InputRow>
                                </FieldCard>
                            </section>

                            {/* Datos personales */}
                            <section>
                                <SectionLabel icon={User}>Datos personales</SectionLabel>
                                <FieldCard>
                                    <InputRow
                                        icon={<UserCog size={13} className="text-white" />}
                                        iconBg="bg-[var(--color-accent)]"
                                        label="Nombre"
                                    >
                                        <Input
                                            variant="embedded"
                                            type="text"
                                            required
                                            value={formData.first_name}
                                            onChange={e => set('first_name', e.target.value)}
                                            placeholder="Ej: María"
                                        />
                                    </InputRow>
                                    <InputRow
                                        icon={<UserCog size={13} className="text-white" />}
                                        iconBg="bg-[var(--color-accent)]"
                                        label="Apellido"
                                    >
                                        <Input
                                            variant="embedded"
                                            type="text"
                                            required
                                            value={formData.last_name}
                                            onChange={e => set('last_name', e.target.value)}
                                            placeholder="Ej: García"
                                        />
                                    </InputRow>
                                    <InputRow
                                        icon={<Phone size={13} className="text-white" />}
                                        iconBg="bg-[var(--color-success)]"
                                        label="Teléfono"
                                        last
                                    >
                                        <Input
                                            variant="embedded"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => set('phone', e.target.value)}
                                            placeholder="+593 99 000 0000"
                                            mono
                                        />
                                    </InputRow>
                                </FieldCard>
                            </section>

                            {/* Avatar (solo edit) */}
                            {mode === 'edit' && (
                                <section>
                                    <SectionLabel icon={User}>Foto de perfil</SectionLabel>
                                    <FieldCard>
                                        <div className="flex items-center gap-4 px-4 py-3">
                                            <ImageDropZone
                                                preview={avatarPreview}
                                                onSelect={(file, url) => {
                                                    setAvatarFile(file);
                                                    setAvatarPreview(url);
                                                    setShouldDeleteAvatar(false);
                                                }}
                                                onClear={() => {
                                                    setAvatarFile(null);
                                                    setAvatarPreview(null);
                                                    setShouldDeleteAvatar(true);
                                                }}
                                                shape="circle"
                                                size="w-16 h-16"
                                            />
                                            <p className="text-[12px] text-[var(--color-text-tertiary)] leading-snug">
                                                Toca para cambiar el avatar.<br />
                                                Formatos: JPG, PNG, WEBP.
                                            </p>
                                        </div>
                                    </FieldCard>
                                </section>
                            )}



                            {mode === 'create' && (
                                <p className="text-center text-[11px] text-[var(--color-text-disabled)] px-2">
                                    El avatar se puede agregar después de crear el usuario.
                                </p>
                            )}
                        </div>

                        {/* ══════════════════════════════════════
                            COLUMNA 2 — Roles y Nivel de Acceso
                            ══════════════════════════════════════ */}
                        <div className="md:col-span-1 space-y-5">
                            {/* Banner informativo */}
                            <div className={clsx(
                                'flex items-start gap-3 px-4 py-3 rounded-[12px]',
                                'bg-[var(--color-info-bg)] border border-[var(--color-info)]/20'
                            )}>
                                <Info size={14} className="text-[var(--color-info)] mt-0.5 shrink-0" />
                                <div className="text-[12px] text-[var(--color-info-text)] leading-relaxed">
                                    <p className="font-semibold">Gestión por Roles</p>
                                    <p className="opacity-80">
                                        Los permisos granulares se gestionan desde <b>Configuración {'>'} Roles</b>.
                                        Selecciona los roles que definen el acceso de este usuario.
                                    </p>
                                </div>
                            </div>

                            {/* Roles */}
                            <section>
                                <SectionLabel icon={ShieldCheck}>Roles Asignados</SectionLabel>
                                <div className="space-y-2">
                                    {availableRoles.length === 0 ? (
                                        <p className="text-[12px] text-[var(--color-text-disabled)] italic py-2 px-1">
                                            No hay roles definidos en el sistema.
                                        </p>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-2">
                                            {availableRoles.map(role => {
                                                const isSelected = formData.groups.includes(role.id);
                                                return (
                                                    <button
                                                        key={role.id}
                                                        type="button"
                                                        onClick={() => canAssignRoles && toggleGroup(role.id)}
                                                        disabled={!canAssignRoles}
                                                        className={clsx(
                                                            'flex items-center gap-3 p-3 rounded-[12px] border text-left transition-all',
                                                            isSelected
                                                                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                                                                : 'bg-[var(--color-bg-primary)] border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-focus)]',
                                                            !canAssignRoles && 'opacity-60 cursor-not-allowed grayscale-[0.5]'
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            'w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition-colors',
                                                            isSelected
                                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                                                                : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]',
                                                        )}>
                                                            {isSelected && <Check size={12} strokeWidth={3} />}
                                                        </div>
                                                        <span className="text-[13px] font-semibold">
                                                            {role.name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Niveles administrativos */}
                            {isSuperuser && (
                                <section>
                                    <SectionLabel icon={Crown}>Nivel de Acceso</SectionLabel>
                                    <FieldCard>
                                        <div className="bg-[var(--color-bg-primary)] border-b border-[var(--color-border-subtle)]">
                                            <Toggle
                                                checked={formData.is_staff}
                                                onChange={checked => set('is_staff', checked)}
                                                label="Acceso al Staff"
                                                description="Permite al usuario acceder al panel administrativo."
                                            />
                                        </div>
                                        <div className="bg-[var(--color-bg-primary)]">
                                            <Toggle
                                                checked={formData.is_superuser}
                                                onChange={checked => set('is_superuser', checked)}
                                                label="Superusuario"
                                                description="Control total absoluto sobre todo el sistema."
                                            />
                                        </div>
                                    </FieldCard>
                                </section>
                            )}
                        </div>

                        {/* ══════════════════════════════════════
                            COLUMNA 3 — Resumen / Info adicional
                            ══════════════════════════════════════ */}
                        <div className="md:col-span-1 xl:col-span-1 space-y-5">
                            {/* Info de seguridad */}
                            <section>
                                <SectionLabel icon={Shield}>Seguridad</SectionLabel>
                                <div className="p-4 rounded-[12px] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center text-[var(--color-success-text)]">
                                            <Lock size={14} />
                                        </div>
                                        <p className="text-[12px] font-medium text-[var(--color-text-primary)]">
                                            Protección de cuenta
                                        </p>
                                    </div>
                                    <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                                        Asegúrese de que el usuario utilice una contraseña segura. El sistema requiere validación de robustez para nuevas cuentas.
                                    </p>
                                </div>
                            </section>
                        </div>

                        {/* ── Bottom actions (visible en mobile debajo de todo) ── */}
                        <div className="flex gap-2 pt-2 xl:hidden">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleBack}
                                className="flex-1 h-11"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                loading={isSubmitting}
                                disabled={!isPasswordValid || (mode === 'edit' ? !canEditAction : !canCreateAction)}
                                className="flex-1 h-11"
                                icon={Save}
                            >
                                {mode === 'edit' ? 'Guardar cambios' : 'Crear usuario'}
                            </Button>
                        </div>

                        {mode === 'edit' && editingUser && onDeleteUser &&
                            currentUser?.id !== editingUser.id && canDeleteAction && (
                                <div className="xl:hidden">
                                    <Button
                                        type="button"
                                        variant="danger"
                                        onClick={() => onDeleteUser(editingUser)}
                                        className={clsx(
                                            'w-full h-10',
                                            'bg-transparent border border-[var(--color-danger)]/50',
                                            'text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white',
                                        )}
                                    >
                                        Eliminar cuenta
                                    </Button>
                                </div>
                            )}
                    </motion.div>
                </div>
            </form>
        </div>
    );
}