import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatGrade, gradeBand, parseGrade } from '../domain/calc';
import type { Category, ClassId, ColumnId, Semester, StudentId, SubjectId } from '../domain/model';
import { gradeKey } from '../domain/model';
import { columnAverage, columnsFor, studentCategoryAverage, studentSubjectSummary } from '../domain/selectors';
import { useApp } from '../state/AppContext';
import { newId } from '../state/ids';

type Tab = 'uebersicht' | Category;

const TAB_LABELS: Array<{ tab: Tab; label: string }> = [
  { tab: 'uebersicht', label: 'Übersicht' },
  { tab: 'ka', label: 'Klassenarbeiten' },
  { tab: 'test', label: 'Tests' },
  { tab: 'muendlich', label: 'Mündlich' },
];

const CATEGORY_TITLES: Record<Category, string> = {
  ka: 'KA',
  test: 'Test',
  muendlich: 'Mündlich',
};

export function GradesView({ subjectId, classId }: { subjectId: SubjectId; classId: ClassId }) {
  const { data } = useApp();
  const [tab, setTab] = useState<Tab>('uebersicht');

  const subject = data.subjects[subjectId];
  const schoolClass = data.classes[classId];
  if (!subject || !schoolClass) return null;

  const studentIds = [...schoolClass.studentIds].sort((a, b) =>
    data.students[a].name.localeCompare(data.students[b].name, 'de'),
  );

  return (
    <section className="view">
      <h1 className="view-title">
        {subject.name} · Klasse {schoolClass.name}
      </h1>

      <div className="tabs" role="tablist">
        {TAB_LABELS.map(({ tab: t, label }) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>

      {studentIds.length === 0 ? (
        <p className="empty-hint">
          In dieser Klasse sind noch keine Schüler:innen. Nehmen Sie sie unter „Klassen &amp;
          Fächer“ auf.
        </p>
      ) : tab === 'uebersicht' ? (
        <OverviewTab subjectId={subjectId} classId={classId} studentIds={studentIds} />
      ) : (
        <div className="semester-tables">
          <SemesterTable subjectId={subjectId} classId={classId} semester={1} category={tab} studentIds={studentIds} />
          <SemesterTable subjectId={subjectId} classId={classId} semester={2} category={tab} studentIds={studentIds} />
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------------------
   Übersicht: Jahres- und Halbjahresnoten aller Schüler
   -------------------------------------------------------------------------- */

function OverviewTab({
  subjectId,
  classId,
  studentIds,
}: {
  subjectId: SubjectId;
  classId: ClassId;
  studentIds: StudentId[];
}) {
  const { data } = useApp();
  const summaries = studentIds.map((studentId) => ({
    studentId,
    name: data.students[studentId].name,
    summary: studentSubjectSummary(data, studentId, subjectId, classId),
  }));

  const classYearAverage = averageOf(summaries.map((s) => s.summary.year));
  const classH1Average = averageOf(summaries.map((s) => s.summary.semester1.grade));
  const classH2Average = averageOf(summaries.map((s) => s.summary.semester2.grade));

  return (
    <>
      <div className="stat-row">
        <StatCard label="Klassenschnitt (Jahr)" value={classYearAverage} />
        <StatCard label="Schnitt 1. Halbjahr" value={classH1Average} />
        <StatCard label="Schnitt 2. Halbjahr" value={classH2Average} />
      </div>

      <div className="table-scroll">
        <table className="grades-table overview-table">
          <thead>
            <tr>
              <th className="sticky-col">Name</th>
              <th className="col-strong">Jahr</th>
              <th className="col-strong">1. HJ</th>
              <th>KA</th>
              <th>Tests</th>
              <th>Mündl.</th>
              <th className="col-strong">2. HJ</th>
              <th>KA</th>
              <th>Tests</th>
              <th>Mündl.</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(({ studentId, name, summary }) => (
              <tr key={studentId}>
                <td className="sticky-col">{name}</td>
                <GradeCell value={summary.year} strong />
                <GradeCell value={summary.semester1.grade} strong />
                <GradeCell value={summary.semester1.ka} />
                <GradeCell value={summary.semester1.tests} />
                <GradeCell value={summary.semester1.muendlich} />
                <GradeCell value={summary.semester2.grade} strong />
                <GradeCell value={summary.semester2.ka} />
                <GradeCell value={summary.semester2.tests} />
                <GradeCell value={summary.semester2.muendlich} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function averageOf(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 100) / 100;
}

function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="stat-card">
      <p className={`stat-value${value !== null ? ` band-${gradeBand(value)}` : ''}`}>
        {formatGrade(value)}
      </p>
      <p className="stat-label">{label}</p>
    </div>
  );
}

function GradeCell({ value, strong = false }: { value: number | null; strong?: boolean }) {
  return (
    <td className={`grade-cell${strong ? ' col-strong' : ''}${value !== null ? ` band-${gradeBand(value)}` : ''}`}>
      {formatGrade(value)}
    </td>
  );
}

/* --------------------------------------------------------------------------
   Halbjahres-Tabelle einer Notenart: editierbare Spalten + Noteneingabe
   -------------------------------------------------------------------------- */

function SemesterTable({
  subjectId,
  classId,
  semester,
  category,
  studentIds,
}: {
  subjectId: SubjectId;
  classId: ClassId;
  semester: Semester;
  category: Category;
  studentIds: StudentId[];
}) {
  const { data, dispatch } = useApp();
  const [deleteColumn, setDeleteColumn] = useState<ColumnId | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const columns = columnsFor(data, subjectId, classId, semester, category);

  const addColumn = () => {
    dispatch({
      type: 'column/add',
      id: newId(),
      subjectId,
      classId,
      semester,
      category,
      title: `${CATEGORY_TITLES[category]} ${columns.length + 1}`,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  /** Enter springt zur nächsten, Shift+Enter zur vorherigen Zeile derselben Spalte. */
  const moveFocus = (row: number, columnId: ColumnId, delta: number) => {
    const target = tableRef.current?.querySelector<HTMLInputElement>(
      `input[data-row="${row + delta}"][data-column="${columnId}"]`,
    );
    target?.focus();
    target?.select();
  };

  return (
    <div className="semester-block">
      <div className="semester-header">
        <h2 className="semester-title">{semester}. Halbjahr</h2>
        <button className="button button-small" onClick={addColumn}>
          Spalte hinzufügen
        </button>
      </div>

      <div className="table-scroll">
        <table className="grades-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="sticky-col">Name</th>
              {columns.map(([columnId, column]) => (
                <th key={columnId} className="column-head">
                  <ColumnTitleInput
                    value={column.title}
                    onCommit={(title) => dispatch({ type: 'column/update', id: columnId, title })}
                  />
                  <input
                    type="date"
                    className="column-date"
                    value={column.date ?? ''}
                    onChange={(e) =>
                      dispatch({ type: 'column/update', id: columnId, date: e.target.value || null })
                    }
                  />
                  <button
                    className="column-delete"
                    title="Spalte löschen"
                    aria-label={`Spalte ${column.title} löschen`}
                    onClick={() => setDeleteColumn(columnId)}
                  >
                    ×
                  </button>
                </th>
              ))}
              <th className="col-avg">Ø</th>
              <th className="col-strong">HJ</th>
            </tr>
          </thead>
          <tbody>
            {studentIds.map((studentId, rowIndex) => {
              const categoryAvg = studentCategoryAverage(data, studentId, subjectId, classId, semester, category);
              const summary = studentSubjectSummary(data, studentId, subjectId, classId);
              const semesterGradeValue = semester === 1 ? summary.semester1.grade : summary.semester2.grade;
              return (
                <tr key={studentId}>
                  <td className="sticky-col">{data.students[studentId].name}</td>
                  {columns.map(([columnId]) => (
                    <td key={columnId} className="input-cell">
                      <GradeInput
                        value={data.grades[gradeKey(studentId, columnId)]}
                        row={rowIndex}
                        columnId={columnId}
                        onCommit={(value) =>
                          value === null
                            ? dispatch({ type: 'grade/clear', studentId, columnId })
                            : dispatch({ type: 'grade/set', studentId, columnId, value })
                        }
                        onMove={(delta) => moveFocus(rowIndex, columnId, delta)}
                      />
                    </td>
                  ))}
                  <GradeCell value={categoryAvg} />
                  <GradeCell value={semesterGradeValue} strong />
                </tr>
              );
            })}
          </tbody>
          {columns.length > 0 && (
            <tfoot>
              <tr>
                <td className="sticky-col">Klassenschnitt</td>
                {columns.map(([columnId]) => (
                  <GradeCell key={columnId} value={columnAverage(data, columnId)} />
                ))}
                <td className="grade-cell" />
                <td className="grade-cell col-strong" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {columns.length === 0 && (
        <p className="empty-hint">
          Noch keine Spalte — legen Sie mit „Spalte hinzufügen“ die erste an.
        </p>
      )}

      {deleteColumn && (
        <ConfirmDialog
          title="Spalte löschen"
          message={`Die Spalte „${data.columns[deleteColumn].title}“ wird mit allen eingetragenen Noten endgültig gelöscht.`}
          confirmLabel="Endgültig löschen"
          onCancel={() => setDeleteColumn(null)}
          onConfirm={() => {
            dispatch({ type: 'column/delete', id: deleteColumn });
            setDeleteColumn(null);
          }}
        />
      )}
    </div>
  );
}

/** Spaltentitel: lokal editieren, bei Blur/Enter übernehmen. */
function ColumnTitleInput({ value, onCommit }: { value: string; onCommit: (title: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed !== '' && trimmed !== value) onCommit(trimmed);
    else setText(value);
  };

  return (
    <input
      className="column-title"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

/**
 * Eine Notenzelle: akzeptiert 1–6 mit Komma/Punkt, ungültige Eingaben werden
 * rot markiert und nicht gespeichert. Enter/Shift+Enter wechselt die Zeile.
 */
function GradeInput({
  value,
  row,
  columnId,
  onCommit,
  onMove,
}: {
  value: number | undefined;
  row: number;
  columnId: ColumnId;
  onCommit: (value: number | null) => void;
  onMove: (delta: number) => void;
}) {
  const toText = (v: number | undefined) => (v === undefined ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(toText(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(toText(value));
    setInvalid(false);
  }, [value]);

  const commit = () => {
    if (text.trim() === '') {
      setInvalid(false);
      if (value !== undefined) onCommit(null);
      return;
    }
    const parsed = parseGrade(text);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <input
      className={`grade-input${invalid ? ' is-invalid' : ''}`}
      inputMode="decimal"
      value={text}
      data-row={row}
      data-column={columnId}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
          onMove(e.shiftKey ? -1 : 1);
        }
      }}
    />
  );
}
