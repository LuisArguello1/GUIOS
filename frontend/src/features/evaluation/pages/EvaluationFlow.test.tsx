import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEvaluationStore from '../../../app/useEvaluationStore';
import useSavedEvaluationsStore from '../../../app/useSavedEvaluationsStore';
import PublicLayout from '../../../layouts/PublicLayout';
import { createFakeBackend } from '../../../test/fakeGuiosBackend';
import ResultsPage from './ResultsPage';
import StationPage from './StationPage';

const backend = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeBackend> | null }));

vi.mock('../../../api/guiosPublicService', () => ({
    default: new Proxy({}, {
        get: (_target, method: string) => (...args: unknown[]) =>
            (backend.current!.service as unknown as Record<string, (...a: unknown[]) => unknown>)[method](...args),
    }),
}));

// Caso UNEMI con LibreOffice (tesis, Figs. 6.3-6.5): código -> [ID, calificaciones].
const UNEMI: Record<string, [number, number[]]> = {
    'TEC-COM': [4, [4, 4, 4, 4, 4, 4, 4, 2]], 'TEC-PER': [3, [1, 1, 2, 2, 2, 2]],
    'TEC-FIA': [3, [4, 3, 3, 3, 3]], 'TEC-REU': [2, [3, 3]], 'TEC-USA': [3, [4, 3, 4, 3]],
    'TEC-DOC': [3, [3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2]], 'TEC-MAN': [3, [4]], 'TEC-POR': [3, [2, 2]],
    'TEC-PRU': [3, [3]], 'ORG-SOP': [4, [3, 3, 2, 2, 2, 2]], 'ORG-TIE': [2, [4, 3]],
    'ORG-FOR': [3, [3, 3, 3, 2]], 'ORG-CAS': [2, [3]], 'ORG-CEN': [2, [3, 2]], 'ORG-APO': [3, [4]],
    'ORG-BLO': [2, [2]], 'ORG-ACT': [2, [3, 3]], 'ECO-TCO': [3, [4, 3]],
};

const renderAt = (path: string) => render(
    <MemoryRouter initialEntries={[path]}>
        <Routes>
            <Route element={<PublicLayout />}>
                <Route path="/" element={<p>Inicio</p>} />
                <Route path="/evaluacion/:uuid" element={<StationPage />} />
                <Route path="/evaluacion/:uuid/resultados" element={<ResultsPage />} />
            </Route>
            <Route path="/login" element={<p>Pantalla de login</p>} />
        </Routes>
    </MemoryRouter>,
);

const startEvaluation = async () => {
    const created = await backend.current!.service.createEvaluation();
    useSavedEvaluationsStore.getState().add({
        uuid: created.uuid, token: created.session_token,
        software_name: created.software_name, org_name: created.org_name, status: created.status,
    });
    return created;
};

const radio = (group: HTMLElement, value: number | string) =>
    within(group).getByRole('radio', { name: typeof value === 'number' ? new RegExp(`^${value} ·`) : value });

/** Llena la estación con el caso UNEMI usando solo la interfaz. */
const fillUnemi = async (user: ReturnType<typeof userEvent.setup>) => {
    const evaluation = [...backend.current!.evaluations.values()].at(-1)!;
    const dimensions = [...new Set(evaluation.factors.map((f) => f.dimension))];
    for (const dimension of dimensions) {
        await user.click(screen.getByRole('tab', { name: new RegExp(dimension) }));
        for (const factor of evaluation.factors.filter((f) => f.dimension === dimension)) {
            const [id, ratings] = UNEMI[factor.code!];
            const section = document.getElementById(`factor-${factor.factor_id}`)!;
            await user.click(radio(within(section).getByRole('radiogroup', { name: /Importancia del decisor/ }), id));
            const groups = await waitFor(() => {
                const found = within(section).getAllByRole('radiogroup', { name: /^Calificación/ });
                expect(found).toHaveLength(ratings.length);
                return found;
            });
            if (factor.scope_configurable) {
                await user.click(radio(within(section).getByRole('radiogroup', { name: /Ámbito de/ }), 'Interno'));
            }
            for (const [index, rating] of ratings.entries()) {
                await user.click(radio(groups[index], rating));
            }
        }
    }
};

describe('Evaluación pública (estación y resultados)', () => {
    beforeEach(() => {
        backend.current = createFakeBackend();
        useEvaluationStore.getState().reset();
        useSavedEvaluationsStore.setState({ items: [] });
    });

    it('caso UNEMI completo por la interfaz → dictamen C con sus factores causantes', async () => {
        const user = userEvent.setup();
        const { uuid } = await startEvaluation();
        renderAt(`/evaluacion/${uuid}`);

        await screen.findByRole('heading', { name: /LibreOffice/ });
        const generate = screen.getByRole('button', { name: 'Generar dictamen' });
        expect(generate).toBeDisabled();
        expect(screen.getByText('Pendientes (18)')).toBeInTheDocument();

        await fillUnemi(user);

        await waitFor(() => expect(screen.getByRole('button', { name: 'Generar dictamen' })).toBeEnabled());
        expect(screen.getByText(/No falta nada/)).toBeInTheDocument();
        expect(screen.getByText('Guardado')).toBeInTheDocument();

        const calls = backend.current!.calls;
        expect(calls.filter((c) => c.method === 'setDecisorImportance')).toHaveLength(18);
        expect(calls.filter((c) => c.method === 'setRating')).toHaveLength(61);
        expect(calls.filter((c) => c.method === 'setScope')).toEqual([{ method: 'setScope', args: [10, 'internal'] }]);

        await user.click(screen.getByRole('button', { name: 'Generar dictamen' }));
        const confirm = await screen.findAllByRole('button', { name: 'Generar dictamen' });
        await user.click(confirm.at(-1)!);

        expect(await screen.findByText('Recomendación C: Analizar y posponer la adopción', {}, { timeout: 5000 })).toBeInTheDocument();
        const text = screen.getByText(/- Personalización:/).textContent!;
        expect(text).toContain('- Soporte: IR Importante, PM 2.33.');
        expect(text).toContain('- Formación: IR Importante, PM 2.75.');
        expect(text).not.toContain('Documentación');
        expect(within(screen.getByTestId('foda-weakness')).getByText('Formación')).toBeInTheDocument();
        expect(screen.getByText('Evaluación cerrada (solo lectura)')).toBeInTheDocument();
        expect(useSavedEvaluationsStore.getState().items[0].status).toBe('completed');
    }, 60000);

    it('una evaluación cerrada abre en solo lectura y "Duplicar" crea una copia editable', async () => {
        const user = userEvent.setup();
        const { uuid, session_token: token } = await startEvaluation();
        const service = backend.current!.service;
        const evaluation = backend.current!.evaluations.get(uuid)!;
        // ID 1 en todo; los factores que siguen relevantes (IS 3) cumplen: dictamen A.
        for (const factor of evaluation.factors) {
            const summary = await service.setDecisorImportance(uuid, token, factor.factor_id, 1);
            if (summary.factors.find((f) => f.factor_id === factor.factor_id)!.is_relevant) {
                if (factor.scope_configurable) await service.setScope(uuid, token, factor.factor_id, 'internal');
                for (const sub of factor.subfactors) await service.setRating(uuid, token, sub.subfactor_id, 4);
            }
        }
        await service.generateVerdict(uuid, token);

        renderAt(`/evaluacion/${uuid}`);              // la estación redirige a resultados
        expect(await screen.findByText('Recomendación A: Adoptar', {}, { timeout: 5000 })).toBeInTheDocument();
        expect(screen.queryAllByRole('radio')).toHaveLength(0);

        await user.click(screen.getByRole('button', { name: 'Duplicar' }));
        expect(await screen.findByText('Estación de evaluación', {}, { timeout: 5000 })).toBeInTheDocument();
        const copy = useSavedEvaluationsStore.getState().items[0];
        expect(copy.uuid).not.toBe(uuid);
        expect(copy.status).toBe('in_progress');
        const firstFactor = document.getElementById('factor-1')!;
        expect(radio(within(firstFactor).getByRole('radiogroup', { name: /Importancia del decisor/ }), 1))
            .toHaveAttribute('aria-checked', 'true');
        expect(backend.current!.evaluations.get(uuid)!.status).toBe('completed');
    });

    it('si un guardado falla, avisa y permite reintentar', async () => {
        const user = userEvent.setup();
        const { uuid } = await startEvaluation();
        const service = backend.current!.service;
        const original = service.setDecisorImportance;
        service.setDecisorImportance = vi.fn().mockRejectedValueOnce(new Error('Network Error')).mockImplementation(original);

        renderAt(`/evaluacion/${uuid}`);
        await screen.findByRole('heading', { name: /LibreOffice/ });
        const section = document.getElementById('factor-1')!;
        await user.click(radio(within(section).getByRole('radiogroup', { name: /Importancia del decisor/ }), 3));

        expect(await screen.findByText('No se guardó')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Reintentar/ }));
        expect(await screen.findByText('Guardado')).toBeInTheDocument();
        expect(backend.current!.evaluations.get(uuid)!.factors[0].decisor_importance).toBe(3);
    });

    it('sin el token en este navegador muestra un aviso y no lleva al login', async () => {
        renderAt('/evaluacion/eval-desconocida');
        expect(await screen.findByText('Esta evaluación no está disponible en este navegador')).toBeInTheDocument();
        expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument();
    });
});
