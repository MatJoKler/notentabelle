import { describe, expect, test } from 'vitest';
import { emptyAppData, gradeKey, type AppData } from './model';
import {
  columnAverage,
  columnsFor,
  studentCategoryAverage,
  studentSubjectSummary,
} from './selectors';

/** Mathe in 8c: 2 KA + 1 Test im 1. HJ, 1 KA im 2. HJ; Gewichte 50/25/25. */
function fixture(): AppData {
  const data = emptyAppData('2025/26');
  data.classes.c1 = { name: '8c', studentIds: ['s1', 's2'] };
  data.students.s1 = { name: 'Anna', classId: 'c1' };
  data.students.s2 = { name: 'Ben', classId: 'c1' };
  data.subjects.m = {
    name: 'Mathe',
    assignedClassIds: ['c1'],
    weights: { ka: 50, tests: 25, muendlich: 25, mode: 'percent' },
  };
  data.columns = {
    ka_b: { subjectId: 'm', classId: 'c1', semester: 1, category: 'ka', title: 'KA 2', date: null, order: 1 },
    ka_a: { subjectId: 'm', classId: 'c1', semester: 1, category: 'ka', title: 'KA 1', date: null, order: 0 },
    t_a: { subjectId: 'm', classId: 'c1', semester: 1, category: 'test', title: 'Test 1', date: null, order: 0 },
    ka_hj2: { subjectId: 'm', classId: 'c1', semester: 2, category: 'ka', title: 'KA 3', date: null, order: 0 },
  };
  data.grades = {
    [gradeKey('s1', 'ka_a')]: 2,
    [gradeKey('s1', 'ka_b')]: 3,
    [gradeKey('s1', 't_a')]: 1,
    [gradeKey('s1', 'ka_hj2')]: 4,
    [gradeKey('s2', 'ka_a')]: 5,
  };
  return data;
}

describe('columnsFor', () => {
  test('liefert Spalten sortiert nach order', () => {
    const columns = columnsFor(fixture(), 'm', 'c1', 1, 'ka');
    expect(columns.map(([id]) => id)).toEqual(['ka_a', 'ka_b']);
  });

  test('filtert nach Halbjahr und Kategorie', () => {
    expect(columnsFor(fixture(), 'm', 'c1', 2, 'ka').map(([id]) => id)).toEqual(['ka_hj2']);
    expect(columnsFor(fixture(), 'm', 'c1', 1, 'muendlich')).toEqual([]);
  });
});

describe('studentCategoryAverage', () => {
  test('mittelt die Noten der Kategorie im Halbjahr', () => {
    expect(studentCategoryAverage(fixture(), 's1', 'm', 'c1', 1, 'ka')).toBe(2.5);
  });

  test('ohne Noten null', () => {
    expect(studentCategoryAverage(fixture(), 's2', 'm', 'c1', 1, 'test')).toBeNull();
  });
});

describe('studentSubjectSummary', () => {
  test('berechnet Halbjahres- und Jahresnote', () => {
    const summary = studentSubjectSummary(fixture(), 's1', 'm', 'c1');
    // HJ1: KA-Ø 2.5 (50), Test-Ø 1 (25) → (2.5*50 + 1*25) / 75 = 2
    expect(summary.semester1.ka).toBe(2.5);
    expect(summary.semester1.tests).toBe(1);
    expect(summary.semester1.muendlich).toBeNull();
    expect(summary.semester1.grade).toBe(2);
    // HJ2: nur KA 4 → 4
    expect(summary.semester2.grade).toBe(4);
    expect(summary.year).toBe(3);
  });

  test('ohne jede Note überall null', () => {
    const data = fixture();
    data.grades = {};
    const summary = studentSubjectSummary(data, 's2', 'm', 'c1');
    expect(summary.semester1.grade).toBeNull();
    expect(summary.year).toBeNull();
  });
});

describe('columnAverage', () => {
  test('mittelt über alle Schüler der Klasse', () => {
    expect(columnAverage(fixture(), 'ka_a')).toBe(3.5); // (2 + 5) / 2
  });

  test('Spalte ohne Noten ergibt null', () => {
    const data = fixture();
    data.grades = {};
    expect(columnAverage(data, 'ka_a')).toBeNull();
  });
});
