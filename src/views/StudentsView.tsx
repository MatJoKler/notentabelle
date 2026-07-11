import { useState } from 'react';
import { StudentDetailModal } from '../components/StudentDetailModal';
import { formatGrade, gradeBand, riskLevel, type RiskLevel } from '../domain/calc';
import { studentOverallAverage } from '../domain/insights';
import type { StudentId } from '../domain/model';
import { useApp } from '../state/AppContext';

const FILTERS: Array<{ key: RiskLevel | 'alle'; label: string }> = [
  { key: 'alle', label: 'Alle' },
  { key: 'gefaehrdet', label: 'Gefährdet (ab 4,5)' },
  { key: 'kritisch', label: 'Kritisch (ab 5,0)' },
];

const RISK_LABEL: Record<RiskLevel, string> = {
  none: '',
  gefaehrdet: 'gefährdet',
  kritisch: 'kritisch',
};

export function StudentsView() {
  const { data } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RiskLevel | 'alle'>('alle');
  const [selected, setSelected] = useState<StudentId | null>(null);

  const students = Object.entries(data.students)
    .map(([studentId, student]) => {
      const overall = studentOverallAverage(data, studentId);
      return {
        studentId,
        name: student.name,
        className: data.classes[student.classId]?.name ?? '',
        overall,
        risk: riskLevel(overall),
        noteCount: (data.notes[studentId] ?? []).length,
      };
    })
    .filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((s) => {
      if (filter === 'alle') return true;
      if (filter === 'gefaehrdet') return s.risk !== 'none';
      return s.risk === 'kritisch';
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  return (
    <section className="view">
      <h1 className="view-title">Schülerakte</h1>

      <div className="students-toolbar">
        <input
          className="input students-search"
          placeholder="Nach Name suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="chip-row">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`chip${filter === key ? ' is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {students.length === 0 ? (
        <p className="empty-hint">Keine Schüler:innen gefunden.</p>
      ) : (
        <div className="card">
          <ul className="ranking-list">
            {students.map((s) => (
              <li key={s.studentId} className="ranking-row">
                <button className="link-button ranking-name" onClick={() => setSelected(s.studentId)}>
                  {s.name} <span className="ranking-class">({s.className})</span>
                  {s.noteCount > 0 && <span className="ranking-class"> · {s.noteCount} Notizen</span>}
                </button>
                <span className="student-row-right">
                  {s.risk !== 'none' && <span className={`risk-badge risk-${s.risk}`}>{RISK_LABEL[s.risk]}</span>}
                  <span className={`ranking-grade${s.overall !== null ? ` band-${gradeBand(s.overall)}` : ''}`}>
                    {formatGrade(s.overall)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selected && <StudentDetailModal studentId={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}
