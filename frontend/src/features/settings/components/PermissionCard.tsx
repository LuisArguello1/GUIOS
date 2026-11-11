import React, { memo } from 'react';
import * as Icons from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { clsx } from 'clsx';

type ModuleIconKey = keyof typeof Icons;

export interface PermissionModule {
  id: number;
  icon?: ModuleIconKey | null;
  label: string;
  path?: string | null;
}

interface PermissionCardProps {
  module: PermissionModule;
  isActive: boolean;
  onToggle: (module: PermissionModule) => void;
  disabled?: boolean;
}

const PermissionCard = memo(({ module, isActive, onToggle, disabled }: PermissionCardProps) => {
  const Icon: React.ComponentType<LucideProps> =
    module.icon && module.icon in Icons
      ? (Icons[module.icon as ModuleIconKey] as React.ComponentType<LucideProps>)
      : Icons.LayoutGrid;

  return (
    <button
      type="button"
      onClick={() => !disabled && onToggle(module)}
      disabled={disabled}
      aria-pressed={isActive}
      className={clsx(
        // ── Base iOS list row ──
        'w-full flex items-center gap-3 px-4 py-[11px] text-left',
        'bg-[var(--color-bg-primary)]',
        'transition-colors duration-[var(--transition-fast)]',
        !disabled && 'active:bg-[var(--color-bg-secondary)]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* ── Icono — pastilla cuadrada iOS (30×30, radius 8) ── */}
      <div className={clsx(
        'w-[30px] h-[30px] rounded-[8px] flex items-center justify-center shrink-0 transition-colors',
        isActive
          ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)]'
          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]'
      )}>
        <Icon size={15} strokeWidth={2} />
      </div>

      {/* ── Texto ── */}
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'text-[14px] font-medium leading-none mb-[3px] truncate',
          isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
        )}>
          {module.label}
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)] leading-none truncate font-mono">
          {module.path || '—'}
        </p>
      </div>

      {/* ── Toggle switch iOS ── */}
      <div
        className={clsx(
          'w-[44px] h-[26px] rounded-full flex items-center px-[2px] shrink-0',
          'transition-colors duration-200',
          isActive
            ? 'bg-[var(--color-primary)]'
            : 'bg-[var(--color-bg-tertiary)]'
        )}
      >
        <span className={clsx(
          'w-[22px] h-[22px] rounded-full bg-white',
          'shadow-[0_1px_3px_rgba(0,0,0,0.18)]',
          'transition-transform duration-200',
          isActive ? 'translate-x-[18px]' : 'translate-x-0'
        )} />
      </div>
    </button>
  );
});

PermissionCard.displayName = 'PermissionCard';
export default PermissionCard;