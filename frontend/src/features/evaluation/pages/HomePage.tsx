import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import Card from '../../../components/ui/Card';
import GenericHelpModal from '../../../components/ui/GenericHelpModal';
import guiosPublicService, { type RegistrationPayload } from '../../../api/guiosPublicService';
import { getErrorData, getErrorStatus } from '../../../api/publicAxios';
import useSavedEvaluationsStore from '../../../app/useSavedEvaluationsStore';
import useToastStore from '../../../app/useToastStore';
import RegistrationForm from '../components/RegistrationForm';
import SavedEvaluationsList from '../components/SavedEvaluationsList';
import { HELP } from '../components/helpContent';

/** Inicio público: registro de una evaluación y evaluaciones de este navegador. */
const HomePage = () => {
    const navigate = useNavigate();
    const { items, add, remove } = useSavedEvaluationsStore();
    const addToast = useToastStore((state) => state.addToast);
    const [submitting, setSubmitting] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    const handleSubmit = async (payload: RegistrationPayload) => {
        setSubmitting(true);
        try {
            const created = await guiosPublicService.createEvaluation(payload);
            add({
                uuid: created.uuid,
                token: created.session_token,
                software_name: created.software_name,
                org_name: created.org_name,
                status: created.status,
            });
            navigate(`/evaluacion/${created.uuid}`);
        } catch (error) {
            const status = getErrorStatus(error);
            if (status === 400) {
                const data = getErrorData<Record<string, string[]>>(error) ?? {};
                return Object.fromEntries(Object.entries(data).map(([field, messages]) => [field, String(messages?.[0] ?? '')]));
            }
            addToast({
                type: 'error',
                message: status === 429
                    ? 'Se alcanzó el límite de evaluaciones nuevas desde esta red. Intente más tarde.'
                    : 'No se pudo crear la evaluación. Revise su conexión e intente de nuevo.',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Evalúe la adopción de un software libre</h1>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                            Guía GUIOS: 18 factores y 61 criterios en las dimensiones tecnológica, organizacional y
                            económica. Al final obtendrá un dictamen A, B o C con los factores que lo explican.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]"
                    >
                        <HelpCircle size={15} aria-hidden /> ¿Cómo funciona?
                    </button>
                </div>
                <Card title="Datos del software y de la organización">
                    <RegistrationForm onSubmit={handleSubmit} isSubmitting={submitting} />
                </Card>
            </div>
            <Card title="Continuar una evaluación" subtitle="Guardadas en este navegador">
                <SavedEvaluationsList items={items} onRemove={remove} />
            </Card>
            <GenericHelpModal
                isOpen={helpOpen}
                onClose={() => setHelpOpen(false)}
                footerText="Ayuda metodológica GUIOS"
                {...HELP.registration}
            />
        </div>
    );
};

export default HomePage;
