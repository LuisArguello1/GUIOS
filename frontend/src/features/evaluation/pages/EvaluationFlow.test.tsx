import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useEvaluationStore from '../../../app/useEvaluationStore';
import useSavedEvaluationsStore from '../../../app/useSavedEvaluationsStore';
import PublicLayout from '../../../layouts/PublicLayout';
import { createFakeBackend, httpError } from '../../../test/fakeGuiosBackend';
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

const startEvaluation = async (aiEnabled = false) => {
    const created = await backend.current!.service.createEvaluation({ ai_enabled: aiEnabled });
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

    it('caso UNEMI completo por la interfaz, sin IA → dictamen C con sus factores causantes', async () => {
        const user = userEvent.setup();
        backend.current!.ai.available = false;          // sin clave: ningún control de IA
        const { uuid } = await startEvaluation(true);
        renderAt(`/evaluacion/${uuid}`);

        await screen.findByRole('heading', { name: /LibreOffice/ });
        expect(screen.queryByRole('button', { name: /Sugerir/ })).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', { name: /Generar resumen con IA/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/Generado por IA/)).not.toBeInTheDocument();
        expect(calls.some((c) => c.method.startsWith('suggest') || c.method === 'generateAiReport')).toBe(false);
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

describe('Asistencia de IA en la evaluación pública', () => {
    beforeEach(() => {
        backend.current = createFakeBackend();
        useEvaluationStore.getState().reset();
        useSavedEvaluationsStore.setState({ items: [] });
    });

    const importanceGroup = (section: HTMLElement) =>
        within(section).getByRole('radiogroup', { name: /Importancia del decisor/ });
    const suggestionBox = (section: HTMLElement) =>
        within(section).queryByRole('group', { name: /^Sugerencia de la IA para la importancia/ });

    const openStation = async (user: ReturnType<typeof userEvent.setup>) => {
        const created = await startEvaluation(true);
        renderAt(`/evaluacion/${created.uuid}`);
        await screen.findByRole('button', { name: 'Sugerir con IA' });
        await user.click(screen.getByRole('button', { name: 'Sugerir con IA' }));
        await waitFor(() => expect(suggestionBox(document.getElementById('factor-1')!)).toBeInTheDocument());
        return created;
    };

    it('la sugerencia de ID aparece junto al control sin cambiar el valor; Aceptar, Cambiar e Ignorar', async () => {
        const user = userEvent.setup();
        const { uuid } = await openStation(user);
        const calls = backend.current!.calls;
        const stored = () => backend.current!.evaluations.get(uuid)!.factors;
        const [first, second, third] = [1, 2, 3].map((id) => document.getElementById(`factor-${id}`)!);
        const suggested = stored()[0].suggested_importance;

        // Sigue sin calificar hasta que el evaluador decide (RN-05).
        expect(within(importanceGroup(first)).getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
        expect(within(suggestionBox(first)!).getByText(`Justificación IA de ${stored()[0].name}.`)).toBeInTheDocument();
        expect(calls.filter((c) => c.method === 'setDecisorImportance')).toHaveLength(0);

        // Aceptar: guarda el valor sugerido.
        await user.click(within(suggestionBox(first)!).getByRole('button', { name: 'Aceptar' }));
        await waitFor(() => expect(stored()[0].decisor_importance).toBe(suggested));
        expect(stored()[0].id_was_ai_accepted).toBe(true);
        expect(radio(importanceGroup(first), suggested)).toHaveAttribute('aria-checked', 'true');
        expect(within(first).getByText(/IA sugirió .* · aceptada/)).toBeInTheDocument();

        // Cambiar: cierra la sugerencia y lleva el foco a la escala, sin guardar.
        await user.click(within(suggestionBox(second)!).getByRole('button', { name: 'Cambiar' }));
        expect(suggestionBox(second)).not.toBeInTheDocument();
        await waitFor(() => expect(importanceGroup(second)).toContainElement(document.activeElement as HTMLElement));
        expect(stored()[1].decisor_importance).toBeNull();
        await user.click(radio(importanceGroup(second), 1));
        await waitFor(() => expect(stored()[1].decisor_importance).toBe(1));
        expect(stored()[1].id_was_ai_accepted).toBe(false);

        // Ignorar: oculta la sugerencia y no guarda nada.
        await user.click(within(suggestionBox(third)!).getByRole('button', { name: 'Ignorar' }));
        expect(suggestionBox(third)).not.toBeInTheDocument();
        expect(stored()[2].decisor_importance).toBeNull();
        expect(calls.filter((c) => c.method === 'setDecisorImportance')).toHaveLength(2);
    });

    it('calificaciones: solo en factores relevantes; "Aceptar todas" guarda solo los subfactores sin calificar', async () => {
        const user = userEvent.setup();
        const { uuid } = await openStation(user);
        const section = document.getElementById('factor-1')!;
        expect(within(section).queryByRole('button', { name: /Sugerir calificaciones/ })).not.toBeInTheDocument();

        await user.click(within(suggestionBox(section)!).getByRole('button', { name: 'Aceptar' }));
        const button = await within(section).findByRole('button', { name: 'Sugerir calificaciones con IA' });
        const groups = within(section).getAllByRole('radiogroup', { name: /^Calificación/ });
        await user.click(radio(groups[0], 1));                       // decisión previa del evaluador
        await user.click(button);
        await within(section).findAllByRole('group', { name: /^Sugerencia de la IA para la calificación/ });

        const factor = () => backend.current!.evaluations.get(uuid)!.factors[0];
        expect(factor().subfactors.every((sub) => sub.ai_suggested_rating === 3)).toBe(true);
        expect(factor().subfactors.slice(1).every((sub) => sub.rating === null)).toBe(true);

        await user.click(within(section).getByRole('button', { name: 'Aceptar todas las de este factor' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/Se guardarán 7 calificaciones/)).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Aceptar todas' }));

        await waitFor(() => expect(factor().subfactors.every((sub) => sub.rating !== null)).toBe(true));
        expect(factor().subfactors[0].rating).toBe(1);               // no se pisa la decisión previa
        expect(factor().subfactors[0].rating_was_ai_accepted).toBe(false);
        expect(factor().subfactors.slice(1).every((sub) => sub.rating === 3 && sub.rating_was_ai_accepted)).toBe(true);
        const ratings = backend.current!.calls.filter((c) => c.method === 'setRating');
        expect(ratings).toHaveLength(8);                              // 1 manual + 7 aceptadas
        expect(within(section).queryByRole('button', { name: 'Aceptar todas las de este factor' })).not.toBeInTheDocument();
    });

    it.each([
        [503, 'ai_unavailable', /no está disponible en este momento/],
        [504, 'ai_timeout', /tardó demasiado en responder/],
        [502, 'ai_invalid_response', /respuesta no válida y se descartó/],
        [429, 'throttled', /límite de solicitudes a la IA/],
    ])('error %i: mensaje claro y la evaluación sigue en modo manual', async (status, code, message) => {
        const user = userEvent.setup();
        const { uuid } = await startEvaluation(true);
        backend.current!.ai.error = httpError(status, { code });
        renderAt(`/evaluacion/${uuid}`);
        await user.click(await screen.findByRole('button', { name: 'Sugerir con IA' }));

        expect(await screen.findByText(message)).toBeInTheDocument();
        expect(screen.getByText(/Puede continuar la evaluación en modo manual/)).toBeInTheDocument();
        const section = document.getElementById('factor-1')!;
        expect(suggestionBox(section)).not.toBeInTheDocument();
        if (status === 503) expect(screen.queryByRole('button', { name: 'Sugerir con IA' })).not.toBeInTheDocument();

        await user.click(radio(importanceGroup(section), 4));
        await waitFor(() => expect(backend.current!.evaluations.get(uuid)!.factors[0].decisor_importance).toBe(4));
    });

    it('resultados: genera el resumen con IA aparte del dictamen y pide confirmación para regenerarlo', async () => {
        const user = userEvent.setup();
        const { uuid, session_token: token } = await startEvaluation(true);
        const service = backend.current!.service;
        for (const factor of backend.current!.evaluations.get(uuid)!.factors) {
            const [id, ratings] = UNEMI[factor.code!];
            await service.setDecisorImportance(uuid, token, factor.factor_id, id as 1 | 2 | 3 | 4);
            if (factor.scope_configurable) await service.setScope(uuid, token, factor.factor_id, 'internal');
            for (const [index, sub] of factor.subfactors.entries()) {
                await service.setRating(uuid, token, sub.subfactor_id, (ratings[index] ?? 3) as 1 | 2 | 3 | 4);
            }
        }
        await service.generateVerdict(uuid, token);

        renderAt(`/evaluacion/${uuid}/resultados`);
        expect(await screen.findByText('Recomendación C: Analizar y posponer la adopción', {}, { timeout: 5000 })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Generar resumen con IA' }));

        const report = await screen.findByRole('region', { name: 'Informe complementario de la IA' });
        expect(within(report).getByText('Generado por IA · orientativo')).toBeInTheDocument();
        expect(await within(report).findByText('Resumen ejecutivo de prueba 1.')).toBeInTheDocument();
        expect(within(report).getByText('Plan de mitigación de prueba.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Recomendación C: Analizar y posponer la adopción' })).toBeInTheDocument();

        await user.click(within(report).getByRole('button', { name: 'Regenerar' }));
        const dialog = await screen.findByRole('dialog');
        expect(backend.current!.calls.filter((c) => c.method === 'generateAiReport')).toHaveLength(1);
        await user.click(within(dialog).getByRole('button', { name: 'Regenerar' }));
        expect(await within(report).findByText('Resumen ejecutivo de prueba 2.')).toBeInTheDocument();
        expect(backend.current!.calls.filter((c) => c.method === 'generateAiReport')).toHaveLength(2);
    });
});
