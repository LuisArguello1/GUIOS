import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';
import { Loader2, type LucideIcon } from 'lucide-react';

type InputVariant = 'default' | 'embedded';

interface SharedProps {
    label?: string;
    error?: string;
    icon?: LucideIcon;
    variant?: InputVariant;
    mono?: boolean;
    inputClassName?: string;
    onIconClick?: () => void;
    isLoading?: boolean;
}

interface InputProps extends SharedProps, React.InputHTMLAttributes<HTMLInputElement> {
    isTextArea?: false;
}

interface TextAreaProps extends SharedProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    isTextArea: true;
}

type Props = (InputProps | TextAreaProps) & { className?: string };

const inputBaseDefault = [
    'block w-full h-10 px-3.5',
    'bg-[var(--color-bg-secondary)]',
    'border border-[var(--color-border-subtle)]',
    'rounded-[4px]',
    'text-[13px] sm:text-[14px] leading-tight text-[var(--color-text-primary)]',
    'placeholder:text-[var(--color-text-disabled)] font-medium',
    'outline-none transition-all duration-150',
    'hover:border-[var(--color-border-strong)]',
    'focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]',
    'disabled:text-[var(--color-text-disabled)] disabled:opacity-60 disabled:cursor-not-allowed',
].join(' ');

const inputBaseEmbedded = [
    'block w-full px-0 py-0',
    'bg-transparent border-0 rounded-none shadow-none',
    'text-[13px] leading-tight text-[var(--color-text-primary)] font-medium',
    'placeholder:text-[var(--color-text-disabled)]',
    'outline-none transition-colors duration-150',
    'focus:outline-none focus:ring-0 focus:border-0',
    'disabled:text-[var(--color-text-disabled)] disabled:cursor-default',
    'py-1'
].join(' ');

const inputError = [
    'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20',
].join(' ');

const labelBase = [
    'block text-[11px] font-bold tracking-tight leading-none',
    'text-[var(--color-text-secondary)] select-none mb-1.5',
].join(' ');

const errorBase = [
    'text-[11px] font-semibold text-[var(--color-danger-text)]',
    'tracking-tight mt-1',
].join(' ');

const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, Props>(
    (props, ref) => {
        const {
            label,
            error,
            icon: Icon,
            className,
            inputClassName,
            isTextArea,
            onIconClick,
            variant = 'default',
            mono = false,
            isLoading = false,
            ...rest
        } = props;

        const generatedId = useId();
        const id = (rest as { id?: string }).id ?? generatedId;
        const required = (rest as { required?: boolean }).required ?? false;

        const inputBase = variant === 'embedded' ? inputBaseEmbedded : inputBaseDefault;
        const iconPaddingClass = variant === 'embedded' ? 'pr-6' : 'pr-10';
        const iconClass = clsx(
            'absolute top-1/2 -translate-y-1/2 transition-colors duration-150',
            variant === 'embedded' ? 'right-0' : 'right-3',
            onIconClick
                ? 'cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                : 'pointer-events-none text-[var(--color-text-tertiary)] group-focus-within:text-[var(--color-primary)]'
        );

        const showIconOrLoader = Icon || isLoading;

        return (
            <div className={clsx('space-y-0 w-full', className)}>

                {label && (
                    <label htmlFor={id} className={labelBase}>
                        {label}
                        {required && (
                            <span className="text-[var(--color-danger)] ml-0.5">*</span>
                        )}
                    </label>
                )}

                <div className="relative group">
                    {isTextArea ? (
                        <textarea
                            ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
                            id={id}
                            className={clsx(
                                inputBase,
                                variant === 'embedded' ? 'min-h-[88px] resize-y' : 'min-h-[96px] py-2.5 resize-y',
                                mono && 'font-mono tracking-wider',
                                inputClassName,
                                error && inputError
                            )}
                            {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
                        />
                    ) : (
                        <input
                            ref={ref as React.ForwardedRef<HTMLInputElement>}
                            id={id}
                            className={clsx(
                                inputBase,
                                showIconOrLoader && iconPaddingClass,
                                mono && 'font-mono tracking-wider',
                                inputClassName,
                                error && inputError
                            )}
                            {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
                        />
                    )}

                    {showIconOrLoader && !isTextArea && (
                        <div
                            role={onIconClick ? 'button' : undefined}
                            tabIndex={onIconClick ? 0 : undefined}
                            onKeyDown={
                                onIconClick
                                    ? (e) => { if (e.key === 'Enter') onIconClick(); }
                                    : undefined
                            }
                            onClick={onIconClick}
                            className={iconClass}
                        >
                            {isLoading ? (
                                <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
                            ) : (
                                Icon && <Icon size={16} strokeWidth={2} />
                            )}
                        </div>
                    )}
                </div>

                {error && (
                    <p className={errorBase} role="alert">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export default Input;