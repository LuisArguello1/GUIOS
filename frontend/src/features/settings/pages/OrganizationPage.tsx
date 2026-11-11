import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Building2, Phone, AtSign, MapPin, Quote,
    Loader2, ChevronRight, Hash, CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';

import usePermissions from '../../../hooks/usePermissions';
import useToastStore from '../../../app/useToastStore';
import useOrganizationStore from '../../../app/useOrganizationStore';
import useCoreStore from '../../../app/useCoreStore';
import organizationService, { type Organization as ApiOrganization, type OrganizationUpdatePayload } from '../../../api/organizationService';
import type { Organization as CoreOrganization, SidebarPrefs } from '../../../app/types/core';
import { getImageUrl } from '../../../utils/imageUtils';

import Loading from '../../../components/ui/Loading';
import ImageDropZone from '../../../components/ui/ImageDropZone';
import AccessDenied from '../../../components/ui/AccessDenied';

const initialForm = {
    name: '',
    ruc: '',
    address: '',
    phone: '',
    email: '',
    slogan: '',
};

const DEFAULT_SIDEBAR_PREFS: SidebarPrefs = {
    is_collapsed: true,
    theme: 'light',
};

const toCoreOrganization = (
    updated: ApiOrganization,
    currentOrganization: CoreOrganization | null,
): CoreOrganization => ({
    id: updated.id,
    name: updated.name,
    ruc: updated.ruc ?? undefined,
    address: updated.address ?? undefined,
    phone: updated.phone ?? undefined,
    email: updated.email ?? undefined,
    logo: updated.logo ?? undefined,
    slogan: updated.slogan ?? undefined,
    sidebar_preferences: currentOrganization?.sidebar_preferences ?? DEFAULT_SIDEBAR_PREFS,
});

/* ─── Fila estilo iOS/Android ────────────────────────── */
interface SettingsRowProps {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    id: string;
    children: React.ReactNode;
    last?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ icon, iconBg, label, id, children, last }) => (
    <div className={clsx(
        'flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-primary)]',
        !last && 'border-b border-[var(--color-border-subtle)]'
    )}>
        <div className={clsx('w-[30px] h-[30px] rounded-[7px] flex items-center justify-center flex-shrink-0', iconBg)}>
            {icon}
        </div>
        <label
            htmlFor={id}
            className="w-24 flex-shrink-0 text-[13px] font-medium text-[var(--color-text-primary)] cursor-pointer select-none"
        >
            {label}
        </label>
        <div className="flex-1 min-w-0">{children}</div>
        <ChevronRight size={13} className="text-[var(--color-text-disabled)] flex-shrink-0" />
    </div>
);

/* ─── Label de sección ────────────────────────────────── */
const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="pb-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--color-text-tertiary)]">
        {children}
    </p>
);

/* ─── Grupo con bordes redondeados ───────────────────── */
const SettingsGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)]">
        {children}
    </div>
);

/* ─── Input nativo sin borde visible ─────────────────── */
const NativeInput = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }
>(({ className, mono, ...props }, ref) => (
    <input
        ref={ref}
        {...props}
        className={clsx(
            'w-full bg-transparent text-[13px] outline-none text-right pr-0.5',
            'text-[var(--color-text-secondary)]',
            'placeholder:text-[var(--color-text-disabled)]',
            'disabled:cursor-default',
            mono && 'font-mono tracking-wider',
            className
        )}
    />
));
NativeInput.displayName = 'NativeInput';

/* ══════════════════════════════════════════════════════
   Componente principal
   ══════════════════════════════════════════════════════ */
const OrganizationPage: React.FC = () => {
    const { has } = usePermissions();
    const canRead = has('settings.manage') || has('settings.org_view') || has('settings.org_manage');
    const canEdit = has('settings.manage') || has('settings.org_manage');

    const { addToast } = useToastStore();
    const { organization, isLoading, fetchOrganization, setOrganization } = useOrganizationStore();
    const coreOrganization = useCoreStore((state) => state.organization);
    const setCoreOrganization = useCoreStore((state) => state.setOrganization);

    const [formData, setFormData] = useState(initialForm);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [shouldDeleteLogo, setShouldDeleteLogo] = useState(false);
    const isMountedRef = useRef(true);
    const previewUrlRef = useRef<string>('');
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        };
    }, []);

    const load = useCallback(async () => { await fetchOrganization(); }, [fetchOrganization]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!organization) return;
        const t = setTimeout(() => {
            setFormData({
                name: organization.name || '',
                ruc: organization.ruc || '',
                address: organization.address || '',
                phone: organization.phone || '',
                email: organization.email || '',
                slogan: organization.slogan || '',
            });
            if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
            const p = getImageUrl(organization.logo);
            previewUrlRef.current = p;
            setImagePreview(p);
        }, 0);
        return () => clearTimeout(t);
        setShouldDeleteLogo(false);
        setImageFile(null);
    }, [organization]);

    useEffect(() => () => {
        if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit || isSaving) return;
        setIsSaving(true);
        setSaved(false);
        try {
            const payload: OrganizationUpdatePayload = {
                ...formData,
                ...(imageFile ? { logo: imageFile } : {}),
                ...(shouldDeleteLogo && !imageFile ? { clear_logo: true } : {}),
            };
            const updated = await organizationService.updateOrganization(payload);
            if (!isMountedRef.current) return;
            setOrganization(updated);
            setCoreOrganization(toCoreOrganization(updated, coreOrganization));
            if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
            const p = getImageUrl(updated.logo);
            previewUrlRef.current = p;
            setImagePreview(p);
            setShouldDeleteLogo(false);
            setImageFile(null);
            setSaved(true);
            savedTimerRef.current = setTimeout(() => { if (isMountedRef.current) setSaved(false); }, 2500);
            addToast({ type: 'success', message: 'Organización actualizada.' });
        } catch (error: unknown) {
            if (!isMountedRef.current) return;
            const data =
                typeof error === 'object' &&
                error !== null &&
                'response' in error &&
                typeof (error as { response?: unknown }).response === 'object'
                    ? (error as { response?: { data?: unknown } }).response?.data
                    : undefined;

            const detail =
                typeof data === 'object' &&
                data !== null &&
                'detail' in data
                    ? (data as { detail?: unknown }).detail
                    : undefined;

            const objectDetailMessage =
                typeof detail === 'object' && detail !== null
                    ? Object.values(detail as Record<string, unknown>).reduce<string | null>((acc, value) => {
                        if (acc) return acc;
                        if (typeof value === 'string' && value.trim()) return value;
                        if (Array.isArray(value)) {
                            const firstText = value.find((item) => typeof item === 'string' && item.trim());
                            if (typeof firstText === 'string') return firstText;
                        }
                        return null;
                    }, null)
                    : null;

            const fieldErrorMessage =
                typeof data === 'object' && data !== null
                    ? Object.values(data as Record<string, unknown>).reduce<string | null>((acc, value) => {
                        if (acc) return acc;
                        if (typeof value === 'string' && value.trim()) return value;
                        if (Array.isArray(value)) {
                            const firstText = value.find((item) => typeof item === 'string' && item.trim());
                            if (typeof firstText === 'string') return firstText;
                        }
                        if (typeof value === 'object' && value !== null) {
                            const nestedText = Object.values(value as Record<string, unknown>).find(
                                (item) => typeof item === 'string' && item.trim(),
                            );
                            if (typeof nestedText === 'string') return nestedText;
                        }
                        return null;
                    }, null)
                    : null;

            const message =
                typeof detail === 'string' && detail.trim()
                    ? detail
                    : objectDetailMessage
                        ? objectDetailMessage
                    : fieldErrorMessage
                        ? fieldErrorMessage
                    : 'No se pudieron guardar los cambios.';

            addToast({ type: 'error', message });
        } finally {
            if (isMountedRef.current) setIsSaving(false);
        }
    };

    const handleImageSelect = useCallback((file: File, url: string) => {
        if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setImageFile(file);
        setImagePreview(url);
        setShouldDeleteLogo(false);
    }, []);

    const handleImageClear = useCallback(() => {
        if (previewUrlRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = '';
        setImageFile(null);
        setImagePreview('');
        setShouldDeleteLogo(true);
    }, []);

    if (!canRead) return <AccessDenied />;
    if (isLoading) return (
        <div className="flex items-center justify-center min-h-[400px]"><Loading /></div>
    );

    return (
        <div className="max-w-[820px] mx-auto pb-12">

            {/* ── Header ── */}
            <div className="px-4 pt-8 pb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] mb-0.5">
                    Configuración
                </p>
                <h1 className="text-[26px] font-bold text-[var(--color-text-primary)] leading-tight">
                    Organización
                </h1>
            </div>

            <form onSubmit={handleSubmit} noValidate>

                {/* ── Avatar card (horizontal, full width) ── */}
                <div className="px-4 mb-5">
                    <div className="rounded-[var(--radius-xl)] bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] flex items-center gap-4 py-3.5 px-5">
                        <ImageDropZone
                            preview={imagePreview}
                            onSelect={handleImageSelect}
                            onClear={handleImageClear}
                            shape="square"
                            size="w-16 h-16 sm:w-18 sm:h-18"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold text-[var(--color-text-primary)] leading-tight truncate">
                                {formData.name || 'Mi Organización'}
                            </p>
                            {formData.slogan && (
                                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5 truncate">
                                    {formData.slogan}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-success-bg)] flex-shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                            <span className="text-[11px] font-semibold text-[var(--color-success-text)]">Activa</span>
                        </div>
                    </div>
                </div>

                {/* ── 2-column grid ── */}
                <div className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">

                    {/* ─ Columna izquierda: Identidad + Datos Fiscales ─ */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <GroupLabel>Identidad</GroupLabel>
                            <SettingsGroup>
                                <SettingsRow id="org-name" icon={<Building2 size={15} className="text-[var(--color-text-on-primary)]" />} iconBg="bg-[var(--color-primary)]" label="Nombre">
                                    <NativeInput id="org-name" name="name" value={formData.name} onChange={handleChange} disabled={!canEdit} placeholder="Nombre comercial" maxLength={150} autoComplete="organization" required />
                                </SettingsRow>
                                <SettingsRow id="org-slogan" icon={<Quote size={15} className="text-white" />} iconBg="bg-[var(--color-tertiary)]" label="Slogan" last>
                                    <NativeInput id="org-slogan" name="slogan" value={formData.slogan} onChange={handleChange} disabled={!canEdit} placeholder="Slogan corporativo" maxLength={200} />
                                </SettingsRow>
                            </SettingsGroup>
                        </div>

                        <div>
                            <GroupLabel>Datos fiscales</GroupLabel>
                            <SettingsGroup>
                                <SettingsRow id="org-ruc" icon={<Hash size={15} className="text-white" />} iconBg="bg-[var(--color-accent)]" label="RUC" last>
                                    <NativeInput id="org-ruc" name="ruc" value={formData.ruc} onChange={handleChange} disabled={!canEdit} placeholder="0000000000001" maxLength={20} inputMode="numeric" mono />
                                </SettingsRow>
                            </SettingsGroup>
                        </div>
                    </div>

                    {/* ─ Columna derecha: Contacto y Encuestas ─ */}
                    <div className="flex flex-col gap-4">
                        <div>
                            <GroupLabel>Contacto</GroupLabel>
                            <SettingsGroup>
                                <SettingsRow id="org-phone" icon={<Phone size={15} className="text-white" />} iconBg="bg-[var(--color-success)]" label="Teléfono">
                                    <NativeInput id="org-phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} disabled={!canEdit} placeholder="+593 99 000 0000" maxLength={20} />
                                </SettingsRow>
                                <SettingsRow id="org-email" icon={<AtSign size={15} className="text-white" />} iconBg="bg-[var(--color-info)]" label="Email">
                                    <NativeInput id="org-email" name="email" type="email" value={formData.email} onChange={handleChange} disabled={!canEdit} placeholder="empresa@mail.com" maxLength={150} autoComplete="email" />
                                </SettingsRow>
                                <SettingsRow id="org-address" icon={<MapPin size={15} className="text-white" />} iconBg="bg-[var(--color-danger)]" label="Dirección" last>
                                    <NativeInput id="org-address" name="address" value={formData.address} onChange={handleChange} disabled={!canEdit} placeholder="Av. Principal 123" maxLength={255} />
                                </SettingsRow>
                            </SettingsGroup>
                        </div>
                    </div>
                </div>

                {/* ── Botón guardar (full width) ── */}
                {canEdit && (
                    <div className="px-4 pt-5">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className={clsx(
                                'w-full h-[46px] rounded-[var(--radius-lg)] flex items-center justify-center gap-2',
                                'text-[14px] font-semibold transition-all duration-200 select-none',
                                saved
                                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-border-subtle)]'
                                    : [
                                        'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]',
                                        'hover:bg-[var(--color-primary-hover)]',
                                        'active:scale-[0.985] active:bg-[var(--color-primary-active)]',
                                    ],
                                isSaving && 'opacity-60 cursor-not-allowed pointer-events-none',
                            )}
                        >
                            {isSaving ? (
                                <><Loader2 size={16} className="animate-spin" /> Guardando…</>
                            ) : saved ? (
                                <><CheckCircle2 size={16} /> Guardado</>
                            ) : (
                                'Guardar cambios'
                            )}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default OrganizationPage;