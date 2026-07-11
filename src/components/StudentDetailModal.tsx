import { useState } from 'react';
import { formatGrade, gradeBand } from '../domain/calc';
import { previousYearGrade, studentOverallAverage, subjectsForClass } from '../domain/insights';
import type { NoteType, StudentId } from '../domain/model';
import { studentSubjectSummary } from '../domain/selectors';
import { exportStudentPdf, openStudentPrintView } from '../export/output';
import { buildStudentReport } from '../export/studentReport';
import { useApp } from '../state/AppContext';
import { newId, nowIso } from '../state/ids';
import { Modal } from './Modal';

const NOTE_TYPES: Array<{ type: NoteType; label: string }> = [
  { type: 'general', label: 'Allgemein' },
  { type: 'parent', label: 'Elterngespräch' },
  { type: 'punishment', label: 'Strafarbeit' },
];

const NOTE_TYPE_LABEL = Object.fromEntries(NOTE_TYPES.map(({ type, label }) => [type, label]));

export function StudentDetailModal({ studentId, onClose }: { studentId: StudentId; onClose: () => void }) {
  const { data } = useApp();
  const [tab, setTab] = useState<'noten' | 'notizen'>('noten');

  const student = data.students[studentId];
  if (!student) return null;
  const schoolClass = data.classes[student.classId];
  const overall = studentOverallAverage(data, studentId);
  const noteCount = (data.notes[studentId] ?? []).length;

  return (
    <Modal title={student.name} onClose={onClose} wide>
      <div className="student-meta-row">
        <p className="student-meta">
          Klasse {schoolClass?.name} · Gesamtschnitt{' '}
          <strong className={overall !== null ? `band-${gradeBand(overall)}` : ''}>
            {formatGrade(overall)}
          </strong>
        </p>
        <span className="row-actions">
          <button
            className="button button-small"
            onClick={() => openStudentPrintView(buildStudentReport(data, studentId))}
          >
            Drucken
          </button>
          <button
            className="button button-small"
            onClick={() => void exportStudentPdf(buildStudentReport(data, studentId))}
          >
            Als PDF speichern
          </button>
        </span>
      </div>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'noten'}
          className={`tab${tab === 'noten' ? ' is-active' : ''}`}
          onClick={() => setTab('noten')}
        >
          Noten
        </button>
        <button
          role="tab"
          aria-selected={tab === 'notizen'}
          className={`tab${tab === 'notizen' ? ' is-active' : ''}`}
          onClick={() => setTab('notizen')}
        >
          Notizen {noteCount > 0 && `(${noteCount})`}
        </button>
      </div>

      {tab === 'noten' ? <GradesTab studentId={studentId} /> : <NotesTab studentId={studentId} />}
    </Modal>
  );
}

function GradesTab({ studentId }: { studentId: StudentId }) {
  const { data } = useApp();
  const student = data.students[studentId];
  const subjects = subjectsForClass(data, student.classId);
  const hasArchives = Object.keys(data.archives).length > 0;

  if (subjects.length === 0) {
    return <p className="empty-hint">Der Klasse ist noch kein Fach zugeordnet.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="grades-table">
        <thead>
          <tr>
            <th className="sticky-col">Fach</th>
            <th>1. HJ</th>
            <th>2. HJ</th>
            <th className="col-strong">Jahr</th>
            {hasArchives && <th>Vorjahr</th>}
            {hasArchives && <th>Trend</th>}
          </tr>
        </thead>
        <tbody>
          {subjects.map(([subjectId, subject]) => {
            const summary = studentSubjectSummary(data, studentId, subjectId, student.classId);
            const previous = hasArchives ? previousYearGrade(data, studentId, subject.name) : null;
            return (
              <tr key={subjectId}>
                <td className="sticky-col">{subject.name}</td>
                <Cell value={summary.semester1.grade} />
                <Cell value={summary.semester2.grade} />
                <Cell value={summary.year} strong />
                {hasArchives && <Cell value={previous} />}
                {hasArchives && (
                  <td className="grade-cell">
                    <Trend current={summary.year} previous={previous} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ value, strong = false }: { value: number | null; strong?: boolean }) {
  return (
    <td className={`grade-cell${strong ? ' col-strong' : ''}${value !== null ? ` band-${gradeBand(value)}` : ''}`}>
      {formatGrade(value)}
    </td>
  );
}

/** Kleinere Note = Verbesserung. */
function Trend({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null) return <span className="trend-none">–</span>;
  if (current < previous) return <span className="trend-up" title="Verbessert">▲</span>;
  if (current > previous) return <span className="trend-down" title="Verschlechtert">▼</span>;
  return <span className="trend-none" title="Unverändert">●</span>;
}

function NotesTab({ studentId }: { studentId: StudentId }) {
  const { data, dispatch } = useApp();
  const [filter, setFilter] = useState<NoteType | 'alle'>('alle');
  const [text, setText] = useState('');
  const [type, setType] = useState<NoteType>('general');

  const notes = (data.notes[studentId] ?? []).filter((n) => filter === 'alle' || n.type === filter);

  const addNote = () => {
    const trimmed = text.trim();
    if (trimmed === '') return;
    dispatch({
      type: 'note/add',
      studentId,
      note: { id: newId(), type, text: trimmed, timestamp: nowIso() },
    });
    setText('');
  };

  return (
    <div>
      <div className="note-compose">
        <textarea
          className="input note-textarea"
          placeholder="Neue Notiz …"
          value={text}
          rows={2}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="note-compose-row">
          <select className="input note-type-select" value={type} onChange={(e) => setType(e.target.value as NoteType)}>
            {NOTE_TYPES.map(({ type: t, label }) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
          </select>
          <button className="button button-primary" onClick={addNote} disabled={text.trim() === ''}>
            Notiz speichern
          </button>
        </div>
      </div>

      <div className="chip-row">
        <button className={`chip${filter === 'alle' ? ' is-active' : ''}`} onClick={() => setFilter('alle')}>
          Alle
        </button>
        {NOTE_TYPES.map(({ type: t, label }) => (
          <button key={t} className={`chip${filter === t ? ' is-active' : ''}`} onClick={() => setFilter(t)}>
            {label}
          </button>
        ))}
      </div>

      {notes.length === 0 ? (
        <p className="empty-hint">Noch keine Notizen in dieser Kategorie.</p>
      ) : (
        <ul className="note-list">
          {notes.map((note) => (
            <li key={note.id} className={`note-card note-${note.type}`}>
              <div className="note-head">
                <span className="note-type">{NOTE_TYPE_LABEL[note.type]}</span>
                <span className="note-date">{formatTimestamp(note.timestamp)}</span>
                <button
                  className="link-button link-danger"
                  onClick={() => dispatch({ type: 'note/delete', studentId, noteId: note.id })}
                >
                  Löschen
                </button>
              </div>
              <p className="note-text">{note.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
