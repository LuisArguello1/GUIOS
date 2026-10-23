import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import Alert from '../../../components/ui/Alert';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import type {
    AdminDimension,
    AdminFactor,
    AdminScope,
    AdminSubfactor,
    DimensionPayload,
    FactorPayload,
    SubfactorPayload,
} from '../../../api/guiosAdminService';
import type { Importance } from '../../../api/guiosPublicService';
import type { MutationResult } from '../../../hooks/useCatalogAdmin';
import { IMPORTANCE_OPTIONS } from '../../evaluation/labels';
import { SCOPE_TEXT } from '../labels';

interface FormShellProps {
    onSubmit: () => Promise<MutationResult>;
    onCancel: () => void;
    submitLabel: string;
    children: ReactNode;
}

/** Envoltura común: muestra el mensaje del backend (400/409) si el guardado falla. */
const FormShell = ({ onSubmit, onCancel, submitLabel, children }: FormShellProps) => {
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        const result = await onSubmit();
        setSaving(false);
        if (result.ok) onCancel();
        else setError(result.message ?? 'No se pudo guardar el cambio.');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && <Alert type="error" title="No se guardó" message={error} />}
            {children}
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
                <Button type="submit" isLoading={saving}>{submitLabel}</Button>
            </div>
        </form>
    );
};

const Note = ({ children }: { children: ReactNode }) => (
    <p className="text-[11px] text-[var(--color-text-tertiary)]">{children}</p>
);

// ── Dimensión ─────────────────────────────────────────────────────────────────

interface DimensionFormProps {
    initial: AdminDimension | null;
    onSave: (payload: DimensionPayload) => Promise<MutationResult>;
    onCancel: () => void;
}

export const DimensionForm = ({ initial, onSave, onCancel }: DimensionFormProps) => {
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [order, setOrder] = useState(String(initial?.order ?? 0));
    return (
        <FormShell onCancel={onCancel} submitLabel={initial ? 'Guardar cambios' : 'Crear dimensión'}
            onSubmit={() => onSave({ name: name.trim(), description, order: Number(order) || 0 })}>
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
            <Input isTextArea label="Descripción" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input label="Orden" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
        </FormShell>
    );
};

// ── Factor ────────────────────────────────────────────────────────────────────

interface FactorFormProps {
    initial: AdminFactor | null;
    dimensionId: number | null;
    dimensions: AdminDimension[];
    onSave: (payload: FactorPayload) => Promise<MutationResult>;
    onCancel: () => void;
}

export const FactorForm = ({ initial, dimensionId, dimensions, onSave, onCancel }: FactorFormProps) => {
    const [dimension, setDimension] = useState(String(initial?.dimension ?? dimensionId ?? dimensions[0]?.id ?? ''));
    const [name, setName] = useState(initial?.name ?? '');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [importance, setImportance] = useState(String(initial?.suggested_importance ?? 2));
    const [scope, setScope] = useState<AdminScope>(initial?.scope ?? 'internal');
    const [order, setOrder] = useState(String(initial?.order ?? 0));
    const locked = Boolean(initial?.is_base);

    return (
        <FormShell onCancel={onCancel} submitLabel={initial ? 'Guardar cambios' : 'Crear factor'}
            onSubmit={() => onSave({
                dimension: Number(dimension), name: name.trim(), description,
                suggested_importance: Number(importance) as Importance, scope, order: Number(order) || 0,
            })}>
            {!initial && <Alert type="info" message="El factor se crea inactivo. Actívelo cuando tenga al menos un subfactor activo." />}
            <Select label="Dimensión" value={dimension} onChange={(e) => setDimension(e.target.value)} required
                options={dimensions.map((d) => ({ value: String(d.id), label: d.name }))} />
            <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
            <Input isTextArea label="Descripción" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <Select label="Importancia Sugerida (IS)" value={importance} onChange={(e) => setImportance(e.target.value)}
                disabled={locked} required
                options={IMPORTANCE_OPTIONS.map((o) => ({ value: String(o.value), label: `${o.value} · ${o.label}` }))} />
            <Select label="Ámbito FODA" value={scope} onChange={(e) => setScope(e.target.value as AdminScope)}
                disabled={locked} required
                options={(Object.keys(SCOPE_TEXT) as AdminScope[]).map((value) => ({ value, label: SCOPE_TEXT[value] }))} />
            {locked && <Note>Factor del catálogo base: la IS (Tabla 5.3 de la tesis) y el ámbito no se modifican.</Note>}
            <Input label="Orden" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
        </FormShell>
    );
};

// ── Subfactor ─────────────────────────────────────────────────────────────────

interface SubfactorFormProps {
    initial: AdminSubfactor | null;
    factorId: number | null;
    dimensions: AdminDimension[];
    onSave: (payload: SubfactorPayload) => Promise<MutationResult>;
    onCancel: () => void;
}

export const SubfactorForm = ({ initial, factorId, dimensions, onSave, onCancel }: SubfactorFormProps) => {
    const [factor, setFactor] = useState(String(initial?.factor ?? factorId ?? ''));
    const [description, setDescription] = useState(initial?.description ?? '');
    const [order, setOrder] = useState(String(initial?.order ?? 0));
    const cannotMove = (initial?.evaluations_count ?? 0) > 0;
    const options = dimensions.flatMap((d) => (d.factors ?? []).map((f) => ({ value: String(f.id), label: `${d.name} · ${f.name}` })));

    return (
        <FormShell onCancel={onCancel} submitLabel={initial ? 'Guardar cambios' : 'Crear subfactor'}
            onSubmit={() => onSave({ factor: Number(factor), description: description.trim(), order: Number(order) || 0 })}>
            <Select label="Factor" value={factor} onChange={(e) => setFactor(e.target.value)} disabled={cannotMove} required options={options} />
            {cannotMove && <Note>El subfactor tiene evaluaciones registradas: no se puede mover a otro factor.</Note>}
            <Input isTextArea label="Criterio (afirmación verificable)" rows={3} value={description}
                onChange={(e) => setDescription(e.target.value)} required />
            <Input label="Orden" type="number" min={0} value={order} onChange={(e) => setOrder(e.target.value)} />
        </FormShell>
    );
};
