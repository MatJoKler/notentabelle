import { describe, expect, test } from 'vitest';
import {
  classSubjectAverage,
  gradeDistribution,
  previousYearGrade,
  studentOverallAverage,
  studentRanking,
  subjectsForClass,
} from './insights';
import { emptyAppData, gradeKey, type AppData } from './model';

/**
 * 8c mit Anna (Mathe-Jahr 2, Englisch-Jahr 4) und Ben (Mathe-Jahr 5, Englisch ohne Noten).
 * Zur Vereinfachung: je Fach genau eine KA-Spalte im 1. HJ → Jahresnote = KA-Note.
 */
function fixture(): AppData {
  const data = emptyAppData('2025/26');
  data.classes.c1 = { name: '8c', studentIds: ['s1', 's2'] };
  data.students.s1 = { name: 'Anna', classId: 'c1' };
  data.students.s2 = { name: 'Ben', classId: 'c1' };
  const weights = { ka: 50, tests: 25, muendlich: 25, mode: 'percent' as const };
  data.subjects.m = { name: 'Mathe', assignedClassIds: ['c1'], weights };
  data.subjects.e = { name: 'Englisch', assignedClassIds: ['c1'], weights };
  data.columns = {
    mka: { subjectId: 'm', classId: 'c1', semester: 1, category: 'ka', title: 'KA 1', date: null, order: 0 },
    eka: { subjectId: 'e', classId: 'c1', semester: 1, category: 'ka', title: 'KA 1', date: null, order: 0 },
  };
  data.grades = {
    [gradeKey('s1', 'mka')]: 2,
    [gradeKey('s1', 'eka')]: 4,
    [gradeKey('s2', 'mka')]: 5,
  };
  return data;
}

describe('subjectsForClass', () => {
  test('liefert nur zugeordnete Fächer, alphabetisch', () => {
    const data = fixture();
    data.subjects.k = {
      name: 'Kunst',
      assignedClassIds: [],
      weights: data.subjects.m.weights,
    };
    expect(subjectsForClass(data, 'c1').map(([id]) => id)).toEqual(['e', 'm']);
  });
});

describe('studentOverallAverage', () => {
  test('mittelt die Jahresnoten aller Fächer des Schülers', () => {
    expect(studentOverallAverage(fixture(), 's1')).toBe(3); // (2 + 4) / 2
  });

  test('Fächer ohne Noten zählen nicht mit', () => {
    expect(studentOverallAverage(fixture(), 's2')).toBe(5);
  });

  test('ohne jede Note null', () => {
    const data = fixture();
    data.grades = {};
    expect(studentOverallAverage(data, 's1')).toBeNull();
  });
});

describe('classSubjectAverage', () => {
  test('mittelt Jahresnoten der Klasse in einem Fach', () => {
    expect(classSubjectAverage(fixture(), 'm', 'c1')).toBe(3.5); // (2 + 5) / 2
  });
});

describe('studentRanking', () => {
  test('sortiert nach Gesamtschnitt aufsteigend (beste zuerst)', () => {
    const ranking = studentRanking(fixture());
    expect(ranking.map((r) => r.studentId)).toEqual(['s1', 's2']);
    expect(ranking[0].average).toBe(3);
    expect(ranking[1].average).toBe(5);
  });

  test('Schüler ohne Noten erscheinen nicht', () => {
    const data = fixture();
    data.classes.c1.studentIds.push('s3');
    data.students.s3 = { name: 'Cem', classId: 'c1' };
    expect(studentRanking(data).map((r) => r.studentId)).toEqual(['s1', 's2']);
  });
});

describe('gradeDistribution', () => {
  test('zählt Jahresnoten je Notenband', () => {
    // Jahresnoten: Anna-Mathe 2 (gut), Anna-Englisch 4 (schlecht), Ben-Mathe 5 (schlecht)
    expect(gradeDistribution(fixture())).toEqual({
      'sehr-gut': 0,
      gut: 1,
      befriedigend: 0,
      schlecht: 2,
    });
  });
});

describe('previousYearGrade', () => {
  test('findet die Jahresnote des Fachs im letzten Archivjahr (Fach-Zuordnung über Namen)', () => {
    const data = fixture();
    data.archives['2024/25'] = {
      schoolYear: '2024/25',
      archivedDate: '2025-07-20T10:00:00Z',
      classes: { alt: { name: '7c', studentIds: ['s1'] } },
      students: { s1: { name: 'Anna', classId: 'alt' } },
      subjects: {
        altM: { name: 'Mathe', assignedClassIds: ['alt'], weights: data.subjects.m.weights },
      },
      columns: {
        altKa: { subjectId: 'altM', classId: 'alt', semester: 1, category: 'ka', title: 'KA', date: null, order: 0 },
      },
      grades: { [gradeKey('s1', 'altKa')]: 3 },
      notes: {},
      trackingColumns: {},
      trackingValues: {},
    };
    expect(previousYearGrade(data, 's1', 'Mathe')).toBe(3);
  });

  test('null wenn kein Archiv oder Schüler dort unbekannt', () => {
    expect(previousYearGrade(fixture(), 's1', 'Mathe')).toBeNull();
  });
});
