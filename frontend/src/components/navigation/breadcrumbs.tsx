import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { clsx } from 'clsx';

interface BreadcrumbsProps {
    className?: string;
}

/**
 * Breadcrumbs — Migas de pan limpias con estética TikTok.
 */
const Breadcrumbs = ({ className }: BreadcrumbsProps) => {
    const location = useLocation();
    const pathnames = location.pathname.split('/').filter(Boolean);

    const nameMap: Record<string, string> = {
        dashboard: 'Panel Principal',
        perfil: 'Mi Perfil',
        configuracion: 'Configuración',
        organizacion: 'Organización',
        permisos: 'Roles y Permisos',
        usuarios: 'Usuarios',
        users: 'Usuarios',
        auditoria: 'Auditoría',
        menu: 'Menú',
        catalogo: 'Catálogo',
        evaluaciones: 'Evaluaciones',
    };

    const isIdentifierSegment = (segment: string) => (
        /^\d+$/.test(segment)
        || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)
    );

    return (
        <nav
            aria-label="Breadcrumb"
            className={clsx(
                'flex items-center gap-1.5 text-[11px] mb-5 select-none',
                'overflow-x-auto whitespace-nowrap custom-scrollbar py-0.5',
                className
            )}
        >
            <Link
                to="/dashboard"
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-colors flex items-center gap-1 group p-1 rounded-md hover:bg-[var(--color-bg-secondary)]"
                title="Inicio"
            >
                <Home size={14} className="transition-transform group-hover:scale-105" />
            </Link>

            {pathnames
                .filter(name => !isIdentifierSegment(name))
                .map((name, index, filteredPathnames) => {
                    const originalIndex = pathnames.indexOf(name);
                    const routeTo = `/${pathnames.slice(0, originalIndex + 1).join('/')}`;
                    const isLast = index === filteredPathnames.length - 1;
                    const displayName = nameMap[name.toLowerCase()] || (name.charAt(0).toUpperCase() + name.slice(1));

                    return (
                        <div key={index} className="flex items-center gap-1.5">
                            <ChevronRight size={12} className="text-[var(--color-text-disabled)]" />
                            {isLast ? (
                                <span className="font-bold text-[var(--color-text-primary)]">
                                    {displayName}
                                </span>
                            ) : (
                                <Link
                                    to={routeTo}
                                    className="text-[var(--color-text-secondary)] font-medium hover:text-[var(--color-primary)] transition-colors px-1 py-0.5 rounded-md hover:bg-[var(--color-bg-secondary)]"
                                >
                                    {displayName}
                                </Link>
                            )}
                        </div>
                    );
                })}
        </nav>
    );
};

export default memo(Breadcrumbs);
