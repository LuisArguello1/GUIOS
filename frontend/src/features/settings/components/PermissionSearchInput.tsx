import { memo } from 'react';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';

interface PermissionSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export const PermissionSearchInput = memo(({ value, onChange, placeholder = "Buscar..." }: PermissionSearchInputProps) => {
    return (
        <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--color-text-secondary)] opacity-50">
                <Search size={14} />
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={clsx(
                    'w-full pl-9 pr-9 py-2.5 bg-[var(--color-bg-primary)] border border-[var(--color-border-subtle)]',
                    'rounded-[10px] text-[13px] text-[var(--color-text-primary)] outline-none',
                    'placeholder-[var(--color-text-disabled)] transition-all',
                    'focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_rgba(43,76,126,0.08)]'
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[var(--color-text-secondary)] opacity-50 hover:opacity-100 transition-opacity"
                >
                    <X size={14} />
                </button>
            )}
        </div>
    );
});

PermissionSearchInput.displayName = 'PermissionSearchInput';
export default PermissionSearchInput;
