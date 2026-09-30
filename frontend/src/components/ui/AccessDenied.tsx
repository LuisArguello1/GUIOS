import { memo } from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import { useLandingPath } from '../../hooks/useLandingPath';

interface AccessDeniedProps {
    title?: string;
    message?: string;
    redirectPath?: string;
    buttonLabel?: string;
}

/**
 * AccessDenied — Componente para restricciones de seguridad con estética TikTok.
 */
const AccessDenied = ({ 
    title = "Acceso restringido", 
    message = "No cuentas con los permisos requeridos para acceder a esta sección.",
    redirectPath,
    buttonLabel = "Volver al panel principal"
}: AccessDeniedProps) => {
    const navigate = useNavigate();
    const landingPath = useLandingPath();
    const targetPath = redirectPath || landingPath;

    return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[460px] p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-full max-w-[420px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-[8px] p-8 text-center shadow-lg">
                <div className="w-14 h-14 mx-auto bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 rounded-[6px] flex items-center justify-center text-[var(--color-danger-text)] mb-5">
                    <ShieldAlert size={28} strokeWidth={2.2} />
                </div>
                
                <h2 className="text-[18px] sm:text-[20px] font-black text-[var(--color-text-primary)] tracking-tight mb-2">
                    {title}
                </h2>
                
                <p className="text-[var(--color-text-secondary)] text-[13px] leading-relaxed mb-6 font-medium max-w-xs mx-auto">
                    {message}
                </p>
                
                <Button
                    variant="primary"
                    className="w-full py-2.5 text-[14px] font-bold rounded-[4px]"
                    onClick={() => navigate(targetPath)}
                    icon={ArrowLeft}
                >
                    {buttonLabel}
                </Button>
            </div>
        </div>
    );
};

export default memo(AccessDenied);
