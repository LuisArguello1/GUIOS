import { memo, useCallback, useState, useRef, type ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

interface MenuItemProps {
    icon?: ElementType;
    label: string;
    path: string;
    isCollapsed: boolean;
    onClick?: () => void;
}

interface TooltipPos {
    top: number;
    left: number;
}

const MenuItem = ({ icon: Icon, label, path, isCollapsed, onClick }: MenuItemProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null);
    const itemRef = useRef<HTMLAnchorElement>(null);

    const handleMouseEnter = useCallback(() => {
        setIsHovered(true);
        if (!isCollapsed || !itemRef.current) return;
        const rect = itemRef.current.getBoundingClientRect();
        setTooltipPos({
            top: rect.top + rect.height / 2,
            left: rect.right + 10,
        });
    }, [isCollapsed]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
        setTooltipPos(null);
    }, []);

    return (
        <>
            <NavLink
                ref={itemRef}
                to={path}
                onClick={onClick}
                end
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={({ isActive }) =>
                    clsx(
                        'group relative flex items-center outline-none transition-all duration-150 select-none',
                        isCollapsed
                            ? 'w-10 h-10 justify-center mx-auto rounded-[4px]'
                            : 'gap-2.5 px-3 py-2 w-full rounded-[4px]',
                        isActive
                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold shadow-xs'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] font-medium'
                    )
                }
            >
                {({ isActive }) => (
                    <>
                        {Icon && (
                            <Icon
                                size={17}
                                strokeWidth={isActive ? 2.5 : 2}
                                className={clsx(
                                    'shrink-0 transition-colors',
                                    isActive
                                        ? 'text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]'
                                )}
                            />
                        )}
                        {!isCollapsed && (
                            <span className="text-[12px] truncate tracking-tight leading-none">
                                {label}
                            </span>
                        )}

                        {/* Indicador de píldora activa cuando no está colapsado */}
                        {!isCollapsed && isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                        )}
                    </>
                )}
            </NavLink>

            {/* Tooltip flotante en estado colapsado */}
            {isCollapsed && isHovered && tooltipPos && createPortal(
                <div
                    className="fixed z-[999999] px-3 py-1.5 shadow-xl text-[11px] font-bold tracking-tight whitespace-nowrap pointer-events-none rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                    style={{
                        top: tooltipPos.top,
                        left: tooltipPos.left,
                        transform: 'translateY(-50%)',
                    }}
                >
                    {label}
                </div>,
                document.body
            )}
        </>
    );
};

export default memo(MenuItem);