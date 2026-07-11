import type { WeightMode, Weights } from './model';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Gewichte in den anderen Modus überführen (Verhalten der Alt-App). */
export function convertWeightsMode(weights: Weights, mode: WeightMode): Weights {
  if (weights.mode === mode) return weights;

  if (mode === 'factor') {
    return {
      ka: clamp(Math.round(weights.ka / 25), 1, 5),
      tests: clamp(Math.round(weights.tests / 25), 1, 5),
      muendlich: clamp(Math.round(weights.muendlich / 25), 1, 5),
      mode,
    };
  }

  const sum = weights.ka + weights.tests + weights.muendlich;
  const ka = Math.round((weights.ka / sum) * 100);
  const tests = Math.round((weights.tests / sum) * 100);
  return { ka, tests, muendlich: 100 - ka - tests, mode };
}

/** null = gültig, sonst deutschsprachige Fehlermeldung. */
export function validateWeights(weights: Weights): string | null {
  const values = [weights.ka, weights.tests, weights.muendlich];
  if (weights.mode === 'percent') {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum !== 100) return `Die Summe der Gewichte muss 100 % ergeben (aktuell ${sum} %).`;
    return null;
  }
  if (values.some((v) => !Number.isInteger(v) || v < 1 || v > 5)) {
    return 'Faktoren müssen ganze Zahlen von 1 bis 5 sein.';
  }
  return null;
}
