import { useState } from 'react';
import { useApp } from '../state/AppContext';
import type { View } from '../state/navigation';
import { ArchiveView } from '../views/ArchiveView';
import { ClassesView } from '../views/ClassesView';
import { DashboardView } from '../views/DashboardView';
import { GradesView } from '../views/GradesView';
import { SettingsView } from '../views/SettingsView';
import { StudentsView } from '../views/StudentsView';
import { SubjectView } from '../views/SubjectView';

const SAVE_LABEL: Record<string, string> = {
  idle: 'Alles gespeichert',
  saving: 'Speichert …',
  saved: 'Alles gespeichert',
  error: 'Speichern fehlgeschlagen!',
};

export function Shell() {
  const { data, saveStatus, sourceLabel } = useApp();
  const [view, setView] = useState<View>({ name: 'dashboard' });

  const subjects = Object.entries(data.subjects).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name, 'de'),
  );

  const isActive = (check: (v: View) => boolean) => (check(view) ? ' is-active' : '');

  return (
    <div className="shell">
      <aside className="sidebar">
        <header className="sidebar-header">
          <p className="sidebar-brand">Notentabelle</p>
          <p className="sidebar-year">Schuljahr {data.schoolYear}</p>
        </header>

        <nav className="sidebar-nav">
          <button
            className={`nav-item${isActive((v) => v.name === 'dashboard')}`}
            onClick={() => setView({ name: 'dashboard' })}
          >
            Übersicht
          </button>

          <p className="nav-section">Fächer</p>
          {subjects.length === 0 && <p className="nav-empty">Noch keine Fächer angelegt</p>}
          {subjects.map(([subjectId, subject]) => (
            <div key={subjectId} className="nav-subject">
              <button
                className={`nav-item${isActive((v) => v.name === 'subject' && v.subjectId === subjectId)}`}
                onClick={() => setView({ name: 'subject', subjectId })}
              >
                {subject.name}
              </button>
              {subject.assignedClassIds
                .filter((classId) => data.classes[classId])
                .sort((a, b) => data.classes[a].name.localeCompare(data.classes[b].name, 'de'))
                .map((classId) => (
                  <button
                    key={classId}
                    className={`nav-item nav-item-class${isActive(
                      (v) => v.name === 'grades' && v.subjectId === subjectId && v.classId === classId,
                    )}`}
                    onClick={() => setView({ name: 'grades', subjectId, classId })}
                  >
                    {data.classes[classId].name}
                  </button>
                ))}
            </div>
          ))}

          <p className="nav-section">Verwaltung</p>
          <button
            className={`nav-item${isActive((v) => v.name === 'classes')}`}
            onClick={() => setView({ name: 'classes' })}
          >
            Klassen &amp; Fächer
          </button>
          <button
            className={`nav-item${isActive((v) => v.name === 'students')}`}
            onClick={() => setView({ name: 'students' })}
          >
            Schülerakte
          </button>
          <button
            className={`nav-item${isActive((v) => v.name === 'archive')}`}
            onClick={() => setView({ name: 'archive' })}
          >
            Archiv
          </button>
          <button
            className={`nav-item${isActive((v) => v.name === 'settings')}`}
            onClick={() => setView({ name: 'settings' })}
          >
            Einstellungen
          </button>
        </nav>

        <footer className="sidebar-footer">
          <p className={`save-status save-status-${saveStatus}`}>{SAVE_LABEL[saveStatus]}</p>
          <p className="save-source" title={sourceLabel}>
            {sourceLabel}
          </p>
        </footer>
      </aside>

      <main className="main">{renderView(view, setView)}</main>
    </div>
  );
}

function renderView(view: View, setView: (v: View) => void) {
  switch (view.name) {
    case 'dashboard':
      return <DashboardView setView={setView} />;
    case 'subject':
      return <SubjectView subjectId={view.subjectId} setView={setView} />;
    case 'grades':
      return <GradesView subjectId={view.subjectId} classId={view.classId} />;
    case 'classes':
      return <ClassesView />;
    case 'students':
      return <StudentsView />;
    case 'archive':
      return <ArchiveView />;
    case 'settings':
      return <SettingsView />;
  }
}
