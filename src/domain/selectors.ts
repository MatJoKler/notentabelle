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

/** Spalten eines Fachs/einer Klasse für Halbjahr + Kategorie, sortiert nach order. */
export function columnsFor(
  data: AppData,
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
  data: AppData,
  studentId: StudentId,
  columns: Array<[ColumnId, GradeColumn]>,
): number[] {
  return columns
    .map(([columnId]) => data.grades[gradeKey(studentId, columnId)])
    .filter((value): value is number => value !== undefined);
}

/** Notenart-Durchschnitt eines Schülers in einem Halbjahr. */
export function studentCategoryAverage(
  data: AppData,
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
  data: AppData,
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

/** Durchschnitt einer Notenspalte über alle Schüler der Klasse. */
export function columnAverage(data: AppData, columnId: ColumnId): number | null {
  const column = data.columns[columnId];
  const studentIds = data.classes[column.classId]?.studentIds ?? [];
  return average(
    studentIds
      .map((studentId) => data.grades[gradeKey(studentId, columnId)])
      .filter((value): value is number => value !== undefined),
  );
}
