import { describe, expect, test } from 'vitest';
import {
  excelSerialToIso,
  extractExcelData,
  mergeExcelImport,
  mergeExcelImportIntoArchive,
  type ParsedWorkbook,
} from './importExcel';
import { emptyAppData, gradeKey } from './model';

/** Minimale gefüllte Vorlage: 2 Schüler, Mathe, 2 KA-Spalten + 1 Test. */
function workbook(): ParsedWorkbook {
  return {
    Übersicht: { B2: 'Mathematik', C5: '2025/26' },
    Einstellungen: {
      C5: 'Beispiel', D5: 'Anna',
      C6: 'Muster', D6: 'Ben',
      F5: 'KA', G5: '3',
      F6: 'Test', G6: '1',
      F7: 'Mündlich', G7: '2',
    },
    KA_1_Halbjahr: {
      G4: '45953', G6: '2.5', G7: '3',
      I4: 'Datum', I6: '1',
    },
    Tests_1_Halbjahr: { G4: 'Vokabeltest', G7: '4' },
    Mündlich_1_Halbjahr: {},
    KA_2_Halbjahr: {},
    Tests_2_Halbjahr: {},
    Mündlich_2_Halbjahr: {},
  };
}

describe('excelSerialToIso', () => {
  test('bekannte Serialdaten', () => {
    expect(excelSerialToIso(44927)).toBe('2023-01-01');
    expect(excelSerialToIso(45953)).toBe('2025-10-23');
  });
});

describe('extractExcelData', () => {
  test('liest Fachname und Schuljahr', () => {
    const excel = extractExcelData(workbook());
    expect(excel.subjectName).toBe('Mathematik');
    expect(excel.schoolYear).toBe('2025/26');
  });

  test('Platzhalter FACH ergibt null', () => {
    const wb = workbook();
    wb['Übersicht'].B2 = 'FACH';
    expect(extractExcelData(wb).subjectName).toBeNull();
  });

  test('liest Schüler als „Vorname Nachname" in Zeilenreihenfolge', () => {
    expect(extractExcelData(workbook()).students).toEqual(['Anna Beispiel', 'Ben Muster']);
  });

  test('liest Gewichtung als Faktor-Modus', () => {
    expect(extractExcelData(workbook()).weights).toEqual({
      ka: 3, tests: 1, muendlich: 2, mode: 'factor',
    });
  });

  test('fehlende Gewichtung ergibt Standardgewichte', () => {
    const wb = workbook();
    delete wb['Einstellungen'].F5;
    delete wb['Einstellungen'].G5;
    delete wb['Einstellungen'].F6;
    delete wb['Einstellungen'].G6;
    delete wb['Einstellungen'].F7;
    delete wb['Einstellungen'].G7;
    expect(extractExcelData(wb).weights.mode).toBe('percent');
  });

  test('erzeugt nur Spalten mit mindestens einer gültigen Note', () => {
    const excel = extractExcelData(workbook());
    const ka1 = excel.columns.filter((c) => c.category === 'ka' && c.semester === 1);
    expect(ka1).toHaveLength(2);
    expect(excel.columns.filter((c) => c.semester === 2)).toHaveLength(0);
  });

  test('Serialdatum wird zu ISO-Datum, Text „Datum" ignoriert, echter Text wird Titel', () => {
    const excel = extractExcelData(workbook());
    const ka1 = excel.columns.filter((c) => c.category === 'ka' && c.semester === 1);
    expect(ka1[0].date).toBe('2025-10-23');
    expect(ka1[0].title).toBe('KA 1');
    expect(ka1[1].date).toBeNull();
    expect(ka1[1].title).toBe('KA 2');
    const test1 = excel.columns.find((c) => c.category === 'test');
    expect(test1?.title).toBe('Vokabeltest');
  });

  test('ordnet Noten dem richtigen Schüler zu und überspringt ungültige Werte', () => {
    const wb = workbook();
    wb['KA_1_Halbjahr'].I7 = '9'; // ungültig (> 6)
    const excel = extractExcelData(wb);
    const ka1 = excel.columns.filter((c) => c.category === 'ka' && c.semester === 1);
    expect(ka1[0].grades).toEqual([
      { studentIndex: 0, value: 2.5 },
      { studentIndex: 1, value: 3 },
    ]);
    expect(ka1[1].grades).toEqual([{ studentIndex: 0, value: 1 }]);
  });

  test('wirft verständlichen Fehler, wenn die Vorlagen-Sheets fehlen', () => {
    expect(() => extractExcelData({ Blatt1: {} })).toThrow(/Vorlage/);
  });
});

describe('mergeExcelImport', () => {
  const options = { className: '8c', subjectName: 'Mathematik' };

  test('legt Klasse, Schüler, Fach, Spalten und Noten an', () => {
    const result = mergeExcelImport(emptyAppData('2025/26'), extractExcelData(workbook()), options);

    const classId = Object.keys(result.classes)[0];
    expect(result.classes[classId].name).toBe('8c');
    expect(result.classes[classId].studentIds).toHaveLength(2);

    const subject = Object.values(result.subjects)[0];
    expect(subject.name).toBe('Mathematik');
    expect(subject.assignedClassIds).toEqual([classId]);
    expect(subject.weights.mode).toBe('factor');

    expect(Object.keys(result.columns)).toHaveLength(3);

    const anna = result.classes[classId].studentIds[0];
    const ka1 = Object.entries(result.columns).find(
      ([, c]) => c.category === 'ka' && c.order === 0,
    )!;
    expect(result.grades[gradeKey(anna, ka1[0])]).toBe(2.5);
  });

  test('bestehende Daten bleiben unangetastet', () => {
    const base = emptyAppData('2025/26');
    base.classes.alt = { name: '7a', studentIds: [] };
    const result = mergeExcelImport(base, extractExcelData(workbook()), options);
    expect(result.classes.alt).toEqual({ name: '7a', studentIds: [] });
    expect(Object.keys(result.classes)).toHaveLength(2);
  });

  test('vorhandenes gleichnamiges Fach wird wiederverwendet (Gewichte bleiben)', () => {
    const base = emptyAppData('2025/26');
    base.subjects.m = {
      name: 'Mathematik',
      assignedClassIds: [],
      weights: { ka: 50, tests: 25, muendlich: 25, mode: 'percent' },
    };
    const result = mergeExcelImport(base, extractExcelData(workbook()), options);
    expect(Object.keys(result.subjects)).toHaveLength(1);
    expect(result.subjects.m.weights.mode).toBe('percent');
    expect(result.subjects.m.assignedClassIds).toHaveLength(1);
  });

  test('wirft bei bereits vorhandenem Klassennamen', () => {
    const base = emptyAppData('2025/26');
    base.classes.c = { name: '8c', studentIds: [] };
    expect(() => mergeExcelImport(base, extractExcelData(workbook()), options)).toThrow(/8c/);
  });

  test('Eingabedaten bleiben unverändert (immutable)', () => {
    const base = emptyAppData('2025/26');
    const snapshot = JSON.parse(JSON.stringify(base));
    mergeExcelImport(base, extractExcelData(workbook()), options);
    expect(base).toEqual(snapshot);
  });
});

describe('mergeExcelImportIntoArchive', () => {
  const options = {
    className: '8c',
    subjectName: 'Mathematik',
    schoolYear: '2024/25',
    archivedDate: '2026-07-12T10:00:00Z',
  };

  test('legt neuen Archiv-Snapshot mit Klasse, Fach und Noten an', () => {
    const result = mergeExcelImportIntoArchive(
      emptyAppData('2026/27'),
      extractExcelData(workbook()),
      options,
    );

    const snap = result.archives['2024/25'];
    expect(snap).toBeDefined();
    expect(snap.schoolYear).toBe('2024/25');
    expect(snap.archivedDate).toBe('2026-07-12T10:00:00Z');

    const classId = Object.keys(snap.classes)[0];
    expect(snap.classes[classId].name).toBe('8c');
    expect(Object.values(snap.subjects)[0].name).toBe('Mathematik');
    expect(Object.keys(snap.columns)).toHaveLength(3);

    const anna = snap.classes[classId].studentIds[0];
    const ka1 = Object.entries(snap.columns).find(([, c]) => c.category === 'ka' && c.order === 0)!;
    expect(snap.grades[gradeKey(anna, ka1[0])]).toBe(2.5);
  });

  test('aktuelles Schuljahr bleibt unberührt', () => {
    const result = mergeExcelImportIntoArchive(
      emptyAppData('2026/27'),
      extractExcelData(workbook()),
      options,
    );
    expect(result.classes).toEqual({});
    expect(result.subjects).toEqual({});
    expect(result.schoolYear).toBe('2026/27');
  });

  test('fügt in bestehenden Archiv-Snapshot ein, ohne dessen Inhalt zu verlieren', () => {
    const base = emptyAppData('2026/27');
    base.archives['2024/25'] = {
      schoolYear: '2024/25',
      archivedDate: '2025-07-20T10:00:00Z',
      classes: { alt: { name: '7a', studentIds: [] } },
      students: {},
      subjects: {},
      columns: {},
      grades: {},
      notes: {},
    };
    const result = mergeExcelImportIntoArchive(base, extractExcelData(workbook()), options);
    const snap = result.archives['2024/25'];
    expect(snap.classes.alt).toEqual({ name: '7a', studentIds: [] });
    expect(Object.keys(snap.classes)).toHaveLength(2);
    expect(snap.archivedDate).toBe('2025-07-20T10:00:00Z'); // Original bleibt
  });

  test('wirft bei doppeltem Klassennamen im selben Archivjahr', () => {
    const base = emptyAppData('2026/27');
    base.archives['2024/25'] = {
      schoolYear: '2024/25',
      archivedDate: '2025-07-20T10:00:00Z',
      classes: { alt: { name: '8c', studentIds: [] } },
      students: {},
      subjects: {},
      columns: {},
      grades: {},
      notes: {},
    };
    expect(() => mergeExcelImportIntoArchive(base, extractExcelData(workbook()), options)).toThrow(/8c/);
  });

  test('Eingabedaten bleiben unverändert (immutable)', () => {
    const base = emptyAppData('2026/27');
    const snapshot = JSON.parse(JSON.stringify(base));
    mergeExcelImportIntoArchive(base, extractExcelData(workbook()), options);
    expect(base).toEqual(snapshot);
  });
});
