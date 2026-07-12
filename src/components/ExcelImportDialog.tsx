import { useState, type FormEvent } from 'react';
import { mergeExcelImport, type ExcelSubjectData } from '../domain/importExcel';
import { useApp } from '../state/AppContext';
import { Modal } from './Modal';

/**
 * Vorschau + Bestätigung für den Excel-Import: Fachname (aus der Datei
 * vorbelegt) und Klassenname (steht nicht in der Vorlage) werden abgefragt,
 * dann wird das Fach samt Klasse zu den bestehenden Daten hinzugefügt.
 */
export function ExcelImportDialog({ excel, onClose }: { excel: ExcelSubjectData; onClose: () => void }) {
  const { data, dispatch } = useApp();
  const [subjectName, setSubjectName] = useState(excel.subjectName ?? '');
  const [className, setClassName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const gradeCount = excel.columns.reduce((sum, c) => sum + c.grades.length, 0);
  const ready = subjectName.trim() !== '' && className.trim() !== '' && excel.students.length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    try {
      const merged = mergeExcelImport(data, excel, { className, subjectName });
      dispatch({ type: 'load', data: merged });
      onClose();
    } catch (mergeError) {
      setError(mergeError instanceof Error ? mergeError.message : 'Import fehlgeschlagen.');
    }
  };

  return (
    <Modal title="Excel-Tabelle importieren" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-message">
          Gefunden: <strong>{excel.students.length} Schüler:innen</strong>,{' '}
          <strong>{excel.columns.length} Notenspalten</strong> mit{' '}
          <strong>{gradeCount} Noten</strong>
          {excel.schoolYear && <> (Schuljahr {excel.schoolYear})</>}. Die Daten werden als neues
          Fach mit neuer Klasse hinzugefügt — Ihre bestehenden Einträge bleiben unverändert.
        </p>

        {excel.students.length === 0 && (
          <p className="start-error">
            In der Datei sind keine Schüler:innen eingetragen (Blatt „Einstellungen“).
          </p>
        )}
        {error && <p className="start-error">{error}</p>}

        <label className="field">
          <span className="field-label">Fach</span>
          <input
            className="input"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="z.B. Mathematik"
            autoFocus={excel.subjectName === null}
          />
        </label>
        <label className="field" style={{ marginTop: '0.75rem' }}>
          <span className="field-label">Name der Klasse (z.B. 8c)</span>
          <input
            className="input"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            autoFocus={excel.subjectName !== null}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="button button-primary" disabled={!ready}>
            Importieren
          </button>
        </div>
      </form>
    </Modal>
  );
}
