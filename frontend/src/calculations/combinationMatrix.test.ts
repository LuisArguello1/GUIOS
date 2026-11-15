import { describe, expect, it } from 'vitest';
import {
  calculateRelativeImportance,
  calculateSuggestedImportance,
  classifyFoda,
  classifyRecommendation,
  combineImportance,
  roundWeightedAverage,
} from './combinationMatrix';

describe('combinationMatrix', () => {
  it('calcula la matriz simétrica 4x4 y acota valores fuera de rango', () => {
    expect(combineImportance(1, 1)).toBe(1);
    expect(combineImportance(3, 1)).toBe(2);
    expect(combineImportance(4, 4)).toBe(4);
    expect(combineImportance(0, 5)).toBe(2); // clamp -> (1, 4) = 2
  });

  it('calcula IS = M(IE, IL) e IR = M(ID, IS)', () => {
    expect(calculateSuggestedImportance(1, 3)).toBe(2);
    expect(calculateSuggestedImportance(4, 4)).toBe(4);
    expect(calculateRelativeImportance(2, 3)).toBe(2);
    expect(calculateRelativeImportance(4, 3)).toBe(3);
  });

  it('redondea la ponderación media a un decimal', () => {
    expect(roundWeightedAverage([])).toBe(0);
    expect(roundWeightedAverage([3, 3])).toBe(3);
    expect(roundWeightedAverage([4, 3, 3])).toBe(3.3);
    expect(roundWeightedAverage([2, 3, 3, 3])).toBe(2.8);
  });

  it('clasifica FODA según umbral 3.0 y ámbito interno/externo', () => {
    expect(classifyFoda(3.0, 'internal')).toBe('Fortaleza');
    expect(classifyFoda(2.9, 'internal')).toBe('Debilidad');
    expect(classifyFoda(3.1, 'external')).toBe('Oportunidad');
    expect(classifyFoda(2.5, 'external')).toBe('Amenaza');
  });

  it('asigna dictamen A, B o C según criticidad y mayoría de fallos', () => {
    expect(classifyRecommendation([])).toBeNull();
    expect(
      classifyRecommendation([
        { meetsThreshold: true, relativeImportance: 4 },
        { meetsThreshold: false, relativeImportance: 1 },
      ]),
    ).toBe('A');
    expect(
      classifyRecommendation([
        { meetsThreshold: false, relativeImportance: 2 },
        { meetsThreshold: true, relativeImportance: 3 },
      ]),
    ).toBe('B');
    expect(
      classifyRecommendation([
        { meetsThreshold: false, relativeImportance: 2 },
        { meetsThreshold: false, relativeImportance: 1 },
        { meetsThreshold: true, relativeImportance: 3 },
      ]),
    ).toBe('B');
    expect(
      classifyRecommendation([
        { meetsThreshold: false, relativeImportance: 2 },
        { meetsThreshold: false, relativeImportance: 2 },
        { meetsThreshold: true, relativeImportance: 3 },
      ]),
    ).toBe('C');
    expect(
      classifyRecommendation([
        { meetsThreshold: false, relativeImportance: 2 },
        { meetsThreshold: false, relativeImportance: 3 },
        { meetsThreshold: true, relativeImportance: 4 },
        { meetsThreshold: true, relativeImportance: 4 },
      ]),
    ).toBe('C');
  });
});
