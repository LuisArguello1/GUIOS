import { memo, useState } from 'react';
import ExpandableFiltersPanel from '../../../components/ui/ExpandableFiltersPanel';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import type { HistoryFilters as Filters } from '../../../api/guiosAdminService';
import type { EvaluationStatus, Recommendation } from '../../../api/guiosPublicService';

const EMPTY: Filters = { software: '', organization: '', recommendation: '', status: '', date_from: '', date_to: '' };

// El Select del proyecto reserva '' para su marcador deshabilitado: 'all' = sin filtro.
const ALL = 'all';
const fromSelect = (value: string) => (value === ALL ? '' : value);

const countActive = (filters: Filters) => Object.values(filters).filter(Boolean).length;
const same = (a: Filters, b: Filters) =>
    (Object.keys(EMPTY) as (keyof Filters)[]).every((k) => (a[k] || '') === (b[k] || ''));

interface HistoryFiltersProps {
    applied: Filters;
    onApply: (filters: Filters) => void;
}

/** Filtros del historial (RF-ADM-34): se editan en borrador y se aplican juntos. */
const HistoryFilters = ({ applied, onApply }: HistoryFiltersProps) => {
    const [draft, setDraft] = useState<Filters>({ ...EMPTY, ...applied });
    const [open, setOpen] = useState(true);
    const set = (key: keyof Filters) => (event: { target: { value: string } }) =>
        setDraft((current) => ({ ...current, [key]: event.target.value }));
    const invalidDates = Boolean(draft.date_from && draft.date_to && draft.date_from > draft.date_to);

    return (
        <ExpandableFiltersPanel
            panelTitle="Filtros del historial"
            activeAppliedFilters={countActive(applied)}
            hasDraftChanges={!same(draft, { ...EMPTY, ...applied })}
            showFilters={open}
            onToggle={() => setOpen((v) => !v)}
            onClear={() => { setDraft(EMPTY); onApply({}); }}
            onApply={() => onApply(Object.fromEntries(Object.entries(draft).filter(([, v]) => v)) as Filters)}
            applyDisabled={invalidDates}
            contentClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
            <Input label="Software" value={draft.software} onChange={set('software')} placeholder="Nombre del software" />
            <Input label="Organización" value={draft.organization} onChange={set('organization')} placeholder="Nombre de la organización" />
            <Select label="Dictamen" value={draft.recommendation || ALL}
                onChange={(e) => setDraft((c) => ({ ...c, recommendation: fromSelect(e.target.value) as Recommendation | '' }))}
                placeholder="Dictamen" options={[
                    { value: ALL, label: 'Todos' },
                    { value: 'A', label: 'A · Adoptar' },
                    { value: 'B', label: 'B · Adoptar con matices' },
                    { value: 'C', label: 'C · Posponer' },
                ]} />
            <Select label="Estado" value={draft.status || ALL}
                onChange={(e) => setDraft((c) => ({ ...c, status: fromSelect(e.target.value) as EvaluationStatus | '' }))}
                placeholder="Estado" options={[
                    { value: ALL, label: 'Todos' },
                    { value: 'in_progress', label: 'En progreso' },
                    { value: 'completed', label: 'Con dictamen' },
                ]} />
            <Input label="Desde (fecha de inicio)" type="date" value={draft.date_from} onChange={set('date_from')} />
            <Input label="Hasta (fecha de inicio)" type="date" value={draft.date_to} onChange={set('date_to')}
                error={invalidDates ? 'La fecha final es anterior a la inicial.' : undefined} />
        </ExpandableFiltersPanel>
    );
};

export default memo(HistoryFilters);
