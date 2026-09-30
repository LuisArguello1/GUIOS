import { useState, useEffect } from 'react';
import { ArrowLeft, User, Mail, Phone, ShieldCheck, Crown, Folder, Key, Lock, Compass, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

import userService from '../../../api/userService';
import { getImageUrl } from '../../../utils/imageUtils';
import type { User as StoredUser } from '../../../app/useUserStore';

interface PermissionDetail {
    id: number;
    codename: string;
    label: string;
    module_id?: number | null;
    module_label: string;
}

interface ModuleDetail {
    id: number;
    label: string;
    path: string;
    icon: string;
    category_name: string;
}

type UserDetailType = Omit<StoredUser, 'groups'> & { 
    phone?: string; 
    full_name?: string;
    permissions_details?: PermissionDetail[];
    modules_details?: ModuleDetail[];
    groups?: { id: number; name: string }[];
};

interface UserDetailsPageProps {
    userId: string | number;
    onClose: () => void;
}

export default function UserDetailsPage({ userId, onClose }: UserDetailsPageProps) {
    const [user, setUser] = useState<UserDetailType | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        userService.getById(Number(userId)).then(data => {
            if (mounted) {
                setUser(data as unknown as UserDetailType);
                setIsLoading(false);
            }
        }).catch(() => {
            if (mounted) setIsLoading(false);
        });
        return () => { mounted = false; };
    }, [userId]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)]">
                <p className="text-[12px] text-[var(--color-text-tertiary)] animate-pulse uppercase tracking-widest">
                    Cargando perfil...
                </p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)]">
                <div className="text-center">
                    <p className="text-[14px] text-[var(--color-text-secondary)] mb-4">Usuario no encontrado</p>
                    <button onClick={onClose} className="px-4 py-2 bg-[var(--color-bg-tertiary)] rounded-md text-[13px]">
                        Volver
                    </button>
                </div>
            </div>
        );
    }

    const fullName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Sin Nombre';

    // Group permissions by module_label
    const permissionsByModule = (user.permissions_details || []).reduce<Record<string, PermissionDetail[]>>((acc, perm) => {
        const key = perm.module_label || 'Otros';
        if (!acc[key]) acc[key] = [];
        acc[key].push(perm);
        return acc;
    }, {});

    // Group modules by category_name
    const modulesByCategory = (user.modules_details || []).reduce<Record<string, ModuleDetail[]>>((acc, mod) => {
        const key = mod.category_name || 'Otros';
        if (!acc[key]) acc[key] = [];
        acc[key].push(mod);
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-[var(--color-bg-secondary)] pb-10">
            {/* ── Header ── */}
            <div className="sticky top-0 z-30 bg-[var(--color-bg-primary)]/80 backdrop-blur-md border-b border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all"
                        >
                            <ArrowLeft size={15} />
                        </button>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] leading-none mb-0.5">
                                Perfil de Usuario
                            </p>
                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                                Detalles y Accesos
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                    {/* ── Info Banner (Horizontal) ── */}
                    <div className="bg-[var(--color-bg-primary)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-md)] p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                        {/* Glassmorphism Background Accent */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                        {/* Estado */}
                        <div className="absolute top-4 right-4 md:top-6 md:right-6">
                            <span className={clsx(
                                "px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.12em] shadow-sm",
                                user.is_active 
                                    ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success)]/10" 
                                    : "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger)]/10"
                            )}>
                                {user.is_active ? 'Usuario Activo' : 'Acceso Suspendido'}
                            </span>
                        </div>

                        {/* Avatar */}
                        <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] shadow-[var(--shadow-sm)] overflow-hidden flex items-center justify-center shrink-0 transition-transform hover:scale-105 duration-300">
                            {user.avatar ? (
                                <img src={getImageUrl(user.avatar)} alt={fullName} className="w-full h-full object-cover" />
                            ) : (
                                <User size={40} className="text-[var(--color-text-disabled)]" />
                            )}
                        </div>

                        {/* Text Info */}
                        <div className="flex-1 text-center md:text-left mt-2 md:mt-0 z-10">
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-1">
                                <h2 className="text-[22px] md:text-[26px] font-black text-[var(--color-text-primary)] leading-tight tracking-tight">
                                    {fullName}
                                </h2>
                                {(user.is_superuser || user.is_staff) && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm">
                                        <Crown size={12} className="fill-[var(--color-primary)]/10" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">
                                            {user.is_superuser ? 'Superusuario' : 'Staff'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <p className="text-[11px] text-[var(--color-text-tertiary)] font-mono mb-5">
                                ID Cuenta: #{user.id}
                            </p>

                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6">
                                <div className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-secondary)]">
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center">
                                        <Mail size={13} className="text-[var(--color-text-tertiary)]" />
                                    </div>
                                    <span className="font-semibold">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-[13px] text-[var(--color-text-secondary)]">
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center">
                                        <Phone size={13} className="text-[var(--color-text-tertiary)]" />
                                    </div>
                                    <span className="font-semibold">{user.phone || 'Teléfono no registrado'}</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </motion.div>

                {/* ── Main Details Grid (Roles, Modules, Permissions) ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Roles & System Attributes */}
                    <div className="space-y-6">
                        {/* Card: Roles */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                            className="bg-[var(--color-bg-primary)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] p-5 space-y-4"
                        >
                            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                                <ShieldCheck size={16} className="text-[var(--color-primary)]" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                                    Roles Asignados
                                </h3>
                            </div>
                            
                            {user.groups && user.groups.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {user.groups.map((group) => (
                                        <div 
                                            key={group.id}
                                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/30 transition-all"
                                        >
                                            <div className="w-6 h-6 rounded bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                                                <User size={12} />
                                            </div>
                                            <span className="text-[13px] font-bold text-[var(--color-text-primary)]">
                                                {group.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[12px] text-[var(--color-text-disabled)] italic py-2">
                                    Este usuario no posee roles asignados en el sistema.
                                </p>
                            )}
                        </motion.div>

                        {/* Card: System Details */}
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
                            className="bg-[var(--color-bg-primary)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] p-5 space-y-4"
                        >
                            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                                <Crown size={16} className="text-[var(--color-warning)]" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                                    Atributos del Sistema
                                </h3>
                            </div>
                            
                            <div className="space-y-3.5">
                                <div className="flex items-center justify-between text-[13px]">
                                    <span className="text-[var(--color-text-secondary)] font-medium">Estado de Staff</span>
                                    <span className={clsx(
                                        "px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                                        user.is_staff 
                                            ? "bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info)]/20" 
                                            : "bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] border border-[var(--color-border-subtle)]"
                                    )}>
                                        {user.is_staff ? 'Habilitado' : 'Inactivo'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[13px]">
                                    <span className="text-[var(--color-text-secondary)] font-medium">Superusuario global</span>
                                    <span className={clsx(
                                        "px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                                        user.is_superuser 
                                            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning)]/20" 
                                            : "bg-[var(--color-bg-secondary)] text-[var(--color-text-disabled)] border border-[var(--color-border-subtle)]"
                                    )}>
                                        {user.is_superuser ? 'Activo' : 'No'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[13px] pt-2 border-t border-[var(--color-border-subtle)]">
                                    <span className="text-[var(--color-text-tertiary)] flex items-center gap-1"><Calendar size={12} /> Creado</span>
                                    <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('es-EC') : '—'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[13px]">
                                    <span className="text-[var(--color-text-tertiary)] flex items-center gap-1"><Calendar size={12} /> Último ingreso</span>
                                    <span className="font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                        {user.last_login ? new Date(user.last_login).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Middle Column: Menu / Module Access */}
                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
                            className="bg-[var(--color-bg-primary)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] p-5 space-y-4"
                        >
                            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                                <Compass size={16} className="text-[var(--color-success)]" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                                    Acceso a Menús y Módulos
                                </h3>
                            </div>

                            {Object.keys(modulesByCategory).length > 0 ? (
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {Object.entries(modulesByCategory).map(([category, items]) => (
                                        <div key={category} className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-disabled)] pl-1">
                                                {category}
                                            </p>
                                            <div className="flex flex-col gap-1.5">
                                                {items.map(item => (
                                                    <div 
                                                        key={item.id}
                                                        className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]/20 transition-all"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 rounded bg-[var(--color-success-bg)] text-[var(--color-success-text)] flex items-center justify-center border border-[var(--color-success)]/10">
                                                                <Folder size={11} />
                                                            </div>
                                                            <span className="text-[12.5px] font-semibold text-[var(--color-text-primary)]">
                                                                {item.label}
                                                            </span>
                                                        </div>
                                                        <span className="font-mono text-[9.5px] text-[var(--color-text-tertiary)]">
                                                            {item.path}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[12px] text-[var(--color-text-disabled)] italic py-2">
                                    Sin acceso a módulos del menú.
                                </p>
                            )}
                        </motion.div>
                    </div>

                    {/* Right Column: Granular Permissions */}
                    <div className="space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.25, ease: 'easeOut' }}
                            className="bg-[var(--color-bg-primary)] rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] p-5 space-y-4"
                        >
                            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border-subtle)]">
                                <Key size={16} className="text-[var(--color-tertiary)]" />
                                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                                    Permisos Granulares (RBAC)
                                </h3>
                            </div>

                            {user.is_superuser ? (
                                <div className="p-4 bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/20 rounded-xl space-y-2 text-center">
                                    <Crown size={24} className="text-[var(--color-warning)] mx-auto fill-[var(--color-warning)]/10 animate-bounce" />
                                    <p className="text-[13px] font-bold text-[var(--color-warning-text)]">Privilegios Ilimitados</p>
                                    <p className="text-[11px] text-[var(--color-warning-text)]/80 leading-normal">
                                        Como superusuario, este usuario posee bypass total y acceso absoluto a todos los módulos y operaciones del sistema.
                                    </p>
                                </div>
                            ) : Object.keys(permissionsByModule).length > 0 ? (
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                    {Object.entries(permissionsByModule).map(([moduleLabel, perms]) => (
                                        <div key={moduleLabel} className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-disabled)] pl-1">
                                                {moduleLabel}
                                            </p>
                                            <div className="flex flex-col gap-1.5">
                                                {perms.map(p => (
                                                    <div 
                                                        key={p.id}
                                                        className="p-2.5 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--color-border-subtle)] space-y-1 hover:border-[var(--color-primary)]/20 transition-all"
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <Lock size={10} className="text-[var(--color-tertiary)]" />
                                                            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                                                                {p.label}
                                                            </span>
                                                        </div>
                                                        <p className="font-mono text-[9px] text-[var(--color-text-tertiary)] pl-3.5">
                                                            {p.codename}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[12px] text-[var(--color-text-disabled)] italic py-2">
                                    Este usuario no cuenta con ningún permiso granular asignado.
                                </p>
                            )}
                        </motion.div>
                    </div>

                </div>
            </div>
        </div>
    );
}
