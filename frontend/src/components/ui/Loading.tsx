import { memo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import isotipoImg from '../../assets/img/Isotipo.webp';

interface LoadingProps {
    fullPage?: boolean;
    label?: string;
    className?: string;
}

interface SpinnerContentProps {
    label: string;
    className?: string;
}

const SpinnerContent = memo(({ label, className }: SpinnerContentProps) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className={clsx('flex flex-col items-center gap-6 select-none', className)}
    >
        {/* Contenedor central con Isotipo y Rueda giratoria */}
        <div className="relative flex items-center justify-center w-28 h-28">
            {/* 1. Resplandor difuso ambiental TikTok */}
            <div className="absolute inset-0 bg-[var(--color-primary)] opacity-15 blur-2xl rounded-full scale-125 pointer-events-none" />

            {/* 2. Pista circular estática de fondo */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    className="text-[var(--color-border-subtle)]"
                    strokeWidth="2.5"
                />
            </svg>

            {/* 3. Rueda giratoria animada estilo TikTok (Degradado Coral + Cyan) */}
            <motion.svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            >
                <defs>
                    <linearGradient id="tiktokLoaderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--color-primary)" />
                        <stop offset="60%" stopColor="var(--color-primary)" />
                        <stop offset="100%" stopColor="var(--color-secondary)" />
                    </linearGradient>
                </defs>
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#tiktokLoaderGrad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray="70 200"
                />
            </motion.svg>

            {/* 4. Isotipo centrado con animación sutil de respiración y protección contra arrastre */}
            <motion.div
                animate={{ scale: [0.96, 1.03, 0.96] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="relative z-10 w-14 h-14 flex items-center justify-center"
            >
                <img
                    src={isotipoImg}
                    alt="GUIOS"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full object-contain pointer-events-none drop-shadow-md select-none"
                />
                {/* Capa transparente de protección contra clics/arrastres */}
                <div
                    className="absolute inset-0 z-20 cursor-default"
                    onContextMenu={(e) => e.preventDefault()}
                />
            </motion.div>
        </div>

        {/* Texto de estado y micro-barra de carga */}
        <div className="flex flex-col items-center gap-2">
            <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-text-primary)]"
            >
                {label}
            </motion.p>

            {/* Barra de progreso indeterminada compacta con radio sutil de 2px */}
            <div className="w-24 h-[2px] rounded-[2px] bg-[var(--color-border-subtle)] relative overflow-hidden">
                <motion.div
                    animate={{ left: ['-100%', '100%'] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                    className="absolute top-0 bottom-0 w-1/2 bg-[var(--color-primary)] rounded-[2px]"
                />
            </div>
        </div>
    </motion.div>
));

SpinnerContent.displayName = 'SpinnerContent';

/**
 * Loading — Componente de carga institucional con Isotipo y rueda animada TikTok.
 */
const Loading = ({ fullPage = false, label = "Sincronizando Sistema...", className }: LoadingProps) => {
    if (fullPage) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[99999] bg-[var(--color-bg-page)]/95 backdrop-blur-xs flex items-center justify-center"
            >
                <SpinnerContent label={label} className={className} />
            </motion.div>
        );
    }

    return (
        <div className={clsx('flex items-center justify-center p-8 w-full', className)}>
            <SpinnerContent label={label} />
        </div>
    );
};

export default memo(Loading);
