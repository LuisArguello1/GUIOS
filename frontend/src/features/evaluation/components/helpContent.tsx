import { BarChart3, ClipboardList, ListChecks, Scale } from 'lucide-react';

export type HelpTopic = 'registration' | 'importance' | 'rating' | 'results';

interface HelpStep {
    icon: React.ReactElement;
    title: string;
    description: string;
}

/** Ayuda metodológica por paso, en lenguaje sencillo (RF-PUB-07). */
export const HELP: Record<HelpTopic, { title: string; description: string; steps: HelpStep[] }> = {
    registration: {
        title: 'Cómo funciona GUIOS',
        description:
            'GUIOS es una guía para decidir si conviene adoptar un software libre. Evalúa 18 factores en 3 dimensiones '
            + '(tecnológica, organizacional y económica) con 61 criterios. El resultado es un dictamen A, B o C.',
        steps: [
            { icon: <ClipboardList size={16} />, title: '1. Registro', description: 'Indique el software y su organización. No necesita cuenta.' },
            { icon: <Scale size={16} />, title: '2. Importancia', description: 'Diga cuánto le importa cada factor a su organización.' },
            { icon: <ListChecks size={16} />, title: '3. Calificación', description: 'Califique los criterios de los factores que resulten relevantes.' },
            { icon: <BarChart3 size={16} />, title: '4. Resultados', description: 'Vea la matriz FODA y el dictamen con los factores que lo causan.' },
        ],
    },
    importance: {
        title: 'Importancia de cada factor',
        description:
            'La IS (Importancia Sugerida) la propone la guía según expertos y estudios; es solo una referencia. '
            + 'Usted elige la ID (Importancia del Decisor) según su organización. Con ambas se calcula la IR '
            + '(Importancia Relativa): IR = ⌊(IS + ID) ÷ 2⌋. Si la IR es 1 (Irrelevante), el factor no se califica.',
        steps: [
            { icon: <Scale size={16} />, title: '1 · Irrelevante', description: 'No influye en su decisión.' },
            { icon: <Scale size={16} />, title: '2 · Opcional', description: 'Es deseable, pero puede prescindir de él.' },
            { icon: <Scale size={16} />, title: '3 · Importante', description: 'Pesa en la decisión; un mal resultado preocupa.' },
            { icon: <Scale size={16} />, title: '4 · Fundamental', description: 'Es imprescindible para adoptar el software.' },
        ],
    },
    rating: {
        title: 'Calificación de los criterios',
        description:
            'Cada criterio es una afirmación. Indique cuánto se cumple en su caso. La media de las calificaciones de un '
            + 'factor es su PM (ponderación media): con PM de 3 o más el factor es favorable. "No se sabe" cuenta como 2, '
            + 'así que conviene averiguar antes de marcarlo. En "Soporte" elija si el soporte es interno o externo.',
        steps: [
            { icon: <ListChecks size={16} />, title: '1 · No cumple', description: 'La afirmación no se cumple.' },
            { icon: <ListChecks size={16} />, title: '2 · No se sabe', description: 'No hay información suficiente para afirmarlo.' },
            { icon: <ListChecks size={16} />, title: '3 · Cumple parcialmente', description: 'Se cumple con limitaciones o con trabajo adicional.' },
            { icon: <ListChecks size={16} />, title: '4 · Cumple', description: 'Se cumple plenamente.' },
        ],
    },
    results: {
        title: 'Cómo leer los resultados',
        description:
            'Cada factor relevante se clasifica en la matriz FODA: interno con PM ≥ 3 es Fortaleza y con PM < 3 Debilidad; '
            + 'externo con PM ≥ 3 es Oportunidad y con PM < 3 Amenaza. El dictamen lo calcula el sistema con reglas fijas.',
        steps: [
            { icon: <BarChart3 size={16} />, title: 'A · Adoptar', description: 'No hay Debilidades ni Amenazas en factores relevantes.' },
            { icon: <BarChart3 size={16} />, title: 'B · Adoptar con matices', description: 'Hay Debilidades o Amenazas, solo en factores Opcionales.' },
            { icon: <BarChart3 size={16} />, title: 'C · Posponer', description: 'Hay Debilidades o Amenazas en factores Importantes o Fundamentales. C prevalece sobre B.' },
            { icon: <BarChart3 size={16} />, title: 'Duplicar', description: 'Una evaluación con dictamen no se modifica. Para corregirla, duplíquela.' },
        ],
    },
};
