import { memo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Toggle from '../../../components/ui/Toggle';
import type { RegistrationPayload } from '../../../api/guiosPublicService';

interface RegistrationFormProps {
    onSubmit: (payload: RegistrationPayload) => Promise<Record<string, string> | void>;
    isSubmitting: boolean;
    /** El servidor tiene IA configurada (ai/status). Si no, el interruptor no aparece. */
    aiAvailable?: boolean;
}

const EMPTY = {
    software_name: '', software_version: '', software_repo_url: '',
    org_name: '', org_sector: '', org_description: '',
};

/** Registro del software candidato y de la organización (RF-PUB-01). */
const RegistrationForm = ({ onSubmit, isSubmitting, aiAvailable = false }: RegistrationFormProps) => {
    const [values, setValues] = useState(EMPTY);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [aiEnabled, setAiEnabled] = useState(false);
    // RF-IA-01: la IA necesita contexto (descripción o repositorio).
    const canEnableAi = Boolean(values.org_description.trim() || values.software_repo_url.trim());

    const change = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
        setValues((current) => ({ ...current, [field]: event.target.value }));

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const local: Record<string, string> = {};
        if (!values.software_name.trim()) local.software_name = 'Escriba el nombre del software.';
        if (!values.org_name.trim()) local.org_name = 'Escriba el nombre de la organización.';
        setErrors(local);
        if (Object.keys(local).length > 0) return;
        const serverErrors = await onSubmit({
            ...values,
            software_name: values.software_name.trim(),
            org_name: values.org_name.trim(),
            software_repo_url: values.software_repo_url.trim() || null,
            ...(aiAvailable ? { ai_enabled: aiEnabled && canEnableAi } : {}),
        });
        if (serverErrors) setErrors(serverErrors);
    };

    return (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Nombre del software" value={values.software_name} onChange={change('software_name')}
                    error={errors.software_name} maxLength={200} placeholder="Ej.: LibreOffice" required />
                <Input label="Versión" value={values.software_version} onChange={change('software_version')}
                    error={errors.software_version} maxLength={50} placeholder="Ej.: 24.2" />
                <Input label="Organización evaluadora" value={values.org_name} onChange={change('org_name')}
                    error={errors.org_name} maxLength={200} placeholder="Ej.: UNEMI" required />
                <Input label="Sector o rubro" value={values.org_sector} onChange={change('org_sector')}
                    error={errors.org_sector} maxLength={150} placeholder="Ej.: Educación superior" />
            </div>
            <Input label="Repositorio o sitio web del software" type="url" value={values.software_repo_url}
                onChange={change('software_repo_url')} error={errors.software_repo_url} placeholder="https://…" />
            <Input isTextArea label="Descripción de la organización y de su necesidad" rows={3}
                value={values.org_description} onChange={change('org_description')} error={errors.org_description}
                maxLength={5000} placeholder="¿Qué se quiere reemplazar o resolver con este software?" />
            {aiAvailable && (
                <div className="space-y-1">
                    <Toggle
                        label="Activar asistencia IA"
                        description="La IA sugiere valores con su justificación; usted decide cada uno. El dictamen lo calcula solo el motor de GUIOS."
                        checked={aiEnabled && canEnableAi}
                        onChange={setAiEnabled}
                        disabled={!canEnableAi}
                        describedBy={canEnableAi ? undefined : 'ai-toggle-reason'}
                    />
                    {!canEnableAi && (
                        <p id="ai-toggle-reason" className="text-xs text-[var(--color-text-secondary)]">
                            Para activarla, escriba la descripción de la organización o el enlace al repositorio del software.
                        </p>
                    )}
                    {errors.ai_enabled && <p className="text-xs text-[var(--color-danger-text)]">{errors.ai_enabled}</p>}
                </div>
            )}
            <p className="text-xs text-[var(--color-text-tertiary)]">
                * Obligatorio. No necesita cuenta: la evaluación se guarda en este navegador y puede retomarla después.
            </p>
            <Button type="submit" icon={ArrowRight} iconPlacement="right" isLoading={isSubmitting}>
                Comenzar evaluación
            </Button>
        </form>
    );
};

export default memo(RegistrationForm);
