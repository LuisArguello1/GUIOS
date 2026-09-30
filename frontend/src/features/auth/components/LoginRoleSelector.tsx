import { Shield, Users, ArrowRight } from 'lucide-react';

interface LoginRoleSelectorProps {
    isOpen: boolean;
    onSelectAdmin: () => void;
}

const LoginRoleSelector = ({ isOpen, onSelectAdmin }: LoginRoleSelectorProps) => {
    if (!isOpen) return null;

    const handleClientRedirect = () => {
        if (import.meta.env.DEV) {
            window.location.href = `${window.location.protocol}//${window.location.hostname}:5174/portal/login`;
        } else {
            window.location.href = '/portal/login';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            style={{ background: 'var(--color-bg-page)', opacity: 1 }}
        >
            <div className="w-full max-w-[600px]">

                {/* Header */}
                <div className="text-center mb-8 sm:mb-10">
                    <h2 className="text-[26px] sm:text-[32px] font-black text-[var(--color-text-primary)] tracking-tight leading-tight">
                        Bienvenido a{' '}
                        <span className="text-orange-500">GUIOS</span>
                    </h2>
                    <p className="text-[13px] text-[var(--color-text-tertiary)] mt-2">
                        Selecciona el portal al que deseas acceder para continuar.
                    </p>
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Administración */}
                    <button
                        type="button"
                        onClick={onSelectAdmin}
                        className="group flex flex-col items-start p-6 sm:p-7
                            bg-[var(--color-bg-elevated)]
                            border border-[var(--color-border-subtle)]
                            hover:border-orange-500
                            rounded-2xl text-left
                            transition-all duration-150
                            hover:-translate-y-1
                            active:scale-[0.98]
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                    >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl
                            flex items-center justify-center mb-5
                            bg-orange-500/10 text-orange-500
                            group-hover:bg-orange-500 group-hover:text-white
                            transition-colors duration-150">
                            <Shield size={24} />
                        </div>

                        <h3 className="text-[17px] sm:text-[18px] font-bold text-[var(--color-text-primary)] mb-2">
                            Administración
                        </h3>
                        <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed flex-1 mb-5">
                            Acceso para gerentes, personal de cocina y meseros. Gestiona órdenes, mesas e inventario.
                        </p>
                        <div className="flex items-center gap-1.5 text-orange-500 font-bold text-[12px]">
                            Ingresar al sistema <ArrowRight size={13} />
                        </div>
                    </button>

                    {/* Portal Clientes */}
                    <button
                        type="button"
                        onClick={handleClientRedirect}
                        className="group flex flex-col items-start p-6 sm:p-7
                            bg-[var(--color-bg-elevated)]
                            border border-[var(--color-border-subtle)]
                            hover:border-blue-500
                            rounded-2xl text-left
                            transition-all duration-150
                            hover:-translate-y-1
                            active:scale-[0.98]
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl
                            flex items-center justify-center mb-5
                            bg-blue-500/10 text-blue-500
                            group-hover:bg-blue-500 group-hover:text-white
                            transition-colors duration-150">
                            <Users size={24} />
                        </div>

                        <h3 className="text-[17px] sm:text-[18px] font-bold text-[var(--color-text-primary)] mb-2">
                            Portal Clientes
                        </h3>
                        <p className="text-[13px] text-[var(--color-text-tertiary)] leading-relaxed flex-1 mb-5">
                            Consulta tus deudas, solicita pagos y revisa tu historial de compras en nuestro sistema.
                        </p>
                        <div className="flex items-center gap-1.5 text-blue-500 font-bold text-[12px]">
                            Ir al portal <ArrowRight size={13} />
                        </div>
                    </button>
                </div>

                {/* Footer */}
                <div className="mt-10 text-center">
                    <p className="text-[11px] text-[var(--color-text-disabled)] font-medium">
                        © {new Date().getFullYear()} GUIOS — Todos los derechos reservados
                    </p>
                </div>

            </div>
        </div>
    );
};

export default LoginRoleSelector;