import React, { memo } from 'react';
import { clsx } from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import Modal from './Modal';

interface HelpStep {
    icon:        React.ReactElement;
    title:       string;
    description: string;
    bg?:         string;
    color?:      string;
}

interface GenericHelpModalProps {
    isOpen:       boolean;
    onClose:      () => void;
    title?:       string;
    description?: string;
    steps?:       HelpStep[];
    children?:    React.ReactNode;
    footerText?:  string;
    size?:        'sm' | 'md' | 'lg' | 'full';
}

const GenericHelpModal: React.FC<GenericHelpModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    steps        = [],
    children,
    footerText   = 'Información acerca de este módulo',
    size         = 'lg',
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size={size}>
            <div className="space-y-4 py-1">
                {/* Description block */}
                {description && (
                    <div className={clsx(
                        'px-4 py-3',
                        'bg-[var(--color-bg-secondary)]/50',
                        'border border-[var(--color-border-subtle)]',
                        'rounded-[4px]'
                    )}>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed font-medium">
                            {description}
                        </p>
                    </div>
                )}

                {/* Children override or steps grid */}
                {children ? (
                    <div>{children}</div>
                ) : steps.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                className={clsx(
                                    'flex items-start gap-3 p-3.5',
                                    'bg-[var(--color-bg-secondary)]/40',
                                    'border border-[var(--color-border-subtle)]',
                                    'rounded-[6px]',
                                    'transition-colors duration-150',
                                    'hover:border-[var(--color-border-strong)]',
                                    'animate-in fade-in slide-in-from-bottom-1 duration-150',
                                )}
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                {/* Icon tile */}
                                <div className={clsx(
                                    'size-8 flex items-center justify-center shrink-0',
                                    'border border-[var(--color-border-subtle)]',
                                    'rounded-[4px]',
                                    step.bg    ?? 'bg-[var(--color-bg-secondary)]',
                                    step.color ?? 'text-[var(--color-text-primary)]',
                                )}>
                                    {React.cloneElement(
                                        step.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>,
                                        { size: 15, strokeWidth: 2 }
                                    )}
                                </div>

                                {/* Text */}
                                <div className="min-w-0 flex-1">
                                    <p className={clsx(
                                        'text-[11px] font-bold uppercase tracking-wider leading-none mb-1',
                                        step.color ?? 'text-[var(--color-text-primary)]'
                                    )}>
                                        {step.title}
                                    </p>
                                    <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed font-normal">
                                        {step.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer label */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
                    <CheckCircle2
                        size={12}
                        className="text-[var(--color-success)] shrink-0"
                        aria-hidden="true"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {footerText}
                    </span>
                </div>
            </div>
        </Modal>
    );
};

export default memo(GenericHelpModal);