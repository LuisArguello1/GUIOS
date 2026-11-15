import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  EvaluationFactorItem,
  EvaluationResultItem,
  EvaluationSubfactorItem,
} from '../../../../../api/evaluationService';
import { FactorMethodologyAuditCard } from './FactorMethodologyAuditCard';

const factor: EvaluationFactorItem = {
  id: 1,
  factor_id: 50,
  factor_name: 'Reutilización',
  dimension_id: 1,
  dimension_name: 'Tecnológica',
  dimension_order: 1,
  order: 1,
  systemic_importance_snapshot: 2,
  subfactors_count_snapshot: 2,
  citations_count: 0,
  citation_ratio: '0.00',
  literature_importance_calculated: 1,
  expert_importance_snapshot: 3,
  decisor_importance: 3,
  relative_importance: 2,
  is_relevant: true,
  scope_used: 'external',
  ai_literature_sources: [],
};

const subfactors: EvaluationSubfactorItem[] = [
  {
    id: 1,
    subfactor_id: 501,
    factor_id: 50,
    factor_name: 'Reutilización',
    order: 1,
    description_snapshot: 'API modular',
    ai_citations_count: 0,
    rating: 3,
    saved_at: '2026-11-10T10:00:00Z',
  },
  {
    id: 2,
    subfactor_id: 502,
    factor_id: 50,
    factor_name: 'Reutilización',
    order: 2,
    description_snapshot: 'Compatibilidad',
    ai_citations_count: 0,
    rating: 3,
    saved_at: '2026-11-10T10:00:00Z',
  },
];

const result: EvaluationResultItem = {
  id: 1,
  factor_id: 50,
  factor_name: 'Reutilización',
  weighted_average: '3.0',
  meets_threshold: true,
  foda_classification: 'opportunity',
  foda_display: 'Oportunidad',
  calculated_at: '2026-11-10T10:15:00Z',
};

describe('FactorMethodologyAuditCard', () => {
  it('renderiza cálculo de PM y dispara filtro al hacer clic en una fila de escala', () => {
    const onSelectRatingFilter = vi.fn();
    render(
      <FactorMethodologyAuditCard
        factor={factor}
        subfactors={subfactors}
        result={result}
        activeRatingFilter={null}
        onSelectRatingFilter={onSelectRatingFilter}
        mode="pm"
      />,
    );

    expect(screen.getByText('PM = 3.0')).toBeInTheDocument();
    expect(screen.getByText('3.00')).toBeInTheDocument();
    expect(screen.getAllByText('Oportunidad').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText(/Parcial/i));
    expect(onSelectRatingFilter).toHaveBeenCalledWith(3);
  });

  it('muestra las matrices IS e IR en mode="importance"', () => {
    render(
      <FactorMethodologyAuditCard
        factor={factor}
        subfactors={subfactors}
        result={result}
        activeRatingFilter={null}
        onSelectRatingFilter={vi.fn()}
        mode="importance"
      />,
    );

    expect(screen.getByText(/IS = 2 · Opcional/)).toBeInTheDocument();
    expect(screen.getByText(/IR = 2 · Opcional/)).toBeInTheDocument();
  });
});
