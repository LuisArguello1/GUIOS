import React, { forwardRef, useId, memo } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}

type SelectVariant = 'default' | 'embedded';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options?: SelectOption[];
    error?: string;
    placeholder?: string;
    variant?: SelectVariant;
    selectClassName?: string;
    className?: string;
}

const selectBaseDefault = [
    'block w-full h-10 pl-3.5 pr-10',
    'bg-[var(--color-bg-secondary)]',
    'border border-[var(--color-border-subtle)]',
    'rounded-[4px]',
    'text-[13px] sm:text-[14px] leading-tight text-[var(--color-text-primary)] font-medium',
    'outline-none appearance-none cursor-pointer',
    'transition-all duration-150',
    'hover:border-[var(--color-border-strong)]',
    'focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
].join(' ');

const selectBaseEmbedded = [
    'block w-full pl-0 pr-6 py-1',
    'bg-transparent border-0 rounded-none shadow-none',
    'text-[13px] leading-tight text-[var(--color-text-primary)] font-medium',
    'outline-none appearance-none cursor-pointer',
    'transition-colors duration-150',
    'focus:outline-none focus:ring-0 focus:border-0',
    'disabled:opacity-60 disabled:cursor-default',
].join(' ');

const selectError = [
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

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    (
        {
            label,
            options = [],
            error,
            className,
            selectClassName,
            required = false,
            placeholder = 'Seleccionar opción',
            variant = 'default',
            ...rest
        },
        ref
    ) => {
        const generatedId = useId();
        const id = rest.id ?? generatedId;
        const selectBase = variant === 'embedded' ? selectBaseEmbedded : selectBaseDefault;
        const chevronClass = variant === 'embedded' ? 'right-0' : 'right-3';
        const optionClassName = 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]';

        return (
            <div className={clsx('w-full', className)}>

                {label && (
                    <label htmlFor={id} className={labelBase}>
                        {label}
                        {required && (
                            <span className="text-[var(--color-danger)] ml-0.5">*</span>
                        )}
                    </label>
                )}

                <div className="relative group">
                    <select
                        ref={ref}
                        id={id}
                        required={required}
                        className={clsx(selectBase, selectClassName, error && selectError)}
                        {...rest}
                    >
                        {placeholder && (
                            <option
                                value=""
                                disabled={required}
                                className={clsx('text-[var(--color-text-disabled)] italic', optionClassName)}
                            >
                                {placeholder}
                            </option>
                        )}

                        {options.map((opt) => (
                            <option
                                key={opt.value}
                                value={opt.value}
                                disabled={opt.disabled}
                                className={optionClassName}
                            >
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    <div className={clsx(
                        'absolute top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-tertiary)] group-focus-within:text-[var(--color-primary)] transition-colors duration-150',
                        chevronClass,
                    )}>
                        <ChevronDown size={15} strokeWidth={2} />
                    </div>
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

Select.displayName = 'Select';

export default memo(Select);