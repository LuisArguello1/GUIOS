import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllEvaluationHistory,
  getSavedEvaluations,
  removeEvaluationFromHistory,
  saveEvaluationToHistory,
  type SavedEvaluationItem,
} from './historyStorage';

const makeItem = (uuid: string, updatedAt: string): SavedEvaluationItem => ({
  uuid,
  software_name: `Software ${uuid}`,
  org_name: 'Org Demo',
  created_at: '2026-11-01T10:00:00.000Z',
  updated_at: updatedAt,
  step: 2,
  status: 'in_progress',
});

describe('historyStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna lista vacía si no hay historial o si el JSON es inválido', () => {
    expect(getSavedEvaluations()).toEqual([]);
    localStorage.setItem('guios_public_evaluations_history', '{bad-json');
    expect(getSavedEvaluations()).toEqual([]);
  });

  it('guarda, ordena por fecha descendente y limita a 20 elementos', () => {
    for (let i = 1; i <= 22; i++) {
      saveEvaluationToHistory(
        makeItem(`id-${i}`, `2026-11-${String(i).padStart(2, '0')}T10:00:00.000Z`),
      );
    }

    const saved = getSavedEvaluations();
    expect(saved).toHaveLength(20);
    expect(saved[0]?.uuid).toBe('id-22');
  });

  it('actualiza una evaluación existente sin duplicarla', () => {
    saveEvaluationToHistory(makeItem('uuid-1', '2026-11-01T10:00:00.000Z'));
    saveEvaluationToHistory({
      ...makeItem('uuid-1', '2026-11-02T10:00:00.000Z'),
      status: 'completed',
      recommendation: 'C',
    });

    const saved = getSavedEvaluations();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.status).toBe('completed');
    expect(saved[0]?.recommendation).toBe('C');
  });

  it('elimina una evaluación y limpia los punteros activos si coincide', () => {
    saveEvaluationToHistory(makeItem('uuid-1', '2026-11-01T10:00:00.000Z'));
    saveEvaluationToHistory(makeItem('uuid-2', '2026-11-02T10:00:00.000Z'));
    localStorage.setItem('guios_public_evaluation_uuid', 'uuid-1');
    localStorage.setItem('guios_public_evaluation_step', '3');

    removeEvaluationFromHistory('uuid-1');

    expect(getSavedEvaluations().map((x) => x.uuid)).toEqual(['uuid-2']);
    expect(localStorage.getItem('guios_public_evaluation_uuid')).toBeNull();
    expect(localStorage.getItem('guios_public_evaluation_step')).toBeNull();

    clearAllEvaluationHistory();
    expect(getSavedEvaluations()).toEqual([]);
  });
});
