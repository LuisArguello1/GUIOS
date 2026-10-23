import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEvaluationsAdminStore from '../../app/useEvaluationsAdminStore';
import { loginWith } from '../../test/adminFixtures';
import EvaluationsPage from './EvaluationsPage';

const service = vi.hoisted(() => ({ getEvaluations: vi.fn(), exportCsv: vi.fn() }));
vi.mock('../../api/guiosAdminService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../api/guiosAdminService')>()),
    default: service,
}));
const download = vi.hoisted(() => ({ saveBlob: vi.fn(), filenameFromDisposition: (_: unknown, f: string) => f }));
vi.mock('../../utils/download', () => download);

const row = (n: number) => ({
    uuid: `00000000-0000-4000-8000-00000000000${n}`, software_name: `Software ${n}`, software_version: '',
    org_name: 'UNEMI', org_sector: '', status: 'completed', recommendation: 'C', ai_enabled: false,
    started_at: '2026-10-20T10:00:00Z', completed_at: '2026-10-20T11:00:00Z',
});

const renderPage = () => render(<MemoryRouter><EvaluationsPage /></MemoryRouter>);

describe('Historial de evaluaciones', () => {
    beforeEach(() => {
        service.getEvaluations.mockReset().mockResolvedValue({ count: 45, next: null, previous: null, results: [row(1), row(2)] });
        service.exportCsv.mockReset().mockResolvedValue({ blob: new Blob(['x']), disposition: undefined });
        download.saveBlob.mockReset();
        useEvaluationsAdminStore.setState({ filters: {}, page: 1, results: [], count: 0, isLoading: false, error: null });
    });

    it('aplica los filtros de RF-ADM-34 y vuelve a la página 1', async () => {
        loginWith(['evaluations.view']);
        renderPage();
        expect(await screen.findByText('Software 1')).toBeInTheDocument();
        expect(service.getEvaluations).toHaveBeenLastCalledWith({}, 1, 20);

        await userEvent.type(screen.getByLabelText('Software'), 'Libre');
        await userEvent.type(screen.getByLabelText('Organización'), 'UNEMI');
        await userEvent.selectOptions(screen.getByLabelText('Dictamen'), 'C');
        await userEvent.selectOptions(screen.getByLabelText('Estado'), 'completed');
        await userEvent.type(screen.getByLabelText('Desde (fecha de inicio)'), '2026-10-01');
        await userEvent.type(screen.getByLabelText('Hasta (fecha de inicio)'), '2026-10-31');
        await userEvent.click(screen.getByRole('button', { name: /Aplicar filtros/ }));

        await waitFor(() => expect(service.getEvaluations).toHaveBeenLastCalledWith({
            software: 'Libre', organization: 'UNEMI', recommendation: 'C', status: 'completed',
            date_from: '2026-10-01', date_to: '2026-10-31',
        }, 1, 20));

        await userEvent.selectOptions(screen.getByLabelText('Dictamen'), 'all');
        await userEvent.click(screen.getByRole('button', { name: /Aplicar filtros/ }));
        await waitFor(() => expect(service.getEvaluations.mock.lastCall?.[0]).not.toHaveProperty('recommendation'));
    });

    it('rechaza un rango de fechas invertido', async () => {
        loginWith(['evaluations.view']);
        renderPage();
        await userEvent.type(await screen.findByLabelText('Desde (fecha de inicio)'), '2026-10-31');
        await userEvent.type(screen.getByLabelText('Hasta (fecha de inicio)'), '2026-10-01');
        expect(screen.getByText('La fecha final es anterior a la inicial.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Aplicar filtros/ })).toBeDisabled();
    });

    it('pagina el historial', async () => {
        loginWith(['evaluations.view']);
        renderPage();
        await screen.findByText('Software 1');
        useEvaluationsAdminStore.getState().setPage(2);
        await waitFor(() => expect(service.getEvaluations).toHaveBeenLastCalledWith({}, 2, 20));
    });

    it('exporta el CSV con los filtros aplicados', async () => {
        loginWith(['evaluations.view', 'evaluations.export']);
        useEvaluationsAdminStore.setState({ filters: { status: 'completed', software: 'Libre' } });
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: /Exportar CSV/ }));
        await waitFor(() => expect(service.exportCsv).toHaveBeenCalledWith({ status: 'completed', software: 'Libre' }));
        expect(download.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'evaluaciones-guios.csv');
    });

    it('sin evaluations.export no muestra el botón de exportar', async () => {
        loginWith(['evaluations.view']);
        renderPage();
        await screen.findByText('Software 1');
        expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument();
    });

    it('sin evaluations.view muestra acceso denegado', () => {
        loginWith(['catalog.view']);
        renderPage();
        expect(screen.getByText(/No tiene permiso para ver las evaluaciones/)).toBeInTheDocument();
        expect(service.getEvaluations).not.toHaveBeenCalled();
    });
});
