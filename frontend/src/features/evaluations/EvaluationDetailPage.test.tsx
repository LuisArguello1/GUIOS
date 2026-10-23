import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { closedDetail, loginWith } from '../../test/adminFixtures';
import EvaluationDetailPage from './EvaluationDetailPage';

const service = vi.hoisted(() => ({ getEvaluation: vi.fn(), exportPdf: vi.fn() }));
vi.mock('../../api/guiosAdminService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../api/guiosAdminService')>()),
    default: service,
}));
const download = vi.hoisted(() => ({ saveBlob: vi.fn(), filenameFromDisposition: (_: unknown, f: string) => f }));
vi.mock('../../utils/download', () => download);

const UUID = '11111111-2222-4333-8444-555555555555';

const renderPage = () => render(
    <MemoryRouter initialEntries={[`/dashboard/evaluaciones/${UUID}`]}>
        <Routes><Route path="/dashboard/evaluaciones/:uuid" element={<EvaluationDetailPage />} /></Routes>
    </MemoryRouter>,
);

describe('Detalle de una evaluación', () => {
    beforeEach(() => {
        service.getEvaluation.mockReset().mockResolvedValue(closedDetail());
        service.exportPdf.mockReset().mockResolvedValue({ blob: new Blob(['%PDF']), disposition: undefined });
        download.saveBlob.mockReset();
    });

    it('evaluación cerrada: muestra el dictamen guardado, la FODA, la tabla y las calificaciones', async () => {
        loginWith(['evaluations.view']);
        renderPage();
        expect(await screen.findByRole('heading', { name: /LibreOffice/ })).toBeInTheDocument();
        expect(service.getEvaluation).toHaveBeenCalledWith(UUID);
        expect(screen.getByText(/Resultados y dictamen guardados al emitir el dictamen/)).toBeInTheDocument();

        expect(screen.getByRole('heading', { name: 'Recomendación C: Analizar y posponer la adopción' })).toBeInTheDocument();
        expect(screen.getByText(/- Formación: IR Importante, PM 2.75, Debilidad\./)).toBeInTheDocument();

        expect(within(screen.getByTestId('foda-weakness')).getByText('Formación')).toBeInTheDocument();
        expect(within(screen.getByTestId('foda-opportunity')).getByText('Compatibilidad')).toBeInTheDocument();

        const table = screen.getByRole('table');
        expect(within(table).getByText('Reusabilidad')).toBeInTheDocument();
        expect(within(table).getByText('No relevante (IR 1)')).toBeInTheDocument();

        const ratings = screen.getByRole('heading', { name: 'Calificación de los subfactores' }).closest('section')!;
        expect(within(ratings).getByText('2 · No se sabe')).toBeInTheDocument();
        expect(within(ratings).getByText('3 · Cumple parcialmente')).toBeInTheDocument();
        expect(within(ratings).queryByText(/Reusabilidad/)).not.toBeInTheDocument();   // IR 1: no se califica

        expect(screen.queryByRole('button', { name: /PDF/ })).not.toBeInTheDocument();
    });

    it('con evaluations.export descarga el PDF', async () => {
        loginWith(['evaluations.view', 'evaluations.export']);
        renderPage();
        await userEvent.click(await screen.findByRole('button', { name: /PDF/ }));
        expect(service.exportPdf).toHaveBeenCalledWith(UUID);
        expect(download.saveBlob).toHaveBeenCalledWith(expect.any(Blob), `evaluacion-guios-${UUID}.pdf`);
    });

    it('evaluación en progreso: indica que se calcula y lista los pendientes', async () => {
        loginWith(['evaluations.view']);
        service.getEvaluation.mockResolvedValue({
            ...closedDetail(), results_source: 'calculated', verdict: null,
            evaluation: { ...closedDetail().evaluation, status: 'in_progress', completed_at: null },
            missing: [{ kind: 'scope', factor_id: 4, factor_name: 'Soporte', subfactor_id: null }],
        });
        renderPage();
        expect(await screen.findByText(/Evaluación en progreso: los valores se calculan/)).toBeInTheDocument();
        expect(screen.getByText('Soporte: falta elegir el ámbito')).toBeInTheDocument();
        expect(screen.queryByText(/Recomendación C/)).not.toBeInTheDocument();
    });

    it('muestra el error si la evaluación no existe', async () => {
        loginWith(['evaluations.view']);
        const { httpError } = await import('../../test/adminFixtures');
        service.getEvaluation.mockRejectedValue(httpError(404, { detail: 'Evaluación no encontrada.' }));
        renderPage();
        expect(await screen.findByText('Evaluación no encontrada.')).toBeInTheDocument();
    });
});
