import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EvaluationDetail } from '../../../../../api/evaluationService';
import { MitigationPlanTable } from './MitigationPlanTable';

const baseEvaluation: EvaluationDetail = {
  id: 1,
  uuid: 'uuid-mit',
  software_name: 'GLPI',
  software_category: 'ITSM',
  software_version: '10.0',
  software_repo_url: null,
  software_description: 'Mesa de ayuda',
  org_name: 'Org',
  org_sector: 'TI',
  org_description: 'Área de TI',
  status: 'completed',
  ai_enabled: true,
  ai_status: 'completed',
  created_by_username: null,
  started_at: '2026-11-10T10:00:00Z',
  completed_at: '2026-11-10T11:00:00Z',
  recommendation: 'C',
  q1_threshold: '1.0',
  q2_threshold: '2.0',
  q3_threshold: '3.0',
  q4_threshold: '4.0',
  factors: [
    {
      id: 1,
      factor_id: 11,
      factor_name: 'Seguridad',
      dimension_id: 1,
      dimension_name: 'Tecnológica',
      dimension_order: 1,
      order: 1,
      systemic_importance_snapshot: 3,
      subfactors_count_snapshot: 1,
      citations_count: 5,
      citation_ratio: '5.00',
      literature_importance_calculated: 3,
      expert_importance_snapshot: 3,
      decisor_importance: 4,
      relative_importance: 3,
      is_relevant: true,
      scope_used: 'internal',
      ai_literature_sources: [],
    },
  ],
  subfactors: [
    {
      id: 1,
      subfactor_id: 1001,
      factor_id: 11,
      factor_name: 'Seguridad',
      order: 1,
      description_snapshot: 'Cifrado en reposo',
      ai_citations_count: 2,
      rating: 2,
      saved_at: '2026-11-10T10:20:00Z',
    },
  ],
  results: [
    {
      id: 1,
      factor_id: 11,
      factor_name: 'Seguridad',
      weighted_average: '2.0',
      meets_threshold: false,
      foda_classification: 'weakness',
      foda_display: 'Debilidad',
      calculated_at: '2026-11-10T10:30:00Z',
    },
  ],
  verdict: null,
};

describe('MitigationPlanTable', () => {
  it('parsea la tabla Markdown de IA y permite cambiar entre Tabla y Texto', () => {
    const markdownTable = [
      '| Factor / Brecha | Riesgo Metodológico | Acción Correctiva | Responsable | Meta de Aprobación |',
      '| :--- | :--- | :--- | :--- | :--- |',
      '| Seguridad | Exposición sin cifrado | Habilitar TLS y cifrado AES | Seguridad TI | PM >= 3.0 en auditoría |',
    ].join('\n');

    render(
      <MitigationPlanTable
        evaluation={baseEvaluation}
        mitigationPlanText={markdownTable}
      />,
    );

    expect(screen.getAllByText('Seguridad').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Habilitar TLS y cifrado AES/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Seguridad TI/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Texto/i }));
    expect(screen.getAllByText(/Exposición sin cifrado/).length).toBeGreaterThan(0);
  });
});
