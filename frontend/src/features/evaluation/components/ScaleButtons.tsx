import { memo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { clsx } from 'clsx';

export interface ScaleOption<T extends string | number> {
    value: T;
    label: string;
}

interface ScaleButtonsProps<T extends string | number> {
    /** Nombre accesible del grupo (p. ej., "Importancia para el decisor"). */
    label: string;
    options: ScaleOption<T>[];
    value: T | null;
    /** null = volver a "sin calificar". */
    onChange: (value: T | null) => void;
    disabled?: boolean;
    showNumbers?: boolean;
    className?: string;
}

/**
 * Grupo de botones de una escala (radiogroup accesible). Pulsar la opción
 * marcada la desmarca; las flechas mueven la selección.
 */
function ScaleButtons<T extends string | number>({
    label,
    options,
    value,
    onChange,
    disabled = false,
    showNumbers = true,
    className,
}: ScaleButtonsProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const selectedIndex = options.findIndex((option) => option.value === value);

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        let next = -1;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
        if (next < 0) return;
        event.preventDefault();
        refs.current[next]?.focus();
        onChange(options[next].value);
    };

    return (
        <div role="radiogroup" aria-label={label} className={clsx('flex flex-wrap gap-1.5', className)}>
            {options.map((option, index) => {
                const checked = option.value === value;
                const tabbable = selectedIndex === -1 ? index === 0 : checked;
                return (
                    <button
                        key={String(option.value)}
                        ref={(element) => { refs.current[index] = element; }}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        tabIndex={tabbable ? 0 : -1}
                        disabled={disabled}
                        title={checked ? 'Pulse de nuevo para dejar sin calificar' : undefined}
                        onClick={() => onChange(checked ? null : option.value)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={clsx(
                            'min-h-9 rounded-[4px] border px-3 py-1.5 text-xs font-semibold transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]',
                            'disabled:cursor-not-allowed disabled:opacity-60',
                            checked
                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
                                : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]',
                        )}
                    >
                        {showNumbers && typeof option.value === 'number' ? `${option.value} · ` : ''}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export default memo(ScaleButtons) as typeof ScaleButtons;
