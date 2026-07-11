import { describe, expect, test } from 'vitest';
import {
  average,
  formatGrade,
  gradeBand,
  parseGrade,
  riskLevel,
  semesterGrade,
  yearGrade,
} from './calc';

describe('parseGrade', () => {
  test('akzeptiert ganze Note', () => {
    expect(parseGrade('3')).toBe(3);
  });

  test('akzeptiert Dezimalnote mit Komma', () => {
    expect(parseGrade('2,5')).toBe(2.5);
  });

  test('akzeptiert Dezimalnote mit Punkt', () => {
    expect(parseGrade('3.75')).toBe(3.75);
  });

  test('ignoriert umgebende Leerzeichen', () => {
    expect(parseGrade(' 2 ')).toBe(2);
  });

  test('akzeptiert Grenzwerte 1 und 6', () => {
    expect(parseGrade('1')).toBe(1);
    expect(parseGrade('6')).toBe(6);
  });

  test('lehnt Werte unter 1 ab', () => {
    expect(parseGrade('0,9')).toBeNull();
  });

  test('lehnt Werte über 6 ab', () => {
    expect(parseGrade('6,1')).toBeNull();
  });

  test('lehnt Text ab', () => {
    expect(parseGrade('abc')).toBeNull();
  });

  test('lehnt leere Eingabe ab', () => {
    expect(parseGrade('')).toBeNull();
    expect(parseGrade('   ')).toBeNull();
  });
});

describe('average', () => {
  test('berechnet arithmetisches Mittel', () => {
    expect(average([2, 3])).toBe(2.5);
  });

  test('rundet auf 2 Nachkommastellen', () => {
    expect(average([1, 2, 2])).toBe(1.67);
  });

  test('einzelner Wert bleibt unverändert', () => {
    expect(average([4])).toBe(4);
  });

  test('leere Liste ergibt null', () => {
    expect(average([])).toBeNull();
  });
});

describe('semesterGrade', () => {
  const percent = { ka: 50, tests: 25, muendlich: 25, mode: 'percent' as const };

  test('gewichtet alle drei Notenarten (percent)', () => {
    // (2*50 + 3*25 + 4*25) / 100 = 2.75
    expect(semesterGrade({ ka: 2, tests: 3, muendlich: 4 }, percent)).toBe(2.75);
  });

  test('fehlende Notenart fällt samt Gewicht weg', () => {
    // (2*50 + 3*25) / 75 = 2.3333 -> 2.33
    expect(semesterGrade({ ka: 2, tests: 3, muendlich: null }, percent)).toBe(2.33);
  });

  test('nur eine Notenart vorhanden ergibt deren Wert', () => {
    expect(semesterGrade({ ka: null, tests: null, muendlich: 3.5 }, percent)).toBe(3.5);
  });

  test('keine Notenart vorhanden ergibt null', () => {
    expect(semesterGrade({ ka: null, tests: null, muendlich: null }, percent)).toBeNull();
  });

  test('factor-Modus rechnet mit derselben Formel', () => {
    const factor = { ka: 2, tests: 1, muendlich: 1, mode: 'factor' as const };
    // (2*2 + 3*1 + 4*1) / 4 = 2.75
    expect(semesterGrade({ ka: 2, tests: 3, muendlich: 4 }, factor)).toBe(2.75);
  });

  test('Gewichtssumme 0 ergibt null', () => {
    const zero = { ka: 0, tests: 0, muendlich: 0, mode: 'percent' as const };
    expect(semesterGrade({ ka: 2, tests: 3, muendlich: 4 }, zero)).toBeNull();
  });
});

describe('yearGrade', () => {
  test('mittelt beide Halbjahre', () => {
    expect(yearGrade(2.5, 3.5)).toBe(3);
  });

  test('rundet auf 2 Nachkommastellen', () => {
    expect(yearGrade(2.33, 2.5)).toBe(2.42);
  });

  test('nur erstes Halbjahr vorhanden', () => {
    expect(yearGrade(2.33, null)).toBe(2.33);
  });

  test('nur zweites Halbjahr vorhanden', () => {
    expect(yearGrade(null, 4.1)).toBe(4.1);
  });

  test('kein Halbjahr vorhanden ergibt null', () => {
    expect(yearGrade(null, null)).toBeNull();
  });
});

describe('gradeBand', () => {
  test('unter 2 ist sehr gut', () => {
    expect(gradeBand(1)).toBe('sehr-gut');
    expect(gradeBand(1.99)).toBe('sehr-gut');
  });

  test('2 bis unter 3 ist gut', () => {
    expect(gradeBand(2)).toBe('gut');
    expect(gradeBand(2.99)).toBe('gut');
  });

  test('3 bis unter 4 ist befriedigend', () => {
    expect(gradeBand(3)).toBe('befriedigend');
    expect(gradeBand(3.99)).toBe('befriedigend');
  });

  test('ab 4 ist schlecht', () => {
    expect(gradeBand(4)).toBe('schlecht');
    expect(gradeBand(6)).toBe('schlecht');
  });
});

describe('riskLevel', () => {
  test('unter 4,5 keine Gefährdung', () => {
    expect(riskLevel(4.49)).toBe('none');
    expect(riskLevel(null)).toBe('none');
  });

  test('ab 4,5 gefährdet', () => {
    expect(riskLevel(4.5)).toBe('gefaehrdet');
    expect(riskLevel(4.99)).toBe('gefaehrdet');
  });

  test('ab 5,0 kritisch', () => {
    expect(riskLevel(5)).toBe('kritisch');
    expect(riskLevel(6)).toBe('kritisch');
  });
});

describe('formatGrade', () => {
  test('formatiert mit Komma und 2 Nachkommastellen', () => {
    expect(formatGrade(2.5)).toBe('2,50');
  });

  test('null ergibt Gedankenstrich', () => {
    expect(formatGrade(null)).toBe('–');
  });
});
