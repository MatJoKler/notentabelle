import type { Weights } from './model';

export const MIN_GRADE = 1;
export const MAX_GRADE = 6;

/** Rundet kaufmännisch auf 2 Nachkommastellen — auf jeder Berechnungsstufe,
 *  damit Ergebnisse mit der Alt-App übereinstimmen. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Noteneingabe ("2,5" oder "3.75") in Zahl umwandeln; ungültig → null. */
export function parseGrade(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (value < MIN_GRADE || value > MAX_GRADE) return null;
  return value;
}

/** Arithmetisches Mittel; leere Liste → null. */
export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return round2(sum / values.length);
}

export interface CategoryAverages {
  ka: number | null;
  tests: number | null;
  muendlich: number | null;
}

/** Gewichtete Halbjahresnote: fehlende Notenarten fallen samt Gewicht weg. */
export function semesterGrade(parts: CategoryAverages, weights: Weights): number | null {
  const entries: Array<[number | null, number]> = [
    [parts.ka, weights.ka],
    [parts.tests, weights.tests],
    [parts.muendlich, weights.muendlich],
  ];
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [value, weight] of entries) {
    if (value === null) continue;
    weightedSum += value * weight;
    weightTotal += weight;
  }
  if (weightTotal === 0) return null;
  return round2(weightedSum / weightTotal);
}

/** Jahresnote = Mittel beider Halbjahre; fehlt eines, zählt das andere. */
export function yearGrade(semester1: number | null, semester2: number | null): number | null {
  if (semester1 !== null && semester2 !== null) {
    return round2((semester1 + semester2) / 2);
  }
  return semester1 ?? semester2;
}

export type GradeBand = 'sehr-gut' | 'gut' | 'befriedigend' | 'schlecht';

export function gradeBand(value: number): GradeBand {
  if (value < 2) return 'sehr-gut';
  if (value < 3) return 'gut';
  if (value < 4) return 'befriedigend';
  return 'schlecht';
}

export type RiskLevel = 'none' | 'gefaehrdet' | 'kritisch';

export function riskLevel(avg: number | null): RiskLevel {
  if (avg === null || avg < 4.5) return 'none';
  if (avg < 5) return 'gefaehrdet';
  return 'kritisch';
}

/** Anzeige mit deutschem Komma und 2 Nachkommastellen; null → Gedankenstrich. */
export function formatGrade(value: number | null): string {
  if (value === null) return '–';
  return value.toFixed(2).replace('.', ',');
}
