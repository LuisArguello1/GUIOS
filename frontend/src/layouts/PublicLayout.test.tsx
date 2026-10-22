import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import guiosPublicService from '../api/guiosPublicService';
import PublicLayout from './PublicLayout';

const renderLayout = () => render(
    <MemoryRouter initialEntries={['/']}>
        <Routes>
            <Route element={<PublicLayout />}>
                <Route path="/" element={<p>Inicio público</p>} />
            </Route>
            <Route path="/login" element={<p>Pantalla de login</p>} />
        </Routes>
    </MemoryRouter>,
);

describe('PublicLayout', () => {
    it('si /core/organization/ falla, muestra nombre y logo por defecto sin redirigir', async () => {
        const request = vi.spyOn(guiosPublicService, 'getOrganization')
            .mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }));
        const { container } = renderLayout();
        await waitFor(() => expect(request).toHaveBeenCalled());

        expect(screen.getByTestId('organization-name')).toHaveTextContent('GUIOS PRO');
        expect(container.querySelector('header img')).toHaveAttribute('src', expect.stringContaining('Isotipo'));
        expect(screen.getByText('Inicio público')).toBeInTheDocument();
        expect(screen.queryByText('Pantalla de login')).not.toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('muestra la organización cuando la llamada responde', async () => {
        vi.spyOn(guiosPublicService, 'getOrganization').mockResolvedValue({ name: 'UNEMI', logo: null });
        renderLayout();
        expect(await screen.findByText('UNEMI')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Inicia sesión/ })).toHaveAttribute('href', '/login');
    });
});
