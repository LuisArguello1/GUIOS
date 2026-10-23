import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginWith, metrics } from '../../../test/adminFixtures';
import GuiosMetricsPanel from './GuiosMetricsPanel';

const service = vi.hoisted(() => ({ getMetrics: vi.fn() }));
vi.mock('../../../api/guiosAdminService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../api/guiosAdminService')>()),
    default: service,
}));

const renderPanel = () => render(<MemoryRouter><GuiosMetricsPanel /></MemoryRouter>);

describe('Métricas de GUIOS en el tablero', () => {
    beforeEach(() => { service.getMetrics.mockReset().mockResolvedValue(metrics()); });

    it('muestra totales, dictámenes A/B/C con número y porcentaje, y recientes con enlace', async () => {
        loginWith(['dashboard.view', 'evaluations.view']);
        renderPanel();
        expect(await screen.findByText('Evaluaciones recientes')).toBeInTheDocument();
        expect(screen.getByText('Total').nextSibling).toHaveTextContent('5');
        expect(screen.getByText('En progreso').nextSibling).toHaveTextContent('2');
        expect(screen.getByText('Completadas').nextSibling).toHaveTextContent('3');
        expect(within(screen.getByTestId('verdict-A')).getByText('1 (33 %)')).toBeInTheDocument();
        expect(within(screen.getByTestId('verdict-B')).getByText('0 (0 %)')).toBeInTheDocument();
        expect(within(screen.getByTestId('verdict-C')).getByText('2 (67 %)')).toBeInTheDocument();
        expect(screen.getByText('Dictámenes emitidos (3)')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /LibreOffice/ })).toHaveAttribute(
            'href', '/dashboard/evaluaciones/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
        expect(screen.getByRole('link', { name: /Moodle/ })).toHaveTextContent('En progreso');
    });

    it('sin evaluations.view no enlaza al detalle', async () => {
        loginWith(['dashboard.view']);
        renderPanel();
        expect(await screen.findByText('LibreOffice')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
