import { average, semesterGrade, yearGrade } from './calc';
import {
  gradeKey,
  type AppData,
  type Category,
  type ClassId,
  type ColumnId,
  type GradeColumn,
  type Semester,
  type StudentId,
  type SubjectId,
} from './model';

/** Teilmenge von AppData, die auch Archiv-Snapshots erfüllen — alle Selectors arbeiten darauf. */
export type YearData = Pick<AppData, 'classes' | 'students' | 'subjects' | 'columns' | 'grades'>;

/** Spalten eines Fachs/einer Klasse für Halbjahr + Kategorie, sortiert nach order. */
export function columnsFor(
  data: YearData,
  subjectId: SubjectId,
  classId: ClassId,
  semester: Semester,
  category: Category,
): Array<[ColumnId, GradeColumn]> {
  return Object.entries(data.columns)
    .filter(
      ([, c]) =>
        c.subjectId === subjectId &&
        c.classId === classId &&
        c.semester === semester &&
        c.category === category,
    )
    .sort(([, a], [, b]) => a.order - b.order);
}

function gradesForColumns(
  data: YearData,
  studentId: StudentId,
  columns: Array<[ColumnId, GradeColumn]>,
): number[] {
  return columns
    .map(([columnId]) => data.grades[gradeKey(studentId, columnId)])
    .filter((value): value is number => value !== undefined);
}

/** Notenart-Durchschnitt eines Schülers in einem Halbjahr. */
export function studentCategoryAverage(
  data: YearData,
  studentId: StudentId,
  subjectId: SubjectId,
  classId: ClassId,
  semester: Semester,
  category: Category,
): number | null {
  return average(gradesForColumns(data, studentId, columnsFor(data, subjectId, classId, semester, category)));
}

export interface SemesterSummary {
  ka: number | null;
  tests: number | null;
  muendlich: number | null;
  grade: number | null;
}

export interface SubjectSummary {
  semester1: SemesterSummary;
  semester2: SemesterSummary;
  year: number | null;
}

/** Komplette Notenübersicht eines Schülers in einem Fach (beide Halbjahre + Jahr). */
export function studentSubjectSummary(
  data: YearData,
  studentId: StudentId,
  subjectId: SubjectId,
  classId: ClassId,
): SubjectSummary {
  const weights = data.subjects[subjectId].weights;

  const summarize = (semester: Semester): SemesterSummary => {
    const parts = {
      ka: studentCategoryAverage(data, studentId, subjectId, classId, semester, 'ka'),
      tests: studentCategoryAverage(data, studentId, subjectId, classId, semester, 'test'),
      muendlich: studentCategoryAverage(data, studentId, subjectId, classId, semester, 'muendlich'),
    };
    return { ...parts, grade: semesterGrade(parts, weights) };
  };

  const semester1 = summarize(1);
  const semester2 = summarize(2);
  return { semester1, semester2, year: yearGrade(semester1.grade, semester2.grade) };
}

export type WholeGrade = 1 | 2 | 3 | 4 | 5 | 6;

/** Notenspiegel einer Spalte: Anzahl je ganzer Note (kaufmännisch gerundet). */
export function columnGradeDistribution(data: YearData, columnId: ColumnId): Record<WholeGrade, number> {
  const column = data.columns[columnId];
  const distribution: Record<WholeGrade, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const studentId of data.classes[column.classId]?.studentIds ?? []) {
    const value = data.grades[gradeKey(studentId, columnId)];
    if (value === undefined) continue;
    const whole = Math.min(6, Math.max(1, Math.round(value))) as WholeGrade;
    distribution[whole] += 1;
  }
  return distribution;
}

/** Durchschnitt einer Notenspalte über alle Schüler der Klasse. */
export function columnAverage(data: YearData, columnId: ColumnId): number | null {
  const column = data.columns[columnId];
  const studentIds = data.classes[column.classId]?.studentIds ?? [];
  return average(
    studentIds
      .map((studentId) => data.grades[gradeKey(studentId, columnId)])
      .filter((value): value is number => value !== undefined),
  );
}
