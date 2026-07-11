import { average, formatGrade, gradeBand, type GradeBand } from '../domain/calc';
import { gradeDistribution, studentRanking } from '../domain/insights';
import { useApp } from '../state/AppContext';
import type { View } from '../state/navigation';

const BAND_LABELS: Array<{ band: GradeBand; label: string }> = [
  { band: 'sehr-gut', label: 'sehr gut (bis 1,9)' },
  { band: 'gut', label: 'gut (2,0–2,9)' },
  { band: 'befriedigend', label: 'befriedigend (3,0–3,9)' },
  { band: 'schlecht', label: 'ausreichend u. schlechter (ab 4,0)' },
];

export function DashboardView({ setView }: { setView: (v: View) => void }) {
  const { data } = useApp();

  const classCount = Object.keys(data.classes).length;
  const subjectCount = Object.keys(data.subjects).length;
  const studentCount = Object.keys(data.students).length;

  if (studentCount === 0 || subjectCount === 0) {
    return (
      <section className="view">
        <h1 className="view-title">Übersicht</h1>
        <div className="card">
          <h2 className="card-title">Willkommen!</h2>
          <p className="modal-message">
            Legen Sie zuerst unter „Klassen &amp; Fächer“ Ihre Klassen, Schüler:innen und Fächer
            an. Danach erscheinen hier Ihre Statistiken.
          </p>
          <button className="button button-primary" onClick={() => setView({ name: 'classes' })}>
            Zu Klassen &amp; Fächer
          </button>
        </div>
      </section>
    );
  }

  const ranking = studentRanking(data);
  const overall = average(ranking.map((r) => r.average));
  const distribution = gradeDistribution(data);
  const distributionTotal = Object.values(distribution).reduce((a, b) => a + b, 0);
  const top = ranking.slice(0, 3);
  const flop = [...ranking].reverse().slice(0, 3).filter((r) => r.average >= 3);

  return (
    <section className="view">
      <h1 className="view-title">Übersicht</h1>

      <div className="stat-row">
        <div className="stat-card">
          <p className="stat-value">{classCount}</p>
          <p className="stat-label">{classCount === 1 ? 'Klasse' : 'Klassen'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{subjectCount}</p>
          <p className="stat-label">{subjectCount === 1 ? 'Fach' : 'Fächer'}</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{studentCount}</p>
          <p className="stat-label">Schüler:innen</p>
        </div>
        <div className="stat-card">
          <p className={`stat-value${overall !== null ? ` band-${gradeBand(overall)}` : ''}`}>
            {formatGrade(overall)}
          </p>
          <p className="stat-label">Gesamtschnitt</p>
        </div>
      </div>

      <div className="manage-grid">
        <div className="card">
          <h2 className="card-title">Beste Schnitte</h2>
          <RankingList entries={top} />
        </div>

        <div className="card">
          <h2 className="card-title">Förderbedarf</h2>
          {flop.length === 0 ? (
            <p className="empty-hint">Aktuell hat niemand einen Schnitt ab 3,0 — sehr gut!</p>
          ) : (
            <RankingList entries={flop} />
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Notenverteilung</h2>
          {distributionTotal === 0 ? (
            <p className="empty-hint">Noch keine Jahresnoten vorhanden.</p>
          ) : (
            <div className="distribution">
              {BAND_LABELS.map(({ band, label }) => (
                <div key={band} className="distribution-row">
                  <span className="distribution-label">{label}</span>
                  <span className="distribution-track">
                    <span
                      className={`distribution-bar distribution-${band}`}
                      style={{ width: `${(distribution[band] / distributionTotal) * 100}%` }}
                    />
                  </span>
                  <span className="distribution-count">{distribution[band]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RankingList({ entries }: { entries: Array<{ studentId: string; average: number }> }) {
  const { data } = useApp();
  if (entries.length === 0) return <p className="empty-hint">Noch keine Noten vorhanden.</p>;
  return (
    <ol className="ranking-list">
      {entries.map(({ studentId, average: avg }) => {
        const student = data.students[studentId];
        const className = data.classes[student.classId]?.name ?? '';
        return (
          <li key={studentId} className="ranking-row">
            <span className="ranking-name">
              {student.name} <span className="ranking-class">({className})</span>
            </span>
            <span className={`ranking-grade band-${gradeBand(avg)}`}>{formatGrade(avg)}</span>
          </li>
        );
      })}
    </ol>
  );
}
