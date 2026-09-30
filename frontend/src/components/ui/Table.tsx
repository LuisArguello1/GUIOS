import React, { memo } from 'react';
import { clsx } from 'clsx';
import Skeleton from './Skeleton';

type Align = 'left' | 'center' | 'right';

export interface TableColumn<T = Record<string, unknown>> {
    /** Clave de la propiedad cuando no hay función render */
    accessor?: keyof T & string;
    header: React.ReactNode;
    align?: Align;
    /** Renderizador personalizado */
    render?: (row: T, index: number) => React.ReactNode;
    /** Ancho opcional de columna */
    width?: string;
}

interface TableProps<T = Record<string, unknown>> {
    columns: TableColumn<T>[];
    data: T[];
    isLoading?: boolean;
    skeletonRows?: number;
    onRowClick?: (row: T) => void;
    fixedHeader?: boolean;
    className?: string;
    emptyMessage?: string;
    rowKey?: keyof T & string;
}

const alignClass: Record<Align, string> = {
    left:   'text-left',
    center: 'text-center',
    right:  'text-right',
};

function Table<T = Record<string, unknown>>({
    columns,
    data,
    isLoading     = false,
    skeletonRows  = 6,
    onRowClick,
    fixedHeader   = false,
    className,
    emptyMessage  = 'Sin registros encontrados',
    rowKey,
}: TableProps<T>) {
    const getKey = (row: T, idx: number): React.Key =>
        rowKey ? String(row[rowKey]) : idx;

    return (
        <div className={clsx('w-full overflow-hidden rounded-[8px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]', className)}>
            <div
                className={clsx(
                    'overflow-x-auto custom-scrollbar',
                    fixedHeader && 'max-h-[500px] overflow-y-auto'
                )}
            >
                <table className="w-full text-left border-collapse min-w-[600px]">

                    {/* Anchos de columnas */}
                    {columns.some((c) => c.width) && (
                        <colgroup>
                            {columns.map((col, i) => (
                                <col key={i} style={col.width ? { width: col.width } : undefined} />
                            ))}
                        </colgroup>
                    )}

                    <thead>
                        <tr
                            className={clsx(
                                'bg-[var(--color-bg-secondary)]/60 border-b border-[var(--color-border-subtle)]',
                                fixedHeader && 'sticky top-0 z-10'
                            )}
                        >
                            {columns.map((col, i) => (
                                <th
                                    key={i}
                                    scope="col"
                                    className={clsx(
                                        'px-4 py-3',
                                        'text-[11px] font-bold uppercase tracking-wider whitespace-nowrap',
                                        'text-[var(--color-text-tertiary)]',
                                        alignClass[col.align ?? 'left']
                                    )}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-[var(--color-border-subtle)]">

                        {/* Loading state */}
                        {isLoading &&
                            Array.from({ length: skeletonRows }).map((_, i) => (
                                <tr key={i} aria-hidden="true">
                                    {columns.map((col, j) => (
                                        <td
                                            key={j}
                                            className={clsx(
                                                'px-4 py-3',
                                                alignClass[col.align ?? 'left']
                                            )}
                                        >
                                            <Skeleton className="h-3.5 w-full rounded-[2px]" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        }

                        {/* Empty state */}
                        {!isLoading && data.length === 0 && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-12 text-center text-[12px] font-semibold text-[var(--color-text-disabled)] uppercase tracking-wider"
                                >
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}

                        {/* Data rows */}
                        {!isLoading &&
                            data.map((row, idx) => (
                                <tr
                                    key={getKey(row, idx)}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={clsx(
                                        'transition-colors duration-150',
                                        idx % 2 !== 0 && 'bg-[var(--color-bg-secondary)]/25',
                                        onRowClick
                                            ? 'cursor-pointer hover:bg-[var(--color-primary)]/8'
                                            : 'hover:bg-[var(--color-bg-secondary)]/40'
                                    )}
                                >
                                    {columns.map((col, cIdx) => (
                                        <td
                                            key={cIdx}
                                            className={clsx(
                                                'px-4 py-2.5 text-[12px] sm:text-[13px] text-[var(--color-text-primary)] font-medium',
                                                alignClass[col.align ?? 'left']
                                            )}
                                        >
                                            {col.render
                                                ? col.render(row, idx)
                                                : col.accessor
                                                    ? String(row[col.accessor] ?? '')
                                                    : null}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        }

                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default memo(Table) as typeof Table;