import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useCatalogAdminStore from '../../app/useCatalogAdminStore';
import { catalogTree, httpError, loginWith } from '../../test/adminFixtures';
import CatalogPage from './CatalogPage';

const service = vi.hoisted(() => ({
    getCatalogTree: vi.fn(),
    createDimension: vi.fn(), updateDimension: vi.fn(), deleteDimension: vi.fn(),
    createFactor: vi.fn(), updateFactor: vi.fn(), deleteFactor: vi.fn(),
    createSubfactor: vi.fn(), updateSubfactor: vi.fn(), deleteSubfactor: vi.fn(),
}));

vi.mock('../../api/guiosAdminService', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../api/guiosAdminService')>()),
    default: service,
}));

const ALL = ['catalog.view', 'catalog.create', 'catalog.edit', 'catalog.delete'];

const renderPage = async () => {
    render(<MemoryRouter><CatalogPage /></MemoryRouter>);
    await screen.findByText('Usabilidad');
};

const factorRow = (name: string) => screen.getByRole('heading', { name }).closest('li') as HTMLElement;

describe('Catálogo del panel', () => {
    beforeEach(() => {
        Object.values(service).forEach((fn) => fn.mockReset());
        service.getCatalogTree.mockResolvedValue(catalogTree());
        useCatalogAdminStore.setState({ tree: [], isLoading: false, error: null });
    });

    it('sin catalog.view muestra acceso denegado', () => {
        loginWith(['evaluations.view']);
        render(<MemoryRouter><CatalogPage /></MemoryRouter>);
        expect(screen.getByText(/No tiene permiso para ver el catálogo/)).toBeInTheDocument();
        expect(service.getCatalogTree).not.toHaveBeenCalled();
    });

    it('con solo catalog.view no muestra crear, editar, activar ni eliminar', async () => {
        loginWith(['catalog.view']);
        await renderPage();
        expect(screen.getByText('Accesibilidad')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Nueva dimensión/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Factor$/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Eliminar/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^(Activar|Desactivar)/ })).not.toBeInTheDocument();
    });

    it('cada botón aparece solo con su permiso', async () => {
        loginWith(['catalog.view', 'catalog.edit']);
        await renderPage();
        expect(screen.getByRole('button', { name: 'Editar Usabilidad' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Nueva dimensión/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Eliminar/ })).not.toBeInTheDocument();
    });

    it('eliminar bloqueado: queda deshabilitado con el motivo visible y accesible', async () => {
        loginWith(ALL);
        await renderPage();
        const base = screen.getByRole('button', { name: 'Eliminar Usabilidad' });
        expect(base).toHaveAttribute('aria-disabled', 'true');
        expect(base).toHaveAccessibleDescription('Es del catálogo base');
        expect(within(factorRow('Usabilidad')).getAllByText('Es del catálogo base')[0]).toBeVisible();
        base.focus();
        expect(base).toHaveFocus();                    // se alcanza con el teclado
        await userEvent.keyboard('{Enter}');
        await userEvent.click(base);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(service.deleteFactor).not.toHaveBeenCalled();

        const custom = screen.getByRole('button', { name: 'Eliminar Accesibilidad' });
        expect(custom).not.toHaveAttribute('aria-disabled');
    });

    it('muestra el mensaje 409 del backend al eliminar', async () => {
        loginWith(ALL);
        service.deleteFactor.mockRejectedValue(httpError(409, {
            detail: 'El factor tiene evaluaciones registradas; puede desactivarlo (RN-07).', code: 'catalog_conflict',
        }));
        await renderPage();
        await userEvent.click(screen.getByRole('button', { name: 'Eliminar Accesibilidad' }));
        const dialog = await screen.findByRole('dialog');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));
        expect(await within(dialog).findByText('El factor tiene evaluaciones registradas; puede desactivarlo (RN-07).')).toBeInTheDocument();
        expect(service.deleteFactor).toHaveBeenCalledWith(11);
    });

    it('muestra el mensaje 400 del backend al activar un factor sin subfactores', async () => {
        loginWith(ALL);
        service.updateFactor.mockRejectedValue(httpError(400, {
            detail: 'Un factor solo se puede activar si tiene al menos un subfactor activo.', code: 'catalog_rule', field: 'is_active',
        }));
        await renderPage();
        await userEvent.click(screen.getByRole('button', { name: 'Activar Accesibilidad' }));
        const dialog = await screen.findByRole('dialog');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));
        expect(await within(dialog).findByText('Un factor solo se puede activar si tiene al menos un subfactor activo.')).toBeInTheDocument();
        expect(service.updateFactor).toHaveBeenCalledWith(11, { is_active: true });
    });

    it('en un factor base, la IS y el ámbito son de solo lectura; el error de guardado se muestra en el formulario', async () => {
        loginWith(ALL);
        service.updateFactor.mockRejectedValue(httpError(400, { name: ['Asegúrese de que este campo no tenga más de 200 caracteres.'] }));
        await renderPage();
        await userEvent.click(screen.getByRole('button', { name: 'Editar Usabilidad' }));
        expect(await screen.findByLabelText(/Importancia Sugerida/)).toBeDisabled();
        expect(screen.getByLabelText(/Ámbito FODA/)).toBeDisabled();
        expect(screen.getByText(/la IS \(Tabla 5.3 de la tesis\) y el ámbito no se modifican/)).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        expect(await screen.findByText('Asegúrese de que este campo no tenga más de 200 caracteres.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
        await userEvent.click(screen.getByRole('button', { name: 'Editar Accesibilidad' }));
        await waitFor(() => expect(screen.getByLabelText(/Importancia Sugerida/)).toBeEnabled());
    });
});
