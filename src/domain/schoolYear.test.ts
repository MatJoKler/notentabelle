import { describe, expect, test } from 'vitest';
import { DEFAULT_WEIGHTS, emptyAppData, gradeKey, type AppData } from './model';
import {
  archiveAndAdvance,
  isGraduating,
  nextSchoolYearLabel,
  parseClassName,
  promoteClassName,
} from './schoolYear';

describe('parseClassName', () => {
  test('zerlegt Stufe und Zug', () => {
    expect(parseClassName('8c')).toEqual({ level: 8, suffix: 'c' });
    expect(parseClassName('10a')).toEqual({ level: 10, suffix: 'a' });
  });

  test('nicht parsebare Namen ergeben null', () => {
    expect(parseClassName('Kurs1')).toBeNull();
    expect(parseClassName('AG Schach')).toBeNull();
    expect(parseClassName('')).toBeNull();
  });
});

describe('promoteClassName', () => {
  test('stuft eine Klasse hoch', () => {
    expect(promoteClassName('8c')).toBe('9c');
    expect(promoteClassName('9a')).toBe('10a');
  });

  test('nicht parsebare Namen bleiben unverändert (null)', () => {
    expect(promoteClassName('AG Schach')).toBeNull();
  });
});

describe('isGraduating', () => {
  test('Stufe 10 ist Abschlussklasse', () => {
    expect(isGraduating('10a')).toBe(true);
    expect(isGraduating('11b')).toBe(true);
  });

  test('Stufe 9 und darunter nicht', () => {
    expect(isGraduating('9c')).toBe(false);
  });

  test('nicht parsebare Namen sind keine Abschlussklassen', () => {
    expect(isGraduating('AG Schach')).toBe(false);
  });
});

describe('nextSchoolYearLabel', () => {
  test('zählt das Schuljahr weiter', () => {
    expect(nextSchoolYearLabel('2025/26')).toBe('2026/27');
  });

  test('Jahrhundertwechsel', () => {
    expect(nextSchoolYearLabel('1999/00')).toBe('2000/01');
  });
});

function fixture(): AppData {
  const data = emptyAppData('2025/26');
  data.classes = {
    c9: { name: '9a', studentIds: ['s1'] },
    c10: { name: '10b', studentIds: ['s2'] },
  };
  data.students = {
    s1: { name: 'Anna', classId: 'c9' },
    s2: { name: 'Ben', classId: 'c10' },
  };
  data.subjects = {
    m: { name: 'Mathe', assignedClassIds: ['c9', 'c10'], weights: DEFAULT_WEIGHTS },
  };
  data.columns = {
    col1: {
      subjectId: 'm',
      classId: 'c9',
      semester: 1,
      category: 'ka',
      title: 'KA 1',
      date: '2025-10-01',
      order: 0,
    },
  };
  data.grades = { [gradeKey('s1', 'col1')]: 2.5 };
  data.notes = {
    s1: [{ id: 'n1', type: 'general', text: 'Hinweis', timestamp: '2025-10-02T10:00:00Z' }],
    s2: [{ id: 'n2', type: 'parent', text: 'Gespräch', timestamp: '2025-10-03T10:00:00Z' }],
  };
  return data;
}

describe('archiveAndAdvance', () => {
  const archivedDate = '2026-07-11T12:00:00Z';

  test('legt vollständigen Snapshot des alten Jahres im Archiv ab', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    const snap = next.archives['2025/26'];
    expect(snap).toBeDefined();
    expect(snap.schoolYear).toBe('2025/26');
    expect(snap.archivedDate).toBe(archivedDate);
    expect(snap.classes.c10.name).toBe('10b');
    expect(snap.grades[gradeKey('s1', 'col1')]).toBe(2.5);
    expect(snap.notes.s2).toHaveLength(1);
  });

  test('zählt das Schuljahr hoch', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    expect(next.schoolYear).toBe('2026/27');
  });

  test('stuft verbleibende Klassen hoch', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    expect(next.classes.c9.name).toBe('10a');
  });

  test('entfernt Abschlussklassen samt Schülern und Notizen', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    expect(next.classes.c10).toBeUndefined();
    expect(next.students.s2).toBeUndefined();
    expect(next.notes.s2).toBeUndefined();
  });

  test('behält verbleibende Schüler und deren Notizen', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    expect(next.students.s1).toBeDefined();
    expect(next.notes.s1).toHaveLength(1);
  });

  test('setzt Notenspalten und Noten zurück', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    expect(next.columns).toEqual({});
    expect(next.grades).toEqual({});
  });

  test('bereinigt Klassenzuordnungen der Fächer', () => {
    const next = archiveAndAdvance(fixture(), { archivedDate });
    expect(next.subjects.m.assignedClassIds).toEqual(['c9']);
  });

  test('verändert die Eingabedaten nicht (immutable)', () => {
    const input = fixture();
    archiveAndAdvance(input, { archivedDate });
    expect(input.schoolYear).toBe('2025/26');
    expect(input.classes.c10).toBeDefined();
    expect(Object.keys(input.archives)).toHaveLength(0);
  });

  test('frühere Archive bleiben erhalten', () => {
    const input = fixture();
    const once = archiveAndAdvance(input, { archivedDate });
    const twice = archiveAndAdvance(once, { archivedDate });
    expect(Object.keys(twice.archives).sort()).toEqual(['2025/26', '2026/27']);
  });
});
