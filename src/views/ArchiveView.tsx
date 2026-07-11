import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { formatGrade, gradeBand } from '../domain/calc';
import type { YearSnapshot } from '../domain/model';
import { isGraduating, nextSchoolYearLabel, promoteClassName } from '../domain/schoolYear';
import { studentSubjectSummary } from '../domain/selectors';
import { subjectsForClass } from '../domain/insights';
import { useApp } from '../state/AppContext';
import { nowIso } from '../state/ids';

export function ArchiveView() {
  const { data, dispatch } = useApp();
  const [confirming, setConfirming] = useState(false);

  const classes = Object.values(data.classes).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const graduating = classes.filter((c) => isGraduating(c.name));
  const promoted = classes.filter((c) => !isGraduating(c.name));
  const archiveYears = Object.keys(data.archives).sort().reverse();

  return (
    <section className="view">
      <h1 className="view-title">Archiv</h1>

      <div className="card archive-wizard">
        <h2 className="card-title">Schuljahreswechsel</h2>
        <p className="modal-message">
          Beim Wechsel wird das Schuljahr <strong>{data.schoolYear}</strong> mit allen Noten ins
          Archiv gelegt. Danach beginnt <strong>{nextSchoolYearLabel(data.schoolYear)}</strong> mit
          leeren Notenlisten.
        </p>

        {classes.length > 0 && (
          <ul className="promote-list">
            {promoted.map((c) => (
              <li key={c.name}>
                {c.name} → <strong>{promoteClassName(c.name) ?? c.name}</strong>
                {promoteClassName(c.name) === null && (
                  <span className="ranking-class"> (Name bleibt — kein Stufenmuster erkannt)</span>
                )}
              </li>
            ))}
            {graduating.map((c) => (
              <li key={c.name}>
                {c.name} → <strong>Abschluss</strong>{' '}
                <span className="ranking-class">
                  (wird mit {c.studentIds.length}{' '}
                  {c.studentIds.length === 1 ? 'Schüler:in' : 'Schüler:innen'} entfernt, bleibt im
                  Archiv einsehbar)
                </span>
              </li>
            ))}
          </ul>
        )}

        <button
          className="button button-primary"
          onClick={() => setConfirming(true)}
          disabled={classes.length === 0}
        >
          Schuljahr {data.schoolYear} abschließen
        </button>
        {classes.length === 0 && (
          <p className="empty-hint">Ohne Klassen gibt es nichts abzuschließen.</p>
        )}
      </div>

      <h2 className="archive-heading">Vergangene Schuljahre</h2>
      {archiveYears.length === 0 ? (
        <p className="empty-hint">
          Noch keine archivierten Schuljahre. Nach dem ersten Schuljahreswechsel finden Sie hier
          alle alten Noten — unveränderlich und jederzeit einsehbar.
        </p>
      ) : (
        archiveYears.map((year) => <ArchivedYearCard key={year} year={year} snapshot={data.archives[year]} />)
      )}

      {confirming && (
        <ConfirmDialog
          title="Schuljahr abschließen"
          message={`Das Schuljahr ${data.schoolYear} wird archiviert, alle Klassen werden hochgestuft und die Notenlisten geleert. Dieser Schritt kann nicht rückgängig gemacht werden.`}
          confirmLabel="Jetzt abschließen"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            dispatch({ type: 'year/archive', archivedDate: nowIso() });
            setConfirming(false);
          }}
        />
      )}
    </section>
  );
}

/** Read-only-Ansicht eines archivierten Jahres: je Klasse Schüler × Fächer (Jahresnoten). */
function ArchivedYearCard({ year, snapshot }: { year: string; snapshot: YearSnapshot }) {
  const classes = Object.entries(snapshot.classes).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name, 'de'),
  );

  return (
    <details className="card archive-year">
      <summary className="archive-summary">
        <span className="class-name">Schuljahr {year}</span>
        <span className="class-count">
          {Object.keys(snapshot.students).length} Schüler:innen ·{' '}
          {Object.keys(snapshot.subjects).length} Fächer
        </span>
      </summary>

      {classes.map(([classId, schoolClass]) => {
        const subjects = subjectsForClass(snapshot, classId);
        const studentIds = [...schoolClass.studentIds].sort((a, b) =>
          (snapshot.students[a]?.name ?? '').localeCompare(snapshot.students[b]?.name ?? '', 'de'),
        );
        return (
          <div key={classId} className="archive-class">
            <h3 className="archive-class-title">Klasse {schoolClass.name}</h3>
            {subjects.length === 0 || studentIds.length === 0 ? (
              <p className="empty-hint">Keine Noten erfasst.</p>
            ) : (
              <div className="table-scroll">
                <table className="grades-table">
                  <thead>
                    <tr>
                      <th className="sticky-col">Name</th>
                      {subjects.map(([subjectId, subject]) => (
                        <th key={subjectId}>{subject.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentIds.map((studentId) => (
                      <tr key={studentId}>
                        <td className="sticky-col">{snapshot.students[studentId]?.name}</td>
                        {subjects.map(([subjectId]) => {
                          const year = studentSubjectSummary(snapshot, studentId, subjectId, classId).year;
                          return (
                            <td
                              key={subjectId}
                              className={`grade-cell${year !== null ? ` band-${gradeBand(year)}` : ''}`}
                            >
                              {formatGrade(year)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </details>
  );
}
