import { describe, expect, test } from 'vitest';
import { convertWeightsMode, validateWeights } from './weights';

describe('convertWeightsMode', () => {
  test('gleicher Modus bleibt unverändert', () => {
    const weights = { ka: 50, tests: 25, muendlich: 25, mode: 'percent' as const };
    expect(convertWeightsMode(weights, 'percent')).toEqual(weights);
  });

  test('percent → factor teilt durch 25 (geklemmt 1–5)', () => {
    expect(convertWeightsMode({ ka: 50, tests: 25, muendlich: 25, mode: 'percent' }, 'factor')).toEqual({
      ka: 2,
      tests: 1,
      muendlich: 1,
      mode: 'factor',
    });
    expect(convertWeightsMode({ ka: 100, tests: 0, muendlich: 0, mode: 'percent' }, 'factor')).toEqual({
      ka: 4,
      tests: 1,
      muendlich: 1,
      mode: 'factor',
    });
  });

  test('factor → percent normiert auf Summe 100', () => {
    expect(convertWeightsMode({ ka: 2, tests: 1, muendlich: 1, mode: 'factor' }, 'percent')).toEqual({
      ka: 50,
      tests: 25,
      muendlich: 25,
      mode: 'percent',
    });
  });

  test('factor → percent: Rundungsrest geht in die letzte Komponente (Summe bleibt 100)', () => {
    const result = convertWeightsMode({ ka: 1, tests: 1, muendlich: 1, mode: 'factor' }, 'percent');
    expect(result.ka + result.tests + result.muendlich).toBe(100);
    expect(result).toEqual({ ka: 33, tests: 33, muendlich: 34, mode: 'percent' });
  });
});

describe('validateWeights', () => {
  test('percent: gültig bei Summe 100', () => {
    expect(validateWeights({ ka: 50, tests: 25, muendlich: 25, mode: 'percent' })).toBeNull();
  });

  test('percent: Fehlermeldung wenn Summe nicht 100', () => {
    expect(validateWeights({ ka: 50, tests: 25, muendlich: 30, mode: 'percent' })).toContain('100');
  });

  test('factor: gültig bei ganzen Zahlen 1–5', () => {
    expect(validateWeights({ ka: 5, tests: 1, muendlich: 3, mode: 'factor' })).toBeNull();
  });

  test('factor: Fehlermeldung außerhalb 1–5 oder nicht ganzzahlig', () => {
    expect(validateWeights({ ka: 6, tests: 1, muendlich: 1, mode: 'factor' })).not.toBeNull();
    expect(validateWeights({ ka: 1.5, tests: 1, muendlich: 1, mode: 'factor' })).not.toBeNull();
  });
});
