import { average, gradeBand, type GradeBand } from './calc';
import type { AppData, ClassId, StudentId, Subject, SubjectId } from './model';
import { studentSubjectSummary, type YearData } from './selectors';

/** Fächer, die eine Klasse unterrichten, alphabetisch. */
export function subjectsForClass(data: YearData, classId: ClassId): Array<[SubjectId, Subject]> {
  return Object.entries(data.subjects)
    .filter(([, subject]) => subject.assignedClassIds.includes(classId))
    .sort(([, a], [, b]) => a.name.localeCompare(b.name, 'de'));
}

function studentYearGrades(data: YearData, studentId: StudentId): number[] {
  const classId = data.students[studentId]?.classId;
  if (!classId) return [];
  return subjectsForClass(data, classId)
    .map(([subjectId]) => studentSubjectSummary(data, studentId, subjectId, classId).year)
    .filter((year): year is number => year !== null);
}

/** Gesamtschnitt eines Schülers über die Jahresnoten aller Fächer. */
export function studentOverallAverage(data: YearData, studentId: StudentId): number | null {
  return average(studentYearGrades(data, studentId));
}

/** Klassenschnitt eines Fachs über die Jahresnoten der Schüler. */
export function classSubjectAverage(data: YearData, subjectId: SubjectId, classId: ClassId): number | null {
  const studentIds = data.classes[classId]?.studentIds ?? [];
  return average(
    studentIds
      .map((studentId) => studentSubjectSummary(data, studentId, subjectId, classId).year)
      .filter((year): year is number => year !== null),
  );
}

export interface RankedStudent {
  studentId: StudentId;
  average: number;
}

/** Alle Schüler mit Gesamtschnitt, beste zuerst; ohne Noten kein Eintrag. */
export function studentRanking(data: YearData): RankedStudent[] {
  return Object.keys(data.students)
    .map((studentId) => ({ studentId, average: studentOverallAverage(data, studentId) }))
    .filter((entry): entry is RankedStudent => entry.average !== null)
    .sort((a, b) => a.average - b.average);
}

/** Verteilung aller Jahresnoten (Schüler × Fach) auf die Notenbänder. */
export function gradeDistribution(data: YearData): Record<GradeBand, number> {
  const distribution: Record<GradeBand, number> = {
    'sehr-gut': 0,
    gut: 0,
    befriedigend: 0,
    schlecht: 0,
  };
  for (const studentId of Object.keys(data.students)) {
    for (const year of studentYearGrades(data, studentId)) {
      distribution[gradeBand(year)] += 1;
    }
  }
  return distribution;
}

/**
 * Jahresnote des Schülers im jüngsten Archivjahr für ein gleichnamiges Fach —
 * Fach-IDs ändern sich über Jahre, daher Zuordnung über den Fachnamen.
 */
export function previousYearGrade(data: AppData, studentId: StudentId, subjectName: string): number | null {
  const years = Object.keys(data.archives).sort().reverse();
  for (const year of years) {
    const snapshot = data.archives[year];
    const student = snapshot.students[studentId];
    if (!student) continue;
    const subjectEntry = Object.entries(snapshot.subjects).find(([, s]) => s.name === subjectName);
    if (!subjectEntry) continue;
    return studentSubjectSummary(snapshot, studentId, subjectEntry[0], student.classId).year;
  }
  return null;
}
