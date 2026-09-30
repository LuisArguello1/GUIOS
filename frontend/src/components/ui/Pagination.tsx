import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface PaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

interface ArrowBtnProps {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
  hidden?: boolean;
}

const ArrowBtn = ({
  onClick,
  disabled,
  title,
  children,
  hidden = false,
}: ArrowBtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      'flex items-center justify-center',
      'w-8 h-8 rounded-[4px]',
      'bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]',
      'text-[var(--color-text-primary)]',
      'transition-all duration-150',
      'hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border-strong)]',
      'active:scale-95 cursor-pointer',
      'disabled:opacity-30 disabled:pointer-events-none',
      hidden && 'hidden sm:flex'
    )}
  >
    {children}
  </button>
);

const PaginationComponent: React.FC<PaginationProps> = ({
  totalItems,
  itemsPerPage = 20,
  currentPage,
  onPageChange,
  className,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages: (number | string)[] = [];
    const showMax = 5;

    if (totalPages <= showMax) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const handlePageClick = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Paginación"
      className={cn(
        'flex flex-col items-center gap-2.5 py-4 px-2 select-none',
        className
      )}
    >
      {/* Indicador de rango (desktop) */}
      <p className="hidden sm:block text-[11px] font-medium text-[var(--color-text-tertiary)]">
        Mostrando{' '}
        <span className="text-[var(--color-text-primary)] font-bold">
          {(currentPage - 1) * itemsPerPage + 1}–
          {Math.min(currentPage * itemsPerPage, totalItems)}
        </span>{' '}
        de{' '}
        <span className="text-[var(--color-text-primary)] font-bold">
          {totalItems}
        </span>
      </p>

      {/* Controles */}
      <div className="flex items-center gap-1">
        {/* Primera página */}
        <ArrowBtn
          onClick={() => handlePageClick(1)}
          disabled={currentPage === 1}
          title="Primera página"
          hidden
        >
          <ChevronsLeft size={14} />
        </ArrowBtn>

        {/* Anterior */}
        <ArrowBtn
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={currentPage === 1}
          title="Anterior"
        >
          <ChevronLeft size={14} />
        </ArrowBtn>

        {/* ── Números (desktop) ── */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-0.5',
            'p-0.5 rounded-[4px]',
            'bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]'
          )}
        >
          {getPages().map((page, idx) =>
            typeof page === 'number' ? (
              <button
                key={idx}
                onClick={() => handlePageClick(page)}
                className={cn(
                  'min-w-[30px] h-[28px] px-2 rounded-[4px]',
                  'text-[12px] font-bold font-sans',
                  'transition-all duration-150 active:scale-95 cursor-pointer',
                  currentPage === page
                    ? 'bg-[var(--color-primary)] text-[var(--color-text-on-primary)] shadow-xs'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                )}
              >
                {page}
              </button>
            ) : (
              <span
                key={idx}
                className="min-w-[24px] text-center text-[12px] text-[var(--color-text-tertiary)] select-none"
              >
                ···
              </span>
            )
          )}
        </div>

        {/* ── Indicador móvil: dots ── */}
        <div className="sm:hidden flex items-center gap-1 mx-2">
          {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
            const page = i + 1;
            const isActive = page === currentPage;
            return (
              <button
                key={page}
                onClick={() => handlePageClick(page)}
                aria-label={`Página ${page}`}
                className={cn(
                  'h-[6px] rounded-[2px] transition-all duration-150',
                  isActive
                    ? 'w-4 bg-[var(--color-primary)]'
                    : 'w-1.5 bg-[var(--color-bg-tertiary)]'
                )}
              />
            );
          })}
        </div>

        {/* Siguiente */}
        <ArrowBtn
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Siguiente"
        >
          <ChevronRight size={14} />
        </ArrowBtn>

        {/* Última página */}
        <ArrowBtn
          onClick={() => handlePageClick(totalPages)}
          disabled={currentPage === totalPages}
          title="Última página"
          hidden
        >
          <ChevronsRight size={14} />
        </ArrowBtn>
      </div>

      {/* Contador móvil */}
      <p className="sm:hidden text-[11px] font-medium text-[var(--color-text-secondary)]">
        <span className="text-[var(--color-text-primary)] font-bold">{currentPage}</span>
        {' '}de{' '}
        <span className="text-[var(--color-text-primary)] font-bold">{totalPages}</span>
      </p>
    </nav>
  );
};

export const Pagination = memo(PaginationComponent);
export default Pagination;