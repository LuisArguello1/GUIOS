import { memo } from 'react';
import Table from '../../../components/ui/Table';
import type { TableColumn } from '../../../components/ui/Table';
import type { FactorSummary } from '../../../api/guiosPublicService';
import { FODA_INFO, importanceLabel } from '../labels';

const COLUMNS: TableColumn<FactorSummary>[] = [
    { header: 'Factor', accessor: 'name' },
    { header: 'IS', align: 'center', render: (row) => `${row.suggested_importance} · ${importanceLabel(row.suggested_importance)}` },
    { header: 'ID', align: 'center', render: (row) => `${row.decisor_importance} · ${importanceLabel(row.decisor_importance)}` },
    { header: 'IR', align: 'center', render: (row) => `${row.relative_importance} · ${importanceLabel(row.relative_importance)}` },
    { header: 'PM', align: 'center', render: (row) => (row.is_relevant ? row.weighted_average : '—') },
    {
        header: 'FODA',
        render: (row) => (row.is_relevant && row.foda ? FODA_INFO[row.foda].label : 'No relevante (IR 1)'),
    },
];

/** Tabla de factores con IS, ID, IR, PM y FODA. */
const FactorsTable = ({ factors }: { factors: FactorSummary[] }) => (
    <section aria-labelledby="factors-title">
        <h2 id="factors-title" className="mb-3 text-base font-bold text-[var(--color-text-primary)]">Detalle por factor</h2>
        <Table columns={COLUMNS} data={factors} rowKey="factor_id" />
    </section>
);

export default memo(FactorsTable);
