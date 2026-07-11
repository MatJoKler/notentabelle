import { formatGrade } from '../domain/calc';
import { previousYearGrade, studentOverallAverage, subjectsForClass } from '../domain/insights';
import type { AppData, StudentId } from '../domain/model';
import { studentSubjectSummary } from '../domain/selectors';

const NOTE_LABELS: Record<string, string> = {
  general: 'Allgemein',
  parent: 'Elterngespräch',
  punishment: 'Strafarbeit',
};

export interface StudentReport {
  title: string;
  meta: string;
  overall: string;
  subjects: Array<{
    name: string;
    semester1: string;
    semester2: string;
    year: string;
    /** null, wenn keine Archive existieren (Spalte entfällt). */
    previous: string | null;
  }>;
  notes: Array<{ label: string; date: string; text: string }>;
}

/** Druck-/PDF-Daten eines Schülers — reine Aufbereitung, keine Ausgabe. */
export function buildStudentReport(data: AppData, studentId: StudentId): StudentReport {
  const student = data.students[studentId];
  const className = data.classes[student.classId]?.name ?? '';
  const hasArchives = Object.keys(data.archives).length > 0;

  const subjects = subjectsForClass(data, student.classId).map(([subjectId, subject]) => {
    const summary = studentSubjectSummary(data, studentId, subjectId, student.classId);
    return {
      name: subject.name,
      semester1: formatGrade(summary.semester1.grade),
      semester2: formatGrade(summary.semester2.grade),
      year: formatGrade(summary.year),
      previous: hasArchives ? formatGrade(previousYearGrade(data, studentId, subject.name)) : null,
    };
  });

  const notes = (data.notes[studentId] ?? []).map((note) => ({
    label: NOTE_LABELS[note.type] ?? note.type,
    date: formatDate(note.timestamp),
    text: note.text,
  }));

  return {
    title: student.name,
    meta: `Klasse ${className} · Schuljahr ${data.schoolYear}`,
    overall: formatGrade(studentOverallAverage(data, studentId)),
    subjects,
    notes,
  };
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
