import { useState, type FormEvent } from 'react';
import {
  mergeExcelImport,
  mergeExcelImportIntoArchive,
  type ExcelSubjectData,
} from '../domain/importExcel';
import { useApp } from '../state/AppContext';
import { nowIso } from '../state/ids';
import { Modal } from './Modal';

const OTHER = '__other__';

/**
 * Vorschau + Bestätigung für den Excel-Import. Neben Fach- und Klassenname
 * wird das Ziel-Schuljahr gewählt: das aktuelle Jahr oder ein (ggf. neues)
 * Archivjahr — vorbelegt aus dem Schuljahr in der Excel-Datei.
 */
export function ExcelImportDialog({ excel, onClose }: { excel: ExcelSubjectData; onClose: () => void }) {
  const { data, dispatch } = useApp();
  const [subjectName, setSubjectName] = useState(excel.subjectName ?? '');
  const [className, setClassName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const archiveYears = Object.keys(data.archives).sort().reverse();
  const knownYears = [data.schoolYear, ...archiveYears];
  const excelYear = excel.schoolYear;
  const [yearChoice, setYearChoice] = useState<string>(() => {
    if (excelYear === null || excelYear === data.schoolYear) return data.schoolYear;
    return knownYears.includes(excelYear) ? excelYear : OTHER;
  });
  const [customYear, setCustomYear] = useState(
    excelYear !== null && !knownYears.includes(excelYear) ? excelYear : '',
  );

  const targetYear = yearChoice === OTHER ? customYear.trim() : yearChoice;
  const intoArchive = targetYear !== data.schoolYear;
  const gradeCount = excel.columns.reduce((sum, c) => sum + c.grades.length, 0);
  const ready =
    subjectName.trim() !== '' && className.trim() !== '' && targetYear !== '' && excel.students.length > 0;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    try {
      const options = { className, subjectName };
      const merged = intoArchive
        ? mergeExcelImportIntoArchive(data, excel, {
            ...options,
            schoolYear: targetYear,
            archivedDate: nowIso(),
          })
        : mergeExcelImport(data, excel, options);
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
          {excelYear && <> (Schuljahr laut Datei: {excelYear})</>}. Ihre bestehenden Einträge
          bleiben unverändert.
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
          />
        </label>
        <label className="field" style={{ marginTop: '0.75rem' }}>
          <span className="field-label">Name der Klasse (z.B. 8c)</span>
          <input className="input" value={className} onChange={(e) => setClassName(e.target.value)} />
        </label>

        <label className="field" style={{ marginTop: '0.75rem' }}>
          <span className="field-label">Schuljahr</span>
          <select className="input" value={yearChoice} onChange={(e) => setYearChoice(e.target.value)}>
            <option value={data.schoolYear}>{data.schoolYear} — aktuelles Schuljahr</option>
            {archiveYears.map((year) => (
              <option key={year} value={year}>
                {year} — Archiv
              </option>
            ))}
            <option value={OTHER}>Anderes Schuljahr (Archiv) …</option>
          </select>
        </label>
        {yearChoice === OTHER && (
          <label className="field" style={{ marginTop: '0.75rem' }}>
            <span className="field-label">Schuljahr eintragen (z.B. 2024/25)</span>
            <input
              className="input"
              value={customYear}
              onChange={(e) => setCustomYear(e.target.value)}
              placeholder="2024/25"
            />
          </label>
        )}
        {intoArchive && targetYear !== '' && (
          <p className="start-hint">
            Der Import landet im Archiv unter {targetYear} — einsehbar unter „Archiv“, aber nicht
            mehr bearbeitbar.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="button button-primary" disabled={!ready}>
            {intoArchive && targetYear !== '' ? `In Archiv ${targetYear} importieren` : 'Importieren'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
