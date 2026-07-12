import { useState } from 'react';
import { AddStudentsDialog } from '../components/AddStudentsDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TextPromptDialog } from '../components/TextPromptDialog';
import type { ClassId, StudentId, SubjectId } from '../domain/model';
import { useApp } from '../state/AppContext';
import { newId, nowIso } from '../state/ids';
import { SubjectWeightsEditor } from './SubjectWeightsEditor';

type Dialog =
  | { kind: 'addClass' }
  | { kind: 'renameClass'; id: ClassId }
  | { kind: 'deleteClass'; id: ClassId }
  | { kind: 'addStudent'; classId: ClassId }
  | { kind: 'renameStudent'; id: StudentId }
  | { kind: 'deleteStudent'; id: StudentId }
  | { kind: 'addSubject' }
  | { kind: 'renameSubject'; id: SubjectId }
  | { kind: 'deleteSubject'; id: SubjectId }
  | null;

export function ClassesView() {
  const { data, dispatch } = useApp();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);

  const classes = Object.entries(data.classes).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name, 'de'),
  );
  const subjects = Object.entries(data.subjects).sort(([, a], [, b]) =>
    a.name.localeCompare(b.name, 'de'),
  );

  return (
    <section className="view">
      <h1 className="view-title">Klassen &amp; Fächer</h1>

      <div className="manage-grid">
        <div className="card">
          <header className="card-header">
            <h2 className="card-title">Klassen</h2>
            <button className="button button-primary" onClick={() => setDialog({ kind: 'addClass' })}>
              Klasse anlegen
            </button>
          </header>

          {classes.length === 0 && (
            <p className="empty-hint">
              Noch keine Klassen. Legen Sie Ihre erste Klasse an, z.B. „8c“.
            </p>
          )}

          {classes.map(([classId, schoolClass]) => (
            <details key={classId} className="class-item" open={classes.length <= 3}>
              <summary className="class-summary">
                <span className="class-name">{schoolClass.name}</span>
                <span className="class-count">
                  {schoolClass.studentIds.length}{' '}
                  {schoolClass.studentIds.length === 1 ? 'Schüler:in' : 'Schüler:innen'}
                </span>
                <span className="row-actions">
                  <button
                    className="link-button"
                    onClick={(e) => {
                      e.preventDefault();
                      setDialog({ kind: 'renameClass', id: classId });
                    }}
                  >
                    Umbenennen
                  </button>
                  <button
                    className="link-button link-danger"
                    onClick={(e) => {
                      e.preventDefault();
                      setDialog({ kind: 'deleteClass', id: classId });
                    }}
                  >
                    Löschen
                  </button>
                </span>
              </summary>

              <ul className="student-list">
                {[...schoolClass.studentIds]
                  .sort((a, b) => data.students[a].name.localeCompare(data.students[b].name, 'de'))
                  .map((studentId) => (
                    <li key={studentId} className="student-row">
                      <span className="student-name">{data.students[studentId].name}</span>
                      <span className="row-actions">
                        {classes.length > 1 && (
                          <select
                            className="move-select"
                            value=""
                            title="In andere Klasse verschieben"
                            onChange={(e) => {
                              if (e.target.value) {
                                dispatch({
                                  type: 'student/move',
                                  id: studentId,
                                  toClassId: e.target.value,
                                  noteId: newId(),
                                  timestamp: nowIso(),
                                });
                              }
                            }}
                          >
                            <option value="">Verschieben …</option>
                            {classes
                              .filter(([otherId]) => otherId !== classId)
                              .map(([otherId, other]) => (
                                <option key={otherId} value={otherId}>
                                  nach {other.name}
                                </option>
                              ))}
                          </select>
                        )}
                        <button
                          className="link-button"
                          onClick={() => setDialog({ kind: 'renameStudent', id: studentId })}
                        >
                          Umbenennen
                        </button>
                        <button
                          className="link-button link-danger"
                          onClick={() => setDialog({ kind: 'deleteStudent', id: studentId })}
                        >
                          Löschen
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
              <button
                className="button button-small"
                onClick={() => setDialog({ kind: 'addStudent', classId })}
              >
                Schüler:innen hinzufügen
              </button>
            </details>
          ))}
        </div>

        <div className="card">
          <header className="card-header">
            <h2 className="card-title">Fächer</h2>
            <button className="button button-primary" onClick={() => setDialog({ kind: 'addSubject' })}>
              Fach anlegen
            </button>
          </header>

          {subjects.length === 0 && (
            <p className="empty-hint">Noch keine Fächer. Legen Sie Ihr erstes Fach an, z.B. „Mathematik“.</p>
          )}

          {subjects.map(([subjectId, subject]) => (
            <details key={subjectId} className="class-item" open={subjects.length <= 3}>
              <summary className="class-summary">
                <span className="class-name">{subject.name}</span>
                <span className="class-count">
                  {subject.assignedClassIds.length}{' '}
                  {subject.assignedClassIds.length === 1 ? 'Klasse' : 'Klassen'}
                </span>
                <span className="row-actions">
                  <button
                    className="link-button"
                    onClick={(e) => {
                      e.preventDefault();
                      setDialog({ kind: 'renameSubject', id: subjectId });
                    }}
                  >
                    Umbenennen
                  </button>
                  <button
                    className="link-button link-danger"
                    onClick={(e) => {
                      e.preventDefault();
                      setDialog({ kind: 'deleteSubject', id: subjectId });
                    }}
                  >
                    Löschen
                  </button>
                </span>
              </summary>

              <div className="subject-detail">
                <p className="detail-label">Unterrichtete Klassen</p>
                {classes.length === 0 ? (
                  <p className="empty-hint">Legen Sie zuerst eine Klasse an.</p>
                ) : (
                  <div className="checkbox-row">
                    {classes.map(([classId, schoolClass]) => (
                      <label key={classId} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={subject.assignedClassIds.includes(classId)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...subject.assignedClassIds, classId]
                              : subject.assignedClassIds.filter((id) => id !== classId);
                            dispatch({ type: 'subject/setAssignedClasses', id: subjectId, classIds: next });
                          }}
                        />
                        {schoolClass.name}
                      </label>
                    ))}
                  </div>
                )}

                <p className="detail-label">Gewichtung der Halbjahresnote</p>
                <SubjectWeightsEditor subjectId={subjectId} />
              </div>
            </details>
          ))}
        </div>
      </div>

      {renderDialog(dialog, close)}
    </section>
  );
}

function renderDialog(dialog: Dialog, close: () => void) {
  return dialog && <DialogHost dialog={dialog} close={close} />;
}

function DialogHost({ dialog, close }: { dialog: NonNullable<Dialog>; close: () => void }) {
  const { data, dispatch } = useApp();

  switch (dialog.kind) {
    case 'addClass':
      return (
        <TextPromptDialog
          title="Klasse anlegen"
          label="Name der Klasse (z.B. 8c)"
          confirmLabel="Anlegen"
          onCancel={close}
          onSubmit={(name) => {
            dispatch({ type: 'class/add', id: newId(), name });
            close();
          }}
        />
      );
    case 'renameClass':
      return (
        <TextPromptDialog
          title="Klasse umbenennen"
          label="Neuer Name"
          initialValue={data.classes[dialog.id].name}
          confirmLabel="Umbenennen"
          onCancel={close}
          onSubmit={(name) => {
            dispatch({ type: 'class/rename', id: dialog.id, name });
            close();
          }}
        />
      );
    case 'deleteClass':
      return (
        <ConfirmDialog
          title="Klasse löschen"
          message={`Die Klasse ${data.classes[dialog.id].name} wird mit allen ${data.classes[dialog.id].studentIds.length} Schüler:innen und deren Noten endgültig gelöscht.`}
          confirmLabel="Endgültig löschen"
          onCancel={close}
          onConfirm={() => {
            dispatch({ type: 'class/delete', id: dialog.id });
            close();
          }}
        />
      );
    case 'addStudent':
      return (
        <AddStudentsDialog
          className={data.classes[dialog.classId].name}
          onCancel={close}
          onSubmit={(names) => {
            for (const name of names) {
              dispatch({ type: 'student/add', id: newId(), classId: dialog.classId, name });
            }
            close();
          }}
        />
      );
    case 'renameStudent':
      return (
        <TextPromptDialog
          title="Schüler:in umbenennen"
          label="Neuer Name"
          initialValue={data.students[dialog.id].name}
          confirmLabel="Umbenennen"
          onCancel={close}
          onSubmit={(name) => {
            dispatch({ type: 'student/rename', id: dialog.id, name });
            close();
          }}
        />
      );
    case 'deleteStudent':
      return (
        <ConfirmDialog
          title="Schüler:in löschen"
          message={`${data.students[dialog.id].name} wird mit allen Noten und Notizen endgültig gelöscht. Für einen Klassenwechsel nutzen Sie stattdessen „Verschieben“.`}
          confirmLabel="Endgültig löschen"
          onCancel={close}
          onConfirm={() => {
            dispatch({ type: 'student/delete', id: dialog.id });
            close();
          }}
        />
      );
    case 'addSubject':
      return (
        <TextPromptDialog
          title="Fach anlegen"
          label="Name des Fachs (z.B. Mathematik)"
          confirmLabel="Anlegen"
          onCancel={close}
          onSubmit={(name) => {
            dispatch({ type: 'subject/add', id: newId(), name });
            close();
          }}
        />
      );
    case 'renameSubject':
      return (
        <TextPromptDialog
          title="Fach umbenennen"
          label="Neuer Name"
          initialValue={data.subjects[dialog.id].name}
          confirmLabel="Umbenennen"
          onCancel={close}
          onSubmit={(name) => {
            dispatch({ type: 'subject/rename', id: dialog.id, name });
            close();
          }}
        />
      );
    case 'deleteSubject':
      return (
        <ConfirmDialog
          title="Fach löschen"
          message={`Das Fach ${data.subjects[dialog.id].name} wird mit allen zugehörigen Noten endgültig gelöscht.`}
          confirmLabel="Endgültig löschen"
          onCancel={close}
          onConfirm={() => {
            dispatch({ type: 'subject/delete', id: dialog.id });
            close();
          }}
        />
      );
  }
}
