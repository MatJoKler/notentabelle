import { parseGrade } from './calc';
import {
  DEFAULT_WEIGHTS,
  gradeKey,
  type AppData,
  type Category,
  type GradeColumn,
  type SchoolClass,
  type Security,
  type Semester,
  type Student,
  type StudentNote,
  type Subject,
  type YearSnapshot,
} from './model';

/** Die sechs Noten-Arrays der Alt-App: Kategorie-Präfix + Halbjahr. */
const LEGACY_KEYS: Array<{ key: string; category: Category; semester: Semester }> = [
  { key: 'ka1', category: 'ka', semester: 1 },
  { key: 'ka2', category: 'ka', semester: 2 },
  { key: 'test1', category: 'test', semester: 1 },
  { key: 'test2', category: 'test', semester: 2 },
  { key: 'm1', category: 'muendlich', semester: 1 },
  { key: 'm2', category: 'muendlich', semester: 2 },
];

const FALLBACK_TITLES: Record<Category, string> = {
  ka: 'KA',
  test: 'Test',
  muendlich: 'Mündlich',
};

export function isLegacyData(raw: unknown): boolean {
  if (raw === null || typeof raw !== 'object') return false;
  const obj = raw as Record<string, unknown>;
  return !('version' in obj) && 'classes' in obj && 'subjects' in obj && 'grades' in obj;
}

interface YearContent {
  classes: Record<string, SchoolClass>;
  students: Record<string, Student>;
  subjects: Record<string, Subject>;
  columns: Record<string, GradeColumn>;
  grades: Record<string, number>;
  notes: Record<string, StudentNote[]>;
}

/** Wandelt Klassen/Fächer/Noten/Notizen eines Alt-Jahres (aktuell oder Archiv) um. */
function migrateYearContent(legacy: any): YearContent {
  const classes: Record<string, SchoolClass> = {};
  const students: Record<string, Student> = {};
  for (const [classId, cls] of Object.entries<any>(legacy.classes ?? {})) {
    const legacyStudents: any[] = cls.students ?? [];
    classes[classId] = { name: cls.name, studentIds: legacyStudents.map((s) => s.id) };
    for (const s of legacyStudents) {
      students[s.id] = { name: s.name, classId };
    }
  }

  const subjects: Record<string, Subject> = {};
  for (const [subjectId, subject] of Object.entries<any>(legacy.subjects ?? {})) {
    const settings = subject.settings ?? {};
    subjects[subjectId] = {
      name: subject.name,
      assignedClassIds: subject.assignedClasses ?? [],
      weights: {
        ka: settings.ka ?? DEFAULT_WEIGHTS.ka,
        tests: settings.tests ?? DEFAULT_WEIGHTS.tests,
        muendlich: settings.muendlich ?? DEFAULT_WEIGHTS.muendlich,
        mode: settings.mode === 'factor' ? 'factor' : 'percent',
      },
    };
  }

  const columns: Record<string, GradeColumn> = {};
  const grades: Record<string, number> = {};
  for (const [subjectId, byClass] of Object.entries<any>(legacy.grades ?? {})) {
    for (const [classId, byStudent] of Object.entries<any>(byClass ?? {})) {
      const studentEntries = Object.entries<any>(byStudent ?? {});
      for (const { key, category, semester } of LEGACY_KEYS) {
        // Spaltenanzahl: längstes Noten-Array bzw. höchster Titel-Index über alle Schüler
        let count = 0;
        for (const [, cell] of studentEntries) {
          count = Math.max(count, (cell?.[key] ?? []).length);
          for (const cellKey of Object.keys(cell ?? {})) {
            const match = new RegExp(`^${key}_(?:title|label)_(\\d+)$`).exec(cellKey);
            if (match) count = Math.max(count, Number(match[1]) + 1);
          }
        }
        for (let i = 0; i < count; i++) {
          const columnId = `${subjectId}_${classId}_${key}_${i}`;
          // Titel/Datum lagen redundant bei jedem Schüler — erster Treffer gewinnt
          let title: string | null = null;
          let date: string | null = null;
          for (const [, cell] of studentEntries) {
            title ??= cell?.[`${key}_title_${i}`] ?? null;
            date ??= cell?.[`${key}_label_${i}`] ?? null;
          }
          columns[columnId] = {
            subjectId,
            classId,
            semester,
            category,
            title: title ?? `${FALLBACK_TITLES[category]} ${i + 1}`,
            date,
            order: i,
          };
          for (const [studentId, cell] of studentEntries) {
            const raw = cell?.[key]?.[i];
            const value = typeof raw === 'string' ? parseGrade(raw) : null;
            if (value !== null) grades[gradeKey(studentId, columnId)] = value;
          }
        }
      }
    }
  }

  const notes: Record<string, StudentNote[]> = {};
  for (const [studentId, legacyNotes] of Object.entries<any>(legacy.studentNotes ?? {})) {
    notes[studentId] = (legacyNotes as any[]).map((note, i) => ({
      id: note.id ?? `${studentId}_note_${i}`,
      type: note.type === 'parent' || note.type === 'punishment' ? note.type : 'general',
      text: note.text ?? '',
      timestamp: note.timestamp ?? '',
    }));
  }

  return { classes, students, subjects, columns, grades, notes };
}

/** Kompletten Export der Alt-App (notenrechner-data.json) ins neue Format überführen. */
export function migrateLegacyData(legacy: any): AppData {
  const security: Security = {
    passwordHash: legacy.security?.passwordHash ?? null,
    securityQuestion: legacy.security?.securityQuestion ?? null,
    securityAnswerHash: legacy.security?.securityAnswerHash ?? null,
    recoveryKeyHash: legacy.security?.recoveryKeyHash ?? null,
  };

  const archives: Record<string, YearSnapshot> = {};
  for (const [year, snapshot] of Object.entries<any>(legacy.archives ?? {})) {
    archives[year] = {
      schoolYear: snapshot.schoolYear ?? year,
      archivedDate: snapshot.archivedDate ?? '',
      trackingColumns: {}, // Alt-App kannte kein Abgaben-Tracking
      trackingValues: {},
      ...migrateYearContent(snapshot),
    };
  }

  return {
    version: 1,
    schoolYear: legacy.schoolYear ?? '',
    archives,
    security,
    trackingColumns: {},
    trackingValues: {},
    ...migrateYearContent(legacy),
  };
}
