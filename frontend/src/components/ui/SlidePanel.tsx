import React, { useEffect, memo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface SlidePanelProps {
    /** Visibilidad del panel */
    isOpen: boolean;
    /** Callback de cierre */
    onClose: () => void;
    /** Título principal */
    title: string;
    /** Texto secundario debajo del título */
    subtitle?: string;
    /** Contenido del panel */
    children?: ReactNode;
    /** Clase de ancho máximo del panel (Tailwind) */
    width?: string;
}

const SlidePanel: React.FC<SlidePanelProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    width = 'max-w-md',
}) => {
    useEffect(() => {
        if (!isOpen) return;

        document.body.style.overflow = 'hidden';

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);

        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen, onClose]);

    const panelContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] overflow-hidden select-none">

                    {/* ── Overlay ── */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
                    />

                    {/* ── Sheet lateral ── */}
                    <div className="absolute inset-y-0 right-0 flex max-w-full">
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                            className={clsx(
                                'relative h-full w-screen flex flex-col pointer-events-auto',
                                'bg-[var(--color-bg-elevated)]',
                                'border-l border-[var(--color-border-subtle)]',
                                'shadow-2xl',
                                width,
                            )}
                        >
                            {/* ── Header ── */}
                            <div className={clsx(
                                'flex items-center justify-between gap-3',
                                'px-5 py-3.5',
                                'bg-[var(--color-bg-secondary)]/40',
                                'border-b border-[var(--color-border-subtle)]',
                            )}>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[15px] font-bold text-[var(--color-text-primary)] leading-tight truncate tracking-tight">
                                        {title}
                                    </h3>
                                    {subtitle && (
                                        <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 truncate font-normal">
                                            {subtitle}
                                        </p>
                                    )}
                                </div>

                                {/* Botón cerrar */}
                                <button
                                    onClick={onClose}
                                    aria-label="Cerrar panel"
                                    className={clsx(
                                        'w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0',
                                        'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
                                        'hover:bg-[var(--color-bg-secondary)]',
                                        'transition-colors duration-150',
                                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 cursor-pointer',
                                    )}
                                >
                                    <X size={15} strokeWidth={2} />
                                </button>
                            </div>

                            {/* ── Área de contenido ── */}
                            <div
                                className="flex-1 overflow-y-auto custom-scrollbar p-5"
                                style={{ scrollBehavior: 'auto' }}
                            >
                                {children}
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(panelContent, document.body);
};

export default memo(SlidePanel);