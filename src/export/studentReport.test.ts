import { describe, expect, test } from 'vitest';
import { emptyAppData, gradeKey, type AppData } from '../domain/model';
import { buildStudentReport } from './studentReport';

function fixture(): AppData {
  const data = emptyAppData('2025/26');
  data.classes.c1 = { name: '8c', studentIds: ['s1'] };
  data.students.s1 = { name: 'Anna Beispiel', classId: 'c1' };
  data.subjects.m = {
    name: 'Mathe',
    assignedClassIds: ['c1'],
    weights: { ka: 50, tests: 25, muendlich: 25, mode: 'percent' },
  };
  data.columns.ka1 = {
    subjectId: 'm',
    classId: 'c1',
    semester: 1,
    category: 'ka',
    title: 'KA 1',
    date: null,
    order: 0,
  };
  data.grades[gradeKey('s1', 'ka1')] = 2.5;
  data.notes.s1 = [
    { id: 'n1', type: 'parent', text: 'Gespräch am Elternsprechtag', timestamp: '2025-11-01T10:00:00Z' },
  ];
  return data;
}

describe('buildStudentReport', () => {
  test('enthält Kopfdaten', () => {
    const report = buildStudentReport(fixture(), 's1');
    expect(report.title).toContain('Anna Beispiel');
    expect(report.meta).toContain('8c');
    expect(report.meta).toContain('2025/26');
  });

  test('führt jedes Fach mit HJ- und Jahresnoten auf', () => {
    const report = buildStudentReport(fixture(), 's1');
    expect(report.subjects).toEqual([
      { name: 'Mathe', semester1: '2,50', semester2: '–', year: '2,50', previous: null },
    ]);
  });

  test('enthält Notizen mit Kategorie', () => {
    const report = buildStudentReport(fixture(), 's1');
    expect(report.notes).toHaveLength(1);
    expect(report.notes[0].label).toBe('Elterngespräch');
    expect(report.notes[0].text).toContain('Elternsprechtag');
  });

  test('Vorjahresnote erscheint, wenn Archiv vorhanden', () => {
    const data = fixture();
    data.archives['2024/25'] = {
      schoolYear: '2024/25',
      archivedDate: '2025-07-20T10:00:00Z',
      classes: { alt: { name: '7c', studentIds: ['s1'] } },
      students: { s1: { name: 'Anna Beispiel', classId: 'alt' } },
      subjects: { altM: { name: 'Mathe', assignedClassIds: ['alt'], weights: data.subjects.m.weights } },
      columns: {
        aka: { subjectId: 'altM', classId: 'alt', semester: 1, category: 'ka', title: 'KA', date: null, order: 0 },
      },
      grades: { [gradeKey('s1', 'aka')]: 3 },
      notes: {},
      trackingColumns: {},
      trackingValues: {},
    };
    const report = buildStudentReport(data, 's1');
    expect(report.subjects[0].previous).toBe('3,00');
  });
});
