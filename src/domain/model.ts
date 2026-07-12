export type ClassId = string;
export type StudentId = string;
export type SubjectId = string;
export type ColumnId = string;

export type WeightMode = 'percent' | 'factor';

export type Category = 'ka' | 'test' | 'muendlich';

export type Semester = 1 | 2;

export interface Weights {
  ka: number;
  tests: number;
  muendlich: number;
  mode: WeightMode;
}

export interface SchoolClass {
  name: string;
  studentIds: StudentId[];
}

export interface Student {
  name: string;
  classId: ClassId;
}

export interface Subject {
  name: string;
  assignedClassIds: ClassId[];
  weights: Weights;
}

export interface GradeColumn {
  subjectId: SubjectId;
  classId: ClassId;
  semester: Semester;
  category: Category;
  title: string;
  date: string | null; // ISO YYYY-MM-DD
  order: number;
}

/** Spalte der Abgaben-Liste (Hausaufgabenstriche, Schulfest …) je Fach+Klasse. */
export interface TrackingColumn {
  subjectId: SubjectId;
  classId: ClassId;
  title: string;
  order: number;
}

export type NoteType = 'general' | 'parent' | 'punishment';

export interface StudentNote {
  id: string;
  type: NoteType;
  text: string;
  timestamp: string; // ISO
}

export interface Security {
  passwordHash: string | null;
  securityQuestion: string | null;
  securityAnswerHash: string | null;
  recoveryKeyHash: string | null;
}

export interface YearSnapshot {
  schoolYear: string;
  classes: Record<ClassId, SchoolClass>;
  students: Record<StudentId, Student>;
  subjects: Record<SubjectId, Subject>;
  columns: Record<ColumnId, GradeColumn>;
  grades: Record<string, number>; // key: `${StudentId}:${ColumnId}`
  notes: Record<StudentId, StudentNote[]>;
  trackingColumns: Record<string, TrackingColumn>;
  trackingValues: Record<string, string>; // key: `${StudentId}:${trackingColumnId}`
  archivedDate: string; // ISO
}

export interface AppData {
  version: 1;
  schoolYear: string;
  classes: Record<ClassId, SchoolClass>;
  students: Record<StudentId, Student>;
  subjects: Record<SubjectId, Subject>;
  columns: Record<ColumnId, GradeColumn>;
  grades: Record<string, number>; // key: `${StudentId}:${ColumnId}`
  notes: Record<StudentId, StudentNote[]>;
  trackingColumns: Record<string, TrackingColumn>;
  trackingValues: Record<string, string>; // key: `${StudentId}:${trackingColumnId}`
  archives: Record<string, YearSnapshot>;
  security: Security;
}

export const DEFAULT_WEIGHTS: Weights = {
  ka: 50,
  tests: 25,
  muendlich: 25,
  mode: 'percent',
};

export function gradeKey(studentId: StudentId, columnId: ColumnId): string {
  return `${studentId}:${columnId}`;
}

export function emptyAppData(schoolYear: string): AppData {
  return {
    version: 1,
    schoolYear,
    classes: {},
    students: {},
    subjects: {},
    columns: {},
    grades: {},
    notes: {},
    trackingColumns: {},
    trackingValues: {},
    archives: {},
    security: {
      passwordHash: null,
      securityQuestion: null,
      securityAnswerHash: null,
      recoveryKeyHash: null,
    },
  };
}
