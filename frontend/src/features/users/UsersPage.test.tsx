import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../../app/useAuthStore';
import useToastStore from '../../app/useToastStore';
import UsersPage from './UsersPage';

const service = vi.hoisted(() => ({ getAll: vi.fn(), getDeleteImpact: vi.fn(), delete: vi.fn(), toggleActive: vi.fn() }));
vi.mock('../../api/userService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../api/userService')>()),
    default: service,
}));

const ANA = {
    id: 7, email: 'ana@example.com', username: 'ana', full_name: 'Ana Pérez', phone: '', is_active: true,
    is_staff: false, created_at: '2026-10-01T10:00:00Z', groups: [1, 2], groups_names: ['Lector GUIOS', 'Editor'],
};

const addToast = vi.fn();
const toastMessages = () => addToast.mock.calls.map(([toast]) => toast.message);

const renderPage = () => render(<MemoryRouter><UsersPage /></MemoryRouter>);

/** La tabla (escritorio) también tiene una versión en tarjetas: se usa la fila de la tabla. */
const anaRow = async () => {
    const matches = await screen.findAllByText('Ana Pérez');
    return matches.map((el) => el.closest('tr')).find(Boolean)!;
};

const openDelete = async (user: ReturnType<typeof userEvent.setup>) => {
    renderPage();
    const row = await anaRow();
    await user.click(within(row).getByRole('button', { name: 'Eliminar' }));
    return screen.findByRole('dialog');
};

describe('Usuarios: roles y aviso antes de eliminar', () => {
    beforeEach(() => {
        useAuthStore.setState({
            isAuthenticated: true,
            user: { id: 1, email: 'admin@example.com', username: 'admin', first_name: 'Admin', last_name: '', is_staff: true, is_superuser: true, permissions: [] },
        });
        useToastStore.setState({ addToast });
        addToast.mockReset();
        Object.values(service).forEach((fn) => fn.mockReset());
        service.getAll.mockResolvedValue({ count: 1, next: null, previous: null, results: [ANA] });
    });

    it('la columna Roles muestra los nombres de los grupos', async () => {
        renderPage();
        const row = await anaRow();
        expect(within(row).getByText('Lector GUIOS')).toBeInTheDocument();
        expect(within(row).getByText('Editor')).toBeInTheDocument();
        expect(within(row).queryByText('Sin roles')).not.toBeInTheDocument();
    });

    it('con registros asociados avisa que se desactivará y muestra el resumen', async () => {
        const user = userEvent.setup();
        service.getDeleteImpact.mockResolvedValue({
            action: 'SOFT_DELETE', total: 15, summary: '12 registros de auditoría, 3 cambios en el catálogo GUIOS',
            items: [{ key: 'audit_other', label: 'registros de auditoría', count: 12 }, { key: 'audit_catalog', label: 'cambios en el catálogo GUIOS', count: 3 }],
        });
        service.delete.mockResolvedValue({ action: 'SOFT_DELETE', message: 'Usuario desactivado en lugar de borrado.', detail: [] });
        const dialog = await openDelete(user);
        expect(service.getDeleteImpact).toHaveBeenCalledWith(7);
        expect(await within(dialog).findByText(/12 registros de auditoría, 3 cambios en el catálogo GUIOS/)).toBeInTheDocument();
        expect(within(dialog).getByText(/se desactivará en lugar de borrarse/)).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Desactivar usuario' }));
        expect(service.delete).toHaveBeenCalledWith(7);
        await waitFor(() => expect(toastMessages()).toContain('Usuario desactivado en lugar de borrado.'));
        expect(service.getAll).toHaveBeenCalledTimes(2);   // la lista se refresca
    });

    it('sin registros mantiene el aviso de borrado permanente', async () => {
        const user = userEvent.setup();
        service.getDeleteImpact.mockResolvedValue({ action: 'HARD_DELETE', total: 0, items: [], summary: '' });
        const dialog = await openDelete(user);
        expect(await within(dialog).findByText(/¿Eliminar permanentemente a Ana Pérez\? No tiene registros asociados/)).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Eliminar definitivamente' })).toBeEnabled();
    });

    it('si la consulta falla deja confirmar con el aviso genérico y muestra el mensaje del DELETE', async () => {
        const user = userEvent.setup();
        service.getDeleteImpact.mockRejectedValue(new Error('Network Error'));
        service.delete.mockResolvedValue({ action: 'HARD_DELETE', message: 'Usuario (ana@example.com) eliminado permanentemente.', detail: [] });
        const dialog = await openDelete(user);
        expect(await within(dialog).findByText(/No se pudo comprobar si Ana Pérez tiene registros asociados/)).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Eliminar definitivamente' }));
        await waitFor(() => expect(toastMessages())
            .toContain('Usuario (ana@example.com) eliminado permanentemente.'));
    });

    it.each([
        [['users.view', 'users.deactivate'], true],
        [['users.view'], false],
    ])('el botón Eliminar depende de users.deactivate (permisos %j)', async (permissions, visible) => {
        useAuthStore.setState({
            isAuthenticated: true,
            user: { id: 2, email: 'gestor@example.com', username: 'gestor', first_name: 'Gestor', last_name: '', is_staff: false, is_superuser: false, permissions },
        });
        renderPage();
        const row = await anaRow();
        expect(Boolean(within(row).queryByRole('button', { name: 'Eliminar' }))).toBe(visible);
    });
});
