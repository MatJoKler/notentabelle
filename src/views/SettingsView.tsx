import { useRef, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ExcelImportDialog } from '../components/ExcelImportDialog';
import { PasswordSetupDialog } from '../components/PasswordSetupDialog';
import { extractExcelData, type ExcelSubjectData } from '../domain/importExcel';
import type { AppData } from '../domain/model';
import { parseXlsx } from '../storage/xlsxParser';
import { exportBackup } from '../export/output';
import { readTextFromFile } from '../storage/fallback';
import {
  FileFormatError,
  PasswordRequiredError,
  WrongPasswordError,
  deserializeFile,
} from '../storage/fileFormat';
import { useApp } from '../state/AppContext';

type ImportState =
  | { step: 'idle' }
  | { step: 'password'; text: string; error: string | null }
  | { step: 'confirm'; data: AppData }
  | { step: 'error'; message: string };

export function SettingsView() {
  const { data, dispatch, sourceKind, sourceLabel, saveNow, encrypted, setFilePasswords } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>({ step: 'idle' });
  const [password, setPassword] = useState('');
  const [passwordDialog, setPasswordDialog] = useState<'setup' | 'change' | 'remove' | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelImport, setExcelImport] = useState<ExcelSubjectData | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);

  const startExcelImport = async (file: File) => {
    setExcelError(null);
    try {
      const workbook = await parseXlsx(await file.arrayBuffer());
      setExcelImport(extractExcelData(workbook));
    } catch (error) {
      setExcelError(
        error instanceof Error && error.message.includes('Vorlage')
          ? error.message
          : 'Die Datei konnte nicht gelesen werden. Bitte eine .xlsx-Datei der Notentabellen-Vorlage wählen.',
      );
    }
  };

  const startImport = async (file: File) => {
    const text = await readTextFromFile(file);
    await tryDeserialize(text, undefined);
  };

  const tryDeserialize = async (text: string, pw: string | undefined) => {
    try {
      const imported = await deserializeFile(text, pw);
      setImportState({ step: 'confirm', data: imported });
    } catch (error) {
      if (error instanceof PasswordRequiredError) {
        setImportState({ step: 'password', text, error: null });
      } else if (error instanceof WrongPasswordError) {
        setImportState({ step: 'password', text, error: 'Das Passwort ist nicht richtig.' });
      } else if (error instanceof FileFormatError) {
        setImportState({ step: 'error', message: 'Diese Datei ist keine Notentabelle-Sicherung.' });
      } else {
        setImportState({ step: 'error', message: 'Die Datei konnte nicht gelesen werden.' });
      }
    }
  };

  return (
    <section className="view">
      <h1 className="view-title">Einstellungen</h1>

      <div className="manage-grid">
        <div className="card">
          <h2 className="card-title">Speicherort</h2>
          <p className="modal-message">
            {sourceKind === 'file' ? (
              <>
                Ihre Daten werden automatisch in der Datei <strong>{sourceLabel}</strong>{' '}
                gespeichert. Liegt die Datei in einem synchronisierten Ordner (z.B. OneDrive),
                sind Ihre Noten zusätzlich gesichert.
              </>
            ) : (
              <>
                Ihre Daten liegen im <strong>Browser-Speicher</strong> dieses Geräts. Bitte
                sichern Sie regelmäßig über „Sicherungskopie herunterladen“ — beim Löschen der
                Browserdaten gehen die Noten sonst verloren.
              </>
            )}
          </p>
          <button className="button" onClick={saveNow}>
            Jetzt speichern
          </button>
        </div>

        <div className="card">
          <h2 className="card-title">Sicherungskopie</h2>
          <p className="modal-message">
            Die Sicherung enthält alle Klassen, Noten, Notizen und Archive als unverschlüsselte
            Datei. Bewahren Sie sie an einem sicheren Ort auf.
          </p>
          <div className="settings-actions">
            <button className="button button-primary" onClick={() => void exportBackup(data)}>
              Sicherungskopie herunterladen
            </button>
            <button className="button" onClick={() => fileInputRef.current?.click()}>
              Sicherung wiederherstellen …
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void startImport(file);
                e.target.value = '';
              }}
            />
          </div>
          <p className="start-hint">
            Auch Exporte der alten Notentabelle (notenrechner-data.json) können wiederhergestellt
            werden — sie werden automatisch ins neue Format übernommen.
          </p>
        </div>

        <div className="card">
          <h2 className="card-title">Excel-Import</h2>
          <p className="modal-message">
            Übernimmt eine ausgefüllte Notentabellen-Vorlage (.xlsx): Schülerliste, Noten mit
            Datum und Gewichtung. Die Datei wird als neues Fach mit neuer Klasse hinzugefügt.
          </p>
          {excelError && <p className="start-error">{excelError}</p>}
          <button className="button" onClick={() => excelInputRef.current?.click()}>
            Excel-Datei wählen …
          </button>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void startExcelImport(file);
              e.target.value = '';
            }}
          />
        </div>

        <div className="card">
          <h2 className="card-title">Passwortschutz</h2>
          {encrypted ? (
            <>
              <p className="modal-message">
                Ihre Notendatei ist <strong>verschlüsselt</strong>. Ohne Passwort oder
                Wiederherstellungsschlüssel kann niemand die Datei lesen.
              </p>
              <div className="settings-actions">
                <button className="button" onClick={() => setPasswordDialog('change')}>
                  Passwort ändern …
                </button>
                <button className="button button-danger" onClick={() => setPasswordDialog('remove')}>
                  Verschlüsselung entfernen
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="modal-message">
                Ihre Notendatei ist derzeit <strong>unverschlüsselt</strong>. Mit einem Passwort
                schützen Sie die Noten, falls andere Zugriff auf den Rechner oder den
                Speicherordner haben.
              </p>
              <button className="button button-primary" onClick={() => setPasswordDialog('setup')}>
                Passwort festlegen …
              </button>
            </>
          )}
        </div>
      </div>

      {excelImport && <ExcelImportDialog excel={excelImport} onClose={() => setExcelImport(null)} />}

      {(passwordDialog === 'setup' || passwordDialog === 'change') && (
        <PasswordSetupDialog
          title={passwordDialog === 'setup' ? 'Passwort festlegen' : 'Passwort ändern'}
          onClose={() => setPasswordDialog(null)}
        />
      )}

      {passwordDialog === 'remove' && (
        <ConfirmDialog
          title="Verschlüsselung entfernen"
          message="Die Notendatei wird ab jetzt unverschlüsselt gespeichert. Jeder mit Zugriff auf die Datei kann die Noten dann lesen."
          confirmLabel="Verschlüsselung entfernen"
          onCancel={() => setPasswordDialog(null)}
          onConfirm={() => {
            void setFilePasswords(null).then(() =>
              dispatch({
                type: 'security/set',
                security: {
                  passwordHash: null,
                  recoveryKeyHash: null,
                  securityQuestion: null,
                  securityAnswerHash: null,
                },
              }),
            );
            setPasswordDialog(null);
          }}
        />
      )}

      {importState.step === 'confirm' && (
        <ConfirmDialog
          title="Sicherung wiederherstellen"
          message={`Alle aktuellen Daten werden durch die Sicherung ersetzt (Schuljahr ${importState.data.schoolYear}, ${Object.keys(importState.data.students).length} Schüler:innen). Dieser Schritt kann nicht rückgängig gemacht werden.`}
          confirmLabel="Wiederherstellen"
          onCancel={() => setImportState({ step: 'idle' })}
          onConfirm={() => {
            dispatch({ type: 'load', data: importState.data });
            setImportState({ step: 'idle' });
          }}
        />
      )}

      {importState.step === 'password' && (
        <ConfirmDialogPassword
          error={importState.error}
          password={password}
          setPassword={setPassword}
          onCancel={() => {
            setImportState({ step: 'idle' });
            setPassword('');
          }}
          onSubmit={() => {
            void tryDeserialize(importState.text, password);
            setPassword('');
          }}
        />
      )}

      {importState.step === 'error' && (
        <ConfirmDialog
          title="Wiederherstellen nicht möglich"
          message={importState.message}
          confirmLabel="Verstanden"
          onCancel={() => setImportState({ step: 'idle' })}
          onConfirm={() => setImportState({ step: 'idle' })}
        />
      )}
    </section>
  );
}

function ConfirmDialogPassword({
  error,
  password,
  setPassword,
  onSubmit,
  onCancel,
}: {
  error: string | null;
  password: string;
  setPassword: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Passwort erforderlich">
        <header className="modal-header">
          <h2 className="modal-title">Passwort erforderlich</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Schließen">
            ×
          </button>
        </header>
        <form
          className="modal-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (password !== '') onSubmit();
          }}
        >
          <p className="modal-message">Diese Sicherung ist passwortgeschützt.</p>
          {error && <p className="start-error">{error}</p>}
          <label className="field">
            <span className="field-label">Passwort</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </label>
          <div className="modal-actions">
            <button type="button" className="button" onClick={onCancel}>
              Abbrechen
            </button>
            <button type="submit" className="button button-primary" disabled={password === ''}>
              Entsperren
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
