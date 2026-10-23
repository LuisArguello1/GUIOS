import { useState, useCallback, memo } from 'react';
import {
    User, Phone, Save, AtSign, Shield,
    ChevronRight, Lock,
} from 'lucide-react';
import useAuthStore from '../../app/useAuthStore';
import useToastStore from '../../app/useToastStore';
import authService from '../../api/authService';
import { getImageUrl } from '../../utils/imageUtils';
import Button from '../../components/ui/Button';
import ImageDropZone from '../../components/ui/ImageDropZone';
import AccessDenied from '../../components/ui/AccessDenied';
import usePermissions from '../../hooks/usePermissions';
import { clsx } from 'clsx';
import TwoFactorSettings from './TwoFactorSettings';
import ChangePasswordModal from './ChangePasswordModal';

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/** Encabezado de sección tipo iOS */
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] px-1 mb-2 mt-5 first:mt-0">
        {children}
    </p>
);

/** Fila con input editable */
interface InputRowProps {
    icon: React.ReactNode;
    label: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
    placeholder?: string;
    divider?: boolean;
    type?: string;
}

const InputRow = ({
    icon, label, name, value, onChange, disabled,
    placeholder, divider = true, type = 'text',
}: InputRowProps) => (
    <div className="relative flex items-center gap-3 px-4 py-[10px]">
        <div className="w-[28px] h-[28px] rounded-[7px] bg-[var(--color-bg-tertiary)] flex items-center justify-center shrink-0">
            {icon}
        </div>
        <span className="text-[13px] text-[var(--color-text-primary)] w-[80px] shrink-0 font-medium">
            {label}
        </span>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled}
            placeholder={placeholder}
            className={clsx(
                'flex-1 bg-transparent text-[13px] font-medium text-right',
                'text-[var(--color-text-primary)] outline-none',
                'placeholder-[var(--color-text-tertiary)]',
                'disabled:text-[var(--color-text-secondary)] disabled:cursor-default',
                'transition-colors',
            )}
        />
        {divider && (
            <span className="absolute bottom-0 left-[52px] right-0 h-px bg-[var(--color-border-subtle)]" />
        )}
    </div>
);

/** Tarjeta contenedora de lista */
const ListCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={clsx(
        'rounded-[12px] border border-[var(--color-border-subtle)] overflow-hidden bg-[var(--color-bg-primary)]',
        className,
    )}>
        {children}
    </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * ProfilePage — Responsive two-column layout
 *
 * ≥ 768 px → columna izquierda (identidad + contacto + guardar)
 *            columna derecha  (seguridad + cumplimiento)
 * < 768 px → apilado vertical (una columna, orden natural)
 */
const ProfilePage = () => {
    const { user, setUser } = useAuthStore();
    const { addToast }      = useToastStore();
    const { has }           = usePermissions();
    const canRead           = has('settings.manage') || has('settings.profile_view') || has('settings.profile_manage');
    const canModify         = has('settings.manage') || has('settings.profile_manage');

    const [formData, setFormData] = useState({
        first_name: user?.first_name ?? '',
        last_name:  user?.last_name  ?? '',
        email:      user?.email      ?? '',
        phone:      user?.phone      ?? '',
    });

    const [isLoading,        setIsLoading]        = useState(false);
    const [imageFile,        setImageFile]        = useState<File | null>(null);
    const [imagePreview,     setImagePreview]     = useState(user?.avatar ? getImageUrl(user.avatar) : null);
    const [shouldDeleteImage, setShouldDeleteImage] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleUpdate = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const payload: {
                first_name?: string;
                last_name?: string;
                email?: string;
                phone?: string | null;
                avatar?: File | null;
            } = {
                first_name: formData.first_name,
                last_name:  formData.last_name,
                email:      formData.email,
                phone:      formData.phone,
            };

            if (imageFile)             payload.avatar = imageFile;
            else if (shouldDeleteImage) payload.avatar = null;

            const updatedUser = await authService.updateProfile(payload);
            setUser(updatedUser);
            setImageFile(null);
            setShouldDeleteImage(false);
            setImagePreview(updatedUser.avatar ? getImageUrl(updatedUser.avatar) : null);

            addToast({ type: 'success', message: '¡Perfil actualizado con éxito!' });
        } finally {
            setIsLoading(false);
        }
    }, [formData, imageFile, shouldDeleteImage, setUser, addToast]);

    // ── Guards ────────────────────────────────────────────────────────────────

    if (!canRead) {
        return (
            <AccessDenied
                title="Acceso Restringido"
                message="Tu cuenta no dispone de permisos de lectura para ver el perfil."
            />
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-5xl mx-auto">

            {/* ── Cabecera de identidad (ancho completo) ───────────────────── */}
            <ListCard className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5
                                border-b border-[var(--color-border-subtle)]">

                    {/* Avatar */}
                    <div className="shrink-0 self-center sm:self-auto">
                        <ImageDropZone
                            preview={imagePreview}
                            onSelect={(file, url) => {
                                setImageFile(file);
                                setImagePreview(url);
                                setShouldDeleteImage(false);
                            }}
                            onClear={() => {
                                if (!canModify) return;
                                setImageFile(null);
                                setImagePreview(null);
                                setShouldDeleteImage(true);
                            }}
                            disabled={!canModify}
                            shape="circle"
                            size="w-20 h-20 sm:w-24 sm:h-24"
                        />
                    </div>

                    {/* Nombre + email */}
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <p className="text-[18px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                            {user?.first_name} {user?.last_name}
                        </p>
                        <p className="text-[13px] text-[var(--color-text-secondary)] truncate mt-0.5">
                            {user?.email}
                        </p>
                    </div>

                    {/* Pills de permisos — se empujan a la derecha en desktop */}
                    <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end shrink-0">
                        <Shield size={13} className="text-[var(--color-text-tertiary)]" />
                        {user?.is_superuser && (
                            <PermissionPill color="primary">Super-Admin</PermissionPill>
                        )}
                    </div>
                </div>
            </ListCard>

            {/* ── Grid de dos columnas ─────────────────────────────────────── */}
            {/* El <form> envuelve solo los datos personales: los modales de la
                columna de Seguridad (2FA) se montan en un portal, pero React
                propaga su submit por el árbol y guardaría el perfil. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                    {/* ── Columna izquierda: Datos personales ─────────────── */}
                    <form onSubmit={handleUpdate}>
                        <SectionTitle>Identidad</SectionTitle>
                        <ListCard>
                            <InputRow
                                icon={<User size={14} className="text-[var(--color-text-secondary)]"/>}
                                label="Nombre"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                disabled={!canModify}
                                placeholder="Ej: Juan"
                            />
                            <InputRow
                                icon={<User size={14} className="text-[var(--color-text-secondary)]"/>}
                                label="Apellidos"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                disabled={!canModify}
                                placeholder="Ej: Pérez"
                                divider={false}
                            />
                        </ListCard>

                        <SectionTitle>Contacto</SectionTitle>
                        <ListCard>
                            <InputRow
                                icon={<AtSign size={14} className="text-[var(--color-text-secondary)]"/>}
                                label="Correo"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                disabled={!canModify}
                                type="email"
                                placeholder="ejemplo@correo.com"
                            />
                            <InputRow
                                icon={<Phone size={14} className="text-[var(--color-text-secondary)]"/>}
                                label="Teléfono"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                disabled={!canModify}
                                placeholder="+593 999 999 999"
                                divider={false}
                            />
                        </ListCard>

                        {/* Botón guardar */}
                        {canModify && (
                            <div className="mt-6">
                                <Button
                                    variant="primary"
                                    type="submit"
                                    isLoading={isLoading}
                                    icon={Save}
                                    className="w-full py-2.5 text-[14px] font-semibold rounded-[12px]"
                                >
                                    Guardar cambios
                                </Button>
                            </div>
                        )}
                    </form>

                    {/* ── Columna derecha: Seguridad + Cumplimiento ────────── */}
                    <div>
                        <SectionTitle>Seguridad</SectionTitle>
                        <div className="space-y-3">
                            <TwoFactorSettings />

                            {/* Cambiar contraseña */}
                            <button
                                type="button"
                                onClick={() => setIsPasswordModalOpen(true)}
                                className={clsx(
                                    'w-full text-left',
                                    'bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)]',
                                    'rounded-[12px] overflow-hidden',
                                    'hover:bg-[var(--color-bg-secondary)] transition-colors',
                                    'active:scale-[0.99] transition-transform',
                                )}
                            >
                                <div className="flex items-center justify-between px-4 py-[11px]">
                                    <div className="flex items-center gap-3">
                                        <div className="w-[28px] h-[28px] rounded-[7px] bg-[var(--color-bg-tertiary)] flex items-center justify-center shrink-0">
                                            <Lock size={14} className="text-[var(--color-text-secondary)]"/>
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-none">
                                                Contraseña
                                            </p>
                                            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-none">
                                                Actualiza tu clave de acceso
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-[var(--color-text-tertiary)]"/>
                                </div>
                            </button>
                        </div>
                    </div>
            </div>

            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
            />
        </div>
    );
};

// ─── Micro-componentes ────────────────────────────────────────────────────────

type PermColor = 'primary' | 'success' | 'info' | 'danger';

const permColorMap: Record<PermColor, string> = {
    primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
    info:    'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
    danger:  'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
};

const PermissionPill = ({
    color,
    icon,
    children,
}: {
    color: PermColor;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) => (
    <span className={clsx(
        'inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[11px] font-semibold',
        permColorMap[color],
    )}>
        {icon}
        {children}
    </span>
);


export default memo(ProfilePage);