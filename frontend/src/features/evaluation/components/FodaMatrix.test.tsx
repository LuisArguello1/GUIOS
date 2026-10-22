import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FactorSummary } from '../../../api/guiosPublicService';
import FodaMatrix from './FodaMatrix';

const factor = (id: number, name: string, foda: FactorSummary['foda'], relevant = true): FactorSummary => ({
    factor_id: id, code: null, name, suggested_importance: 3, decisor_importance: 3,
    relative_importance: relevant ? 3 : 1, relative_importance_label: null, is_relevant: relevant,
    scope_used: 'internal', scope_configurable: false, weighted_average: '2.75', meets_threshold: false,
    foda, subfactors_total: 4, subfactors_rated: 4, failing_subfactors: [],
});

describe('FodaMatrix', () => {
    it('agrupa los factores relevantes en los cuatro cuadrantes con texto', () => {
        render(<FodaMatrix factors={[
            factor(1, 'Formación', 'weakness'),
            factor(2, 'Soporte', 'weakness'),
            factor(3, 'Compatibilidad', 'opportunity'),
            factor(4, 'Coste total de propiedad', 'strength'),
            factor(5, 'Reusabilidad', null, false),
        ]} />);

        const weakness = screen.getByTestId('foda-weakness');
        expect(within(weakness).getByRole('heading')).toHaveTextContent('Debilidades (2)');
        expect(within(weakness).getByText('Ámbito interno · PM < 3')).toBeInTheDocument();
        expect(within(weakness).getByText('Formación')).toBeInTheDocument();
        expect(within(weakness).getByText('Soporte')).toBeInTheDocument();

        expect(within(screen.getByTestId('foda-opportunity')).getByText('Compatibilidad')).toBeInTheDocument();
        expect(within(screen.getByTestId('foda-strength')).getByRole('heading')).toHaveTextContent('Fortalezas (1)');
        expect(within(screen.getByTestId('foda-threat')).getByText('Ningún factor')).toBeInTheDocument();
        expect(screen.queryByText('Reusabilidad')).not.toBeInTheDocument();
    });
});
