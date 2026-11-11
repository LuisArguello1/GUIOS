import { memo, useEffect, useState } from 'react';

type AiThinkingPhase = 'literature' | 'importance' | 'ratings' | 'verdict';

const PHASE_MESSAGES: Record<AiThinkingPhase, string[]> = {
    literature: [
        'Consultando repositorios científicos globales (OpenAlex)',
        'Indexando publicaciones arbitradas y DOIs para los subfactores',
        'Mapeando evidencias bibliográficas con criterios metodológicos',
        'Calculando la tasa de citación e importancia sugerida (IS)',
    ],
    importance: [
        'Leyendo el factor que está en pantalla',
        'Contrastando el sector de la organización con ese factor',
        'Proponiendo la importancia del decisor',
        'Dejando la sugerencia lista para que la revises',
    ],
    ratings: [
        'Leyendo los subfactores de este factor',
        'Comparando cada criterio con el software candidato',
        'Proponiendo la calificación de esos subfactores',
        'Dejando las notas listas para que las revises',
    ],
    verdict: [
        'Auditando ponderaciones de factores y umbrales de cuartiles',
        'Redactando el resumen ejecutivo institucional mediante LLM',
        'Estructurando el plan de mitigación para factores críticos',
        'Consolidando el dictamen oficial vinculante (A, B o C)',
    ],
};

interface AiThinkingOverlayProps {
    phase: AiThinkingPhase;
}

/**
 * Overlay de pantalla completa con Cápsula Minimalista (Apple Intelligence style).
 * Totalmente sobrio: orbe de cristal + "Thinking..." + tarea en curso debajo.
 * Dimensiones estrictamente fijas: CERO saltos o movimientos al cambiar de texto.
 */
const AiThinkingOverlay = ({ phase }: AiThinkingOverlayProps) => {
    const messages = PHASE_MESSAGES[phase];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setIndex((current) => (current + 1) % messages.length);
        }, 2800);
        return () => window.clearInterval(timer);
    }, [messages.length]);

    return (
        <div
            className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <style>
                {`
                    @keyframes guios-orb-glow {
                        0%, 100% {
                            box-shadow: inset 0 0 14px rgba(120, 90, 180, 0.3), 0 0 20px rgba(168, 130, 255, 0.25);
                        }
                        50% {
                            box-shadow: inset 0 0 20px rgba(160, 120, 220, 0.45), 0 0 32px rgba(190, 150, 255, 0.45);
                        }
                    }
                    @keyframes guios-band-main {
                        0% { transform: translate(-50%, -65%) rotate(-18deg) scaleX(0.92); }
                        35% { transform: translate(-44%, -30%) rotate(8deg) scaleX(1.06); }
                        70% { transform: translate(-56%, -45%) rotate(16deg) scaleX(0.96); }
                        100% { transform: translate(-50%, -65%) rotate(-18deg) scaleX(0.92); }
                    }
                    @keyframes guios-band-glow {
                        0% { transform: translate(-50%, -25%) rotate(14deg) scaleX(1.1); opacity: 0.45; }
                        50% { transform: translate(-50%, -60%) rotate(-12deg) scaleX(0.88); opacity: 0.8; }
                        100% { transform: translate(-50%, -25%) rotate(14deg) scaleX(1.1); opacity: 0.45; }
                    }
                    @keyframes guios-sheen {
                        0% { transform: translate(-65%, -55%) rotate(22deg); opacity: 0.2; }
                        50% { transform: translate(15%, -25%) rotate(22deg); opacity: 0.6; }
                        100% { transform: translate(-65%, -55%) rotate(22deg); opacity: 0.2; }
                    }
                    @keyframes guios-message-fade {
                        0% { opacity: 0; transform: translateY(2px); }
                        10%, 90% { opacity: 1; transform: translateY(0); }
                        100% { opacity: 0; transform: translateY(-2px); }
                    }
                `}
            </style>

            {/* Cápsula / Pill idéntica a la referencia de Apple Intelligence: dimensiones rígidas para CERO movimiento */}
            <div className="w-[460px] max-w-[92vw] h-[84px] flex items-center gap-4 rounded-full bg-[#161618] py-3 pl-3 pr-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)] border border-white/10 select-none shrink-0">
                {/* Orbe de Cristal (Apple Intelligence / Siri style) */}
                <div
                    className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-full shadow-[0_0_24px_rgba(168,130,255,0.25)]"
                    style={{
                        background: 'radial-gradient(circle at 50% 35%, #3d3250 0%, #1a1524 45%, #0d0c14 100%)',
                        animation: 'guios-orb-glow 2.8s ease-in-out infinite',
                    }}
                    aria-hidden="true"
                >
                    {/* Ribbon de Luz Iridiscente */}
                    <div
                        className="absolute left-1/2 top-1/2 h-4 w-[160%] rounded-full blur-[2px]"
                        style={{
                            background: 'linear-gradient(90deg, transparent 0%, #5eead4 15%, #ffffff 38%, #f472b6 60%, #fbbf24 78%, #a78bfa 90%, transparent 100%)',
                            animation: 'guios-band-main 3.6s ease-in-out infinite',
                        }}
                    />
                    {/* Resplandor Difuso */}
                    <div
                        className="absolute left-1/2 top-1/2 h-7 w-[140%] rounded-full blur-[6px]"
                        style={{
                            background: 'linear-gradient(90deg, transparent, #818cf8 25%, #f472b6 55%, #f59e0b 75%, transparent)',
                            animation: 'guios-band-glow 4.2s ease-in-out infinite',
                        }}
                    />
                    {/* Reflejo Especular Superior */}
                    <div
                        className="absolute left-1/2 top-1/2 h-8 w-10 rounded-full blur-[3px]"
                        style={{
                            background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 70%)',
                            animation: 'guios-sheen 3.6s ease-in-out infinite',
                        }}
                    />
                    {/* Reflejo Perimetral de Cristal */}
                    <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.26),inset_0_1px_2px_rgba(255,255,255,0.4)]" />
                </div>

                {/* Contenedor de Textos con ancho y alto rígidos para CERO layout shift */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className="text-[24px] sm:text-[26px] font-medium leading-none tracking-tight text-[#787880]">
                        Thinking...
                    </span>
                    {/* Viewport fijo de 20px: previene cualquier salto vertical o resize horizontal */}
                    <div className="h-[20px] mt-1.5 flex items-center overflow-hidden">
                        <span
                            key={`${phase}-${index}`}
                            className="text-[11px] sm:text-[12px] leading-tight text-[#636366] truncate block select-none"
                            style={{ animation: 'guios-message-fade 2.8s ease-in-out' }}
                        >
                            {messages[index]}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(AiThinkingOverlay);
