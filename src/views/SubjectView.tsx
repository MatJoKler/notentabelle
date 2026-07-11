import { average, formatGrade, gradeBand } from '../domain/calc';
import { classSubjectAverage } from '../domain/insights';
import type { SubjectId } from '../domain/model';
import { studentSubjectSummary } from '../domain/selectors';
import { useApp } from '../state/AppContext';
import type { View } from '../state/navigation';

export function SubjectView({ subjectId, setView }: { subjectId: SubjectId; setView: (v: View) => void }) {
  const { data } = useApp();
  const subject = data.subjects[subjectId];
  if (!subject) return null;

  const classEntries = subject.assignedClassIds
    .filter((classId) => data.classes[classId])
    .map((classId) => ({
      classId,
      name: data.classes[classId].name,
      average: classSubjectAverage(data, subjectId, classId),
      studentCount: data.classes[classId].studentIds.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const subjectAverage = average(
    classEntries.map((c) => c.average).filter((v): v is number => v !== null),
  );

  const studentResults = classEntries
    .flatMap(({ classId }) =>
      data.classes[classId].studentIds.map((studentId) => ({
        studentId,
        classId,
        year: studentSubjectSummary(data, studentId, subjectId, classId).year,
      })),
    )
    .filter((r): r is typeof r & { year: number } => r.year !== null)
    .sort((a, b) => a.year - b.year);

  const top = studentResults.slice(0, 3);
  const flop = [...studentResults].reverse().slice(0, 3).filter((r) => r.year >= 3);

  return (
    <section className="view">
      <h1 className="view-title">{subject.name}</h1>

      {classEntries.length === 0 ? (
        <div className="card">
          <p className="modal-message">
            Diesem Fach ist noch keine Klasse zugeordnet. Ordnen Sie unter „Klassen &amp; Fächer“
            eine Klasse zu, um Noten einzutragen.
          </p>
          <button className="button button-primary" onClick={() => setView({ name: 'classes' })}>
            Zu Klassen &amp; Fächer
          </button>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat-card">
              <p className={`stat-value${subjectAverage !== null ? ` band-${gradeBand(subjectAverage)}` : ''}`}>
                {formatGrade(subjectAverage)}
              </p>
              <p className="stat-label">Fachschnitt (alle Klassen)</p>
            </div>
            <div className="stat-card">
              <p className="stat-value">{classEntries.length}</p>
              <p className="stat-label">{classEntries.length === 1 ? 'Klasse' : 'Klassen'}</p>
            </div>
          </div>

          <div className="manage-grid">
            <div className="card">
              <h2 className="card-title">Klassen</h2>
              <ul className="ranking-list">
                {classEntries.map(({ classId, name, average: avg, studentCount }) => (
                  <li key={classId} className="ranking-row">
                    <button
                      className="link-button ranking-name"
                      onClick={() => setView({ name: 'grades', subjectId, classId })}
                    >
                      Klasse {name}{' '}
                      <span className="ranking-class">
                        ({studentCount} {studentCount === 1 ? 'Schüler:in' : 'Schüler:innen'})
                      </span>
                    </button>
                    <span className={`ranking-grade${avg !== null ? ` band-${gradeBand(avg)}` : ''}`}>
                      {formatGrade(avg)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2 className="card-title">Beste im Fach</h2>
              <SubjectRanking entries={top} />
            </div>

            <div className="card">
              <h2 className="card-title">Förderbedarf im Fach</h2>
              {flop.length === 0 ? (
                <p className="empty-hint">Niemand steht schlechter als 3,0.</p>
              ) : (
                <SubjectRanking entries={flop} />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SubjectRanking({
  entries,
}: {
  entries: Array<{ studentId: string; classId: string; year: number }>;
}) {
  const { data } = useApp();
  if (entries.length === 0) return <p className="empty-hint">Noch keine Jahresnoten.</p>;
  return (
    <ol className="ranking-list">
      {entries.map(({ studentId, classId, year }) => (
        <li key={studentId} className="ranking-row">
          <span className="ranking-name">
            {data.students[studentId].name}{' '}
            <span className="ranking-class">({data.classes[classId].name})</span>
          </span>
          <span className={`ranking-grade band-${gradeBand(year)}`}>{formatGrade(year)}</span>
        </li>
      ))}
    </ol>
  );
}
