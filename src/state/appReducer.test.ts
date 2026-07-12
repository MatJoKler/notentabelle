import { describe, expect, test } from 'vitest';
import { DEFAULT_WEIGHTS, emptyAppData, gradeKey, type AppData } from '../domain/model';
import { appReducer } from './appReducer';

function fixture(): AppData {
  const data = emptyAppData('2025/26');
  data.classes = {
    c1: { name: '8c', studentIds: ['s1', 's2'] },
    c2: { name: '9a', studentIds: [] },
  };
  data.students = {
    s1: { name: 'Anna', classId: 'c1' },
    s2: { name: 'Ben', classId: 'c1' },
  };
  data.subjects = {
    m: { name: 'Mathe', assignedClassIds: ['c1'], weights: DEFAULT_WEIGHTS },
  };
  data.columns = {
    col1: { subjectId: 'm', classId: 'c1', semester: 1, category: 'ka', title: 'KA 1', date: null, order: 0 },
  };
  data.grades = { [gradeKey('s1', 'col1')]: 2, [gradeKey('s2', 'col1')]: 3 };
  data.notes = { s1: [{ id: 'n1', type: 'general', text: 'x', timestamp: 't' }] };
  data.trackingColumns = {
    t1: { subjectId: 'm', classId: 'c1', title: 'Hausaufgabenstriche', order: 0 },
  };
  data.trackingValues = { [gradeKey('s1', 't1')]: 'III' };
  return data;
}

describe('Klassen', () => {
  test('anlegen', () => {
    const next = appReducer(fixture(), { type: 'class/add', id: 'c3', name: '5b' });
    expect(next.classes.c3).toEqual({ name: '5b', studentIds: [] });
  });

  test('umbenennen', () => {
    const next = appReducer(fixture(), { type: 'class/rename', id: 'c1', name: '8d' });
    expect(next.classes.c1.name).toBe('8d');
  });

  test('löschen entfernt Schüler, Noten, Notizen, Spalten und Fach-Zuordnungen', () => {
    const next = appReducer(fixture(), { type: 'class/delete', id: 'c1' });
    expect(next.classes.c1).toBeUndefined();
    expect(next.students.s1).toBeUndefined();
    expect(next.notes.s1).toBeUndefined();
    expect(next.columns.col1).toBeUndefined();
    expect(next.grades[gradeKey('s1', 'col1')]).toBeUndefined();
    expect(next.subjects.m.assignedClassIds).toEqual([]);
  });
});

describe('Schüler', () => {
  test('anlegen fügt der Klasse hinzu', () => {
    const next = appReducer(fixture(), { type: 'student/add', id: 's3', classId: 'c2', name: 'Cem' });
    expect(next.students.s3).toEqual({ name: 'Cem', classId: 'c2' });
    expect(next.classes.c2.studentIds).toEqual(['s3']);
  });

  test('umbenennen', () => {
    const next = appReducer(fixture(), { type: 'student/rename', id: 's1', name: 'Anna B.' });
    expect(next.students.s1.name).toBe('Anna B.');
  });

  test('löschen entfernt Noten und Notizen', () => {
    const next = appReducer(fixture(), { type: 'student/delete', id: 's1' });
    expect(next.students.s1).toBeUndefined();
    expect(next.classes.c1.studentIds).toEqual(['s2']);
    expect(next.grades[gradeKey('s1', 'col1')]).toBeUndefined();
    expect(next.notes.s1).toBeUndefined();
  });

  test('Klassenwechsel behält Noten und ergänzt automatische Notiz', () => {
    const next = appReducer(fixture(), {
      type: 'student/move',
      id: 's1',
      toClassId: 'c2',
      noteId: 'auto1',
      timestamp: '2026-02-01T08:00:00Z',
    });
    expect(next.students.s1.classId).toBe('c2');
    expect(next.classes.c1.studentIds).toEqual(['s2']);
    expect(next.classes.c2.studentIds).toEqual(['s1']);
    expect(next.grades[gradeKey('s1', 'col1')]).toBe(2);
    const autoNote = next.notes.s1.find((n) => n.id === 'auto1');
    expect(autoNote?.type).toBe('general');
    expect(autoNote?.text).toContain('8c');
    expect(autoNote?.text).toContain('9a');
  });
});

describe('Fächer', () => {
  test('anlegen mit Standardgewichten', () => {
    const next = appReducer(fixture(), { type: 'subject/add', id: 'e', name: 'Englisch' });
    expect(next.subjects.e.name).toBe('Englisch');
    expect(next.subjects.e.weights).toEqual(DEFAULT_WEIGHTS);
    expect(next.subjects.e.assignedClassIds).toEqual([]);
  });

  test('löschen entfernt Spalten und Noten des Fachs', () => {
    const next = appReducer(fixture(), { type: 'subject/delete', id: 'm' });
    expect(next.subjects.m).toBeUndefined();
    expect(next.columns.col1).toBeUndefined();
    expect(next.grades[gradeKey('s1', 'col1')]).toBeUndefined();
  });

  test('Klassenzuordnung setzen', () => {
    const next = appReducer(fixture(), { type: 'subject/setAssignedClasses', id: 'm', classIds: ['c1', 'c2'] });
    expect(next.subjects.m.assignedClassIds).toEqual(['c1', 'c2']);
  });

  test('Zuordnung entfernen löscht Spalten und Noten der Klasse in dem Fach', () => {
    const next = appReducer(fixture(), { type: 'subject/setAssignedClasses', id: 'm', classIds: [] });
    expect(next.columns.col1).toBeUndefined();
    expect(next.grades[gradeKey('s1', 'col1')]).toBeUndefined();
  });

  test('Gewichte setzen', () => {
    const weights = { ka: 2, tests: 1, muendlich: 1, mode: 'factor' as const };
    const next = appReducer(fixture(), { type: 'subject/setWeights', id: 'm', weights });
    expect(next.subjects.m.weights).toEqual(weights);
  });
});

describe('Spalten', () => {
  test('anlegen vergibt fortlaufende order je Fach/Klasse/Halbjahr/Kategorie', () => {
    const next = appReducer(fixture(), {
      type: 'column/add',
      id: 'col2',
      subjectId: 'm',
      classId: 'c1',
      semester: 1,
      category: 'ka',
      title: 'KA 2',
      date: '2026-03-01',
    });
    expect(next.columns.col2.order).toBe(1);

    const other = appReducer(next, {
      type: 'column/add',
      id: 'col3',
      subjectId: 'm',
      classId: 'c1',
      semester: 2,
      category: 'test',
      title: 'Test 1',
      date: null,
    });
    expect(other.columns.col3.order).toBe(0);
  });

  test('Titel und Datum ändern', () => {
    const next = appReducer(fixture(), { type: 'column/update', id: 'col1', title: 'KA I', date: '2025-11-11' });
    expect(next.columns.col1.title).toBe('KA I');
    expect(next.columns.col1.date).toBe('2025-11-11');
  });

  test('löschen entfernt zugehörige Noten', () => {
    const next = appReducer(fixture(), { type: 'column/delete', id: 'col1' });
    expect(next.columns.col1).toBeUndefined();
    expect(next.grades[gradeKey('s1', 'col1')]).toBeUndefined();
    expect(next.grades[gradeKey('s2', 'col1')]).toBeUndefined();
  });
});

describe('Noten', () => {
  test('setzen', () => {
    const next = appReducer(fixture(), { type: 'grade/set', studentId: 's2', columnId: 'col1', value: 1.5 });
    expect(next.grades[gradeKey('s2', 'col1')]).toBe(1.5);
  });

  test('löschen', () => {
    const next = appReducer(fixture(), { type: 'grade/clear', studentId: 's1', columnId: 'col1' });
    expect(next.grades[gradeKey('s1', 'col1')]).toBeUndefined();
  });
});

describe('Notizen', () => {
  test('hinzufügen (neueste zuerst)', () => {
    const note = { id: 'n2', type: 'parent' as const, text: 'Gespräch', timestamp: 't2' };
    const next = appReducer(fixture(), { type: 'note/add', studentId: 's1', note });
    expect(next.notes.s1.map((n) => n.id)).toEqual(['n2', 'n1']);
  });

  test('hinzufügen bei Schüler ohne Notizen', () => {
    const note = { id: 'n3', type: 'general' as const, text: 'x', timestamp: 't3' };
    const next = appReducer(fixture(), { type: 'note/add', studentId: 's2', note });
    expect(next.notes.s2).toHaveLength(1);
  });

  test('löschen', () => {
    const next = appReducer(fixture(), { type: 'note/delete', studentId: 's1', noteId: 'n1' });
    expect(next.notes.s1).toEqual([]);
  });
});

describe('Abgaben-Tracking', () => {
  test('Spalte anlegen vergibt fortlaufende order je Fach/Klasse', () => {
    const next = appReducer(fixture(), {
      type: 'trackingColumn/add',
      id: 't2',
      subjectId: 'm',
      classId: 'c1',
      title: 'Schulfest',
    });
    expect(next.trackingColumns.t2).toEqual({
      subjectId: 'm',
      classId: 'c1',
      title: 'Schulfest',
      order: 1,
    });
  });

  test('Spalte umbenennen', () => {
    const next = appReducer(fixture(), { type: 'trackingColumn/rename', id: 't1', title: 'HA' });
    expect(next.trackingColumns.t1.title).toBe('HA');
  });

  test('Spalte löschen entfernt zugehörige Werte', () => {
    const next = appReducer(fixture(), { type: 'trackingColumn/delete', id: 't1' });
    expect(next.trackingColumns.t1).toBeUndefined();
    expect(next.trackingValues[gradeKey('s1', 't1')]).toBeUndefined();
  });

  test('Wert setzen und leeren', () => {
    const set = appReducer(fixture(), {
      type: 'trackingValue/set',
      studentId: 's2',
      columnId: 't1',
      value: 'fehlt',
    });
    expect(set.trackingValues[gradeKey('s2', 't1')]).toBe('fehlt');
    const cleared = appReducer(set, { type: 'trackingValue/set', studentId: 's2', columnId: 't1', value: '' });
    expect(cleared.trackingValues[gradeKey('s2', 't1')]).toBeUndefined();
  });

  test('Klasse löschen entfernt Tracking-Spalten und -Werte', () => {
    const next = appReducer(fixture(), { type: 'class/delete', id: 'c1' });
    expect(next.trackingColumns).toEqual({});
    expect(next.trackingValues).toEqual({});
  });

  test('Fach löschen entfernt Tracking-Spalten und -Werte', () => {
    const next = appReducer(fixture(), { type: 'subject/delete', id: 'm' });
    expect(next.trackingColumns).toEqual({});
    expect(next.trackingValues).toEqual({});
  });

  test('Schüler löschen entfernt seine Tracking-Werte', () => {
    const next = appReducer(fixture(), { type: 'student/delete', id: 's1' });
    expect(next.trackingValues[gradeKey('s1', 't1')]).toBeUndefined();
    expect(next.trackingColumns.t1).toBeDefined();
  });

  test('Klassenzuordnung entfernen löscht Tracking der Klasse im Fach', () => {
    const next = appReducer(fixture(), { type: 'subject/setAssignedClasses', id: 'm', classIds: [] });
    expect(next.trackingColumns).toEqual({});
    expect(next.trackingValues).toEqual({});
  });
});

describe('Jahreswechsel und Laden', () => {
  test('year/archive delegiert an archiveAndAdvance', () => {
    const next = appReducer(fixture(), { type: 'year/archive', archivedDate: '2026-07-11T12:00:00Z' });
    expect(next.schoolYear).toBe('2026/27');
    expect(next.archives['2025/26']).toBeDefined();
  });

  test('load ersetzt den gesamten Zustand', () => {
    const replacement = emptyAppData('2030/31');
    const next = appReducer(fixture(), { type: 'load', data: replacement });
    expect(next).toEqual(replacement);
  });

  test('security/set aktualisiert Sicherheitsdaten', () => {
    const security = { passwordHash: 'h', securityQuestion: 'q', securityAnswerHash: 'a', recoveryKeyHash: 'r' };
    const next = appReducer(fixture(), { type: 'security/set', security });
    expect(next.security).toEqual(security);
  });

  test('Reducer verändert den Eingabezustand nie', () => {
    const input = fixture();
    const snapshot = JSON.parse(JSON.stringify(input));
    appReducer(input, { type: 'class/delete', id: 'c1' });
    appReducer(input, { type: 'student/move', id: 's1', toClassId: 'c2', noteId: 'x', timestamp: 't' });
    appReducer(input, { type: 'column/delete', id: 'col1' });
    expect(input).toEqual(snapshot);
  });
});
