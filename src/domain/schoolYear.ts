import type { AppData, ClassId, StudentId } from './model';

/** Ab dieser Stufe verlässt eine Klasse nach dem Schuljahr die Schule. */
export const MAX_GRADE_LEVEL = 10;

const CLASS_NAME_PATTERN = /^(\d+)([a-zA-Z]+)$/;

export interface ParsedClassName {
  level: number;
  suffix: string;
}

export function parseClassName(name: string): ParsedClassName | null {
  const match = CLASS_NAME_PATTERN.exec(name);
  if (!match) return null;
  return { level: Number(match[1]), suffix: match[2] };
}

export function promoteClassName(name: string): string | null {
  const parsed = parseClassName(name);
  if (!parsed) return null;
  return `${parsed.level + 1}${parsed.suffix}`;
}

export function isGraduating(name: string): boolean {
  const parsed = parseClassName(name);
  return parsed !== null && parsed.level >= MAX_GRADE_LEVEL;
}

/** Schuljahr zu einem Datum: ab August beginnt das neue Jahr. */
export function schoolYearLabelForDate(date: Date): string {
  const startYear = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  const endSuffix = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${endSuffix}`;
}

/** "2025/26" → "2026/27" */
export function nextSchoolYearLabel(label: string): string {
  const startYear = Number(label.split('/')[0]) + 1;
  const endSuffix = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${endSuffix}`;
}

export interface ArchiveOptions {
  archivedDate: string; // ISO-Zeitstempel
}

/**
 * Schuljahreswechsel: Snapshot ins Archiv, Klassen hochstufen,
 * Abschlussklassen (ab Stufe 10) samt Schülern/Notizen entfernen,
 * Notenspalten und Noten zurücksetzen. Eingabe bleibt unverändert.
 */
export function archiveAndAdvance(data: AppData, options: ArchiveOptions): AppData {
  const snapshot = {
    schoolYear: data.schoolYear,
    classes: data.classes,
    students: data.students,
    subjects: data.subjects,
    columns: data.columns,
    grades: data.grades,
    notes: data.notes,
    trackingColumns: data.trackingColumns,
    trackingValues: data.trackingValues,
    archivedDate: options.archivedDate,
  };

  const graduatingClassIds = new Set<ClassId>(
    Object.keys(data.classes).filter((id) => isGraduating(data.classes[id].name)),
  );
  const graduatingStudentIds = new Set<StudentId>(
    Object.keys(data.students).filter((id) => graduatingClassIds.has(data.students[id].classId)),
  );

  const classes = Object.fromEntries(
    Object.entries(data.classes)
      .filter(([id]) => !graduatingClassIds.has(id))
      .map(([id, cls]) => [id, { ...cls, name: promoteClassName(cls.name) ?? cls.name }]),
  );
  const students = Object.fromEntries(
    Object.entries(data.students).filter(([id]) => !graduatingStudentIds.has(id)),
  );
  const notes = Object.fromEntries(
    Object.entries(data.notes).filter(([id]) => !graduatingStudentIds.has(id)),
  );
  const subjects = Object.fromEntries(
    Object.entries(data.subjects).map(([id, subject]) => [
      id,
      {
        ...subject,
        assignedClassIds: subject.assignedClassIds.filter((cid) => !graduatingClassIds.has(cid)),
      },
    ]),
  );

  return {
    ...data,
    schoolYear: nextSchoolYearLabel(data.schoolYear),
    classes,
    students,
    subjects,
    columns: {},
    grades: {},
    notes,
    trackingColumns: {},
    trackingValues: {},
    archives: { ...data.archives, [data.schoolYear]: snapshot },
  };
}
