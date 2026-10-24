import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download } from 'lucide-react';
import AccessDenied from '../../components/ui/AccessDenied';
import Alert from '../../components/ui/Alert';
import Button from '../../components/ui/Button';
import Pagination from '../../components/ui/Pagination';
import PermissionGuard from '../../components/ui/PermissionGuard';
import Table, { type TableColumn } from '../../components/ui/Table';
import { DetailActionButton } from '../../components/ui/ActionIconButtons';
import type { EvaluationListItem } from '../../api/guiosAdminService';
import { HISTORY_PAGE_SIZE } from '../../app/useEvaluationsAdminStore';
import { useEvaluationsAdmin } from '../../hooks/useEvaluationsAdmin';
import usePermissions from '../../hooks/usePermissions';
import HistoryFilters from './components/HistoryFilters';
import { RecommendationBadge, StatusBadge } from './components/StatusBadges';

const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

/** Historial de evaluaciones (RF-ADM-21, 34 y 36). */
const EvaluationsPage = () => {
    const { has } = usePermissions();
    const navigate = useNavigate();
    const history = useEvaluationsAdmin(has('evaluations.view'));

    if (!has('evaluations.view')) {
        return <AccessDenied message="No tiene permiso para ver las evaluaciones de GUIOS (evaluations.view)." />;
    }

    const open = (row: EvaluationListItem) => navigate(`/dashboard/evaluaciones/${row.uuid}`);
    const columns: TableColumn<EvaluationListItem>[] = [
        {
            header: 'Software',
            render: (row) => (
                <span>
                    <span className="block font-semibold">{row.software_name}</span>
                    {row.software_version && <span className="text-xs text-[var(--color-text-tertiary)]">{row.software_version}</span>}
                </span>
            ),
        },
        { header: 'Organización', render: (row) => row.org_name },
        { header: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
        { header: 'Dictamen', render: (row) => <RecommendationBadge value={row.recommendation} /> },
        { header: 'Inicio', render: (row) => formatDate(row.started_at) },
        { header: 'Dictamen emitido', render: (row) => formatDate(row.completed_at) },
        {
            header: <span className="sr-only">Acciones</span>, align: 'right',
            render: (row) => <DetailActionButton title={`Ver detalle de ${row.software_name}`} onClick={() => open(row)} />,
        },
    ];

    return (
        <div className="space-y-4 p-3 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-lg font-bold text-[var(--color-text-primary)]">
                        <ClipboardList size={20} aria-hidden /> Evaluaciones
                    </h1>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        {history.count} evaluaciones{Object.keys(history.filters).length > 0 ? ' con los filtros aplicados' : ''}.
                    </p>
                </div>
                <PermissionGuard require="evaluations.export">
                    <Button variant="outline" icon={Download} isLoading={history.isExporting} onClick={history.exportCsv}>
                        Exportar CSV
                    </Button>
                </PermissionGuard>
            </div>

            <HistoryFilters applied={history.filters} onApply={history.setFilters} />

            {history.error && <Alert type="error" message={history.error} />}
            <Table columns={columns} data={history.results} rowKey="uuid" isLoading={history.isLoading}
                emptyMessage="No hay evaluaciones con estos filtros." />
            <Pagination totalItems={history.count} itemsPerPage={HISTORY_PAGE_SIZE}
                currentPage={history.page} onPageChange={history.setPage} />
        </div>
    );
};

export default EvaluationsPage;
