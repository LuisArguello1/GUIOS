import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { LogIn, Moon, Sun } from 'lucide-react';
import guiosPublicService from '../api/guiosPublicService';
import useThemeStore from '../app/useThemeStore';
import defaultLogo from '../assets/img/Isotipo.webp';
import { getImageUrl } from '../utils/imageUtils';

const DEFAULT_ORGANIZATION_NAME = 'GUIOS PRO';

/**
 * Marco de las pantallas públicas (fuera de /dashboard). La organización se pide
 * sin las cookies del panel; si la llamada falla, se usan un nombre y un logo
 * por defecto, sin mostrar error ni redirigir.
 */
const PublicLayout = () => {
    const { theme, toggleTheme } = useThemeStore();
    const [organization, setOrganization] = useState({ name: DEFAULT_ORGANIZATION_NAME, logo: defaultLogo });

    useEffect(() => {
        let active = true;
        guiosPublicService.getOrganization()
            .then((data) => {
                if (!active) return;
                setOrganization({
                    name: data?.name?.trim() || DEFAULT_ORGANIZATION_NAME,
                    logo: data?.logo ? getImageUrl(data.logo) : defaultLogo,
                });
            })
            .catch(() => undefined); // Se mantienen los valores por defecto.
        return () => { active = false; };
    }, []);

    return (
        <div className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
            <header className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/95 backdrop-blur">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
                    <Link to="/" className="flex min-w-0 items-center gap-2.5">
                        <img
                            src={organization.logo}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-[4px] object-contain"
                            onError={(event) => { event.currentTarget.src = defaultLogo; }}
                        />
                        <span className="min-w-0">
                            <span data-testid="organization-name" className="block truncate text-sm font-bold">{organization.name}</span>
                            <span className="block text-[11px] text-[var(--color-text-secondary)]">Evaluación de software libre · GUIOS</span>
                        </span>
                    </Link>
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={theme === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}
                            className="rounded-[4px] p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                        >
                            {theme === 'dark' ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
                        </button>
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                            <LogIn size={14} aria-hidden />
                            <span className="hidden sm:inline">¿Eres administrador? Inicia sesión</span>
                            <span className="sm:hidden">Administración</span>
                        </Link>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6">
                <Outlet />
            </main>
        </div>
    );
};

export default PublicLayout;
