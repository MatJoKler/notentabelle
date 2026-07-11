import { describe, expect, test } from 'vitest';
import { gradeKey } from './model';
import { isLegacyData, migrateLegacyData } from './migrate';

/** Repräsentativer Ausschnitt aus einem Export der Alt-App (notenrechner-data.json). */
function legacyFixture() {
  return {
    schoolYear: '2024/25',
    classes: {
      class_1: { name: '8c', students: [{ id: 'student_1', name: 'Anna' }, { id: 'student_2', name: 'Ben' }] },
    },
    subjects: {
      subject_1: {
        name: 'Mathe',
        assignedClasses: ['class_1'],
        settings: { ka: 50, tests: 25, muendlich: 25, mode: 'percent' },
      },
    },
    grades: {
      subject_1: {
        class_1: {
          student_1: {
            ka1: ['2,5', '3'],
            ka2: [],
            test1: ['1'],
            test2: [],
            m1: [],
            m2: ['4'],
            ka1_title_0: 'KA 1',
            ka1_label_0: '2024-10-01',
            ka1_title_1: 'KA 2',
            ka1_label_1: '2024-12-01',
            test1_title_0: 'Vokabeltest',
          },
          student_2: {
            ka1: ['ungültig', '4'],
            ka1_title_0: 'KA 1',
            ka1_label_0: '2024-10-01',
          },
        },
      },
    },
    studentNotes: {
      student_1: [{ type: 'parent', text: 'Gespräch geführt', timestamp: '2024-11-01T10:00:00Z' }],
    },
    archives: {},
    security: {
      passwordHash: 'abc',
      securityQuestion: 'Frage?',
      securityAnswerHash: 'def',
      recoveryKeyHash: 'ghi',
      isFirstLogin: false,
    },
  };
}

describe('isLegacyData', () => {
  test('erkennt Alt-Format', () => {
    expect(isLegacyData(legacyFixture())).toBe(true);
  });

  test('lehnt neues Format ab', () => {
    expect(isLegacyData({ version: 1, classes: {} })).toBe(false);
  });

  test('lehnt Unsinn ab', () => {
    expect(isLegacyData(null)).toBe(false);
    expect(isLegacyData('text')).toBe(false);
    expect(isLegacyData({})).toBe(false);
  });
});

describe('migrateLegacyData', () => {
  test('übernimmt Schuljahr und Sicherheitseinstellungen', () => {
    const data = migrateLegacyData(legacyFixture());
    expect(data.version).toBe(1);
    expect(data.schoolYear).toBe('2024/25');
    expect(data.security.passwordHash).toBe('abc');
    expect(data.security.recoveryKeyHash).toBe('ghi');
  });

  test('wandelt Klassen und Schüler in normalisierte Struktur um', () => {
    const data = migrateLegacyData(legacyFixture());
    expect(data.classes.class_1).toEqual({ name: '8c', studentIds: ['student_1', 'student_2'] });
    expect(data.students.student_1).toEqual({ name: 'Anna', classId: 'class_1' });
  });

  test('wandelt Fächer mit Gewichten um', () => {
    const data = migrateLegacyData(legacyFixture());
    expect(data.subjects.subject_1.assignedClassIds).toEqual(['class_1']);
    expect(data.subjects.subject_1.weights).toEqual({ ka: 50, tests: 25, muendlich: 25, mode: 'percent' });
  });

  test('erzeugt zentrale Spalten mit Titel und Datum aus redundanten Metadaten', () => {
    const data = migrateLegacyData(legacyFixture());
    const kaColumns = Object.values(data.columns).filter(
      (c) => c.category === 'ka' && c.semester === 1,
    );
    expect(kaColumns).toHaveLength(2);
    expect(kaColumns.map((c) => c.title)).toEqual(['KA 1', 'KA 2']);
    expect(kaColumns.map((c) => c.date)).toEqual(['2024-10-01', '2024-12-01']);
    expect(kaColumns.map((c) => c.order)).toEqual([0, 1]);
  });

  test('ordnet Noten den Spalten zu und normalisiert Kommawerte', () => {
    const data = migrateLegacyData(legacyFixture());
    const kaColumnIds = Object.entries(data.columns)
      .filter(([, c]) => c.category === 'ka' && c.semester === 1)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([id]) => id);
    expect(data.grades[gradeKey('student_1', kaColumnIds[0])]).toBe(2.5);
    expect(data.grades[gradeKey('student_1', kaColumnIds[1])]).toBe(3);
  });

  test('überspringt ungültige Notenwerte', () => {
    const data = migrateLegacyData(legacyFixture());
    const kaColumnIds = Object.entries(data.columns)
      .filter(([, c]) => c.category === 'ka' && c.semester === 1)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([id]) => id);
    expect(data.grades[gradeKey('student_2', kaColumnIds[0])]).toBeUndefined();
    expect(data.grades[gradeKey('student_2', kaColumnIds[1])]).toBe(4);
  });

  test('ordnet Halbjahr 2 und Kategorien korrekt zu', () => {
    const data = migrateLegacyData(legacyFixture());
    const m2 = Object.values(data.columns).filter(
      (c) => c.category === 'muendlich' && c.semester === 2,
    );
    expect(m2).toHaveLength(1);
    const test1 = Object.values(data.columns).filter(
      (c) => c.category === 'test' && c.semester === 1,
    );
    expect(test1[0].title).toBe('Vokabeltest');
  });

  test('übernimmt Notizen und vergibt IDs', () => {
    const data = migrateLegacyData(legacyFixture());
    expect(data.notes.student_1).toHaveLength(1);
    expect(data.notes.student_1[0].type).toBe('parent');
    expect(data.notes.student_1[0].id).toBeTruthy();
  });

  test('migriert Archive rekursiv', () => {
    const legacy = legacyFixture() as any;
    legacy.archives = {
      '2023/24': {
        schoolYear: '2023/24',
        classes: { class_9: { name: '7c', students: [{ id: 'student_1', name: 'Anna' }] } },
        subjects: {
          subject_1: {
            name: 'Mathe',
            assignedClasses: ['class_9'],
            settings: { ka: 2, tests: 1, muendlich: 1, mode: 'factor' },
          },
        },
        grades: {
          subject_1: { class_9: { student_1: { ka1: ['2'], ka1_title_0: 'KA 1' } } },
        },
        studentNotes: {},
        archivedDate: '2024-07-20T10:00:00Z',
      },
    };
    const data = migrateLegacyData(legacy);
    const snap = data.archives['2023/24'];
    expect(snap.schoolYear).toBe('2023/24');
    expect(snap.archivedDate).toBe('2024-07-20T10:00:00Z');
    expect(snap.classes.class_9.name).toBe('7c');
    expect(Object.values(snap.columns)).toHaveLength(1);
    expect(Object.values(snap.grades)).toEqual([2]);
  });

  test('fehlende Sicherheitsdaten ergeben leere Security', () => {
    const legacy = legacyFixture() as any;
    delete legacy.security;
    const data = migrateLegacyData(legacy);
    expect(data.security.passwordHash).toBeNull();
  });
});
