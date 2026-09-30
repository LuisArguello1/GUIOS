import React, { useEffect, useId, memo } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

type ModalSize = 'sm' | 'md' | 'lg' | 'full';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    size?: ModalSize;
    closeOnOverlay?: boolean;
}

const maxWidths: Record<ModalSize, string> = {
    sm:   'max-w-md',
    md:   'max-w-xl',
    lg:   'max-w-3xl',
    full: 'max-w-[95vw]',
};

const maxBodyHeights: Record<ModalSize, string> = {
    sm:   'max-h-[70vh]',
    md:   'max-h-[75vh]',
    lg:   'max-h-[80vh]',
    full: 'max-h-[85vh]',
};

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    closeOnOverlay = true,
}) => {
    const titleId = useId();

    useEffect(() => {
        if (!isOpen) return;

        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 select-none"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
                onClick={closeOnOverlay ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={clsx(
                    'relative w-full flex flex-col overflow-hidden',
                    'bg-[var(--color-bg-elevated)]',
                    'border border-[var(--color-border-subtle)]',
                    'rounded-[8px]',
                    'shadow-2xl',
                    'animate-in zoom-in-95 fade-in duration-150',
                    maxWidths[size]
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/40 shrink-0">
                    {title && (
                        <h3
                            id={titleId}
                            className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider leading-none"
                        >
                            {title}
                        </h3>
                    )}
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className={clsx(
                            'flex items-center justify-center size-6 ml-auto',
                            'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]',
                            'rounded-[4px]',
                            'transition-colors duration-150',
                            'hover:bg-[var(--color-bg-secondary)]',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 cursor-pointer'
                        )}
                    >
                        <X size={14} strokeWidth={2} />
                    </button>
                </div>

                {/* Body */}
                <div
                    className={clsx(
                        'overflow-y-auto px-5 py-4 text-sm text-[var(--color-text-primary)]',
                        'custom-scrollbar',
                        maxBodyHeights[size]
                    )}
                >
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/30 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default memo(Modal);