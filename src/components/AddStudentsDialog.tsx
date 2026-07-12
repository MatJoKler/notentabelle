import { useState, type FormEvent } from 'react';
import { parseNameList } from '../domain/names';
import { Modal } from './Modal';

/**
 * Mehrere Schüler:innen auf einmal aufnehmen: ein Name pro Zeile,
 * auch per Copy-Paste aus Excel/Word.
 */
export function AddStudentsDialog({
  className,
  onSubmit,
  onCancel,
}: {
  className: string;
  onSubmit: (names: string[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const names = parseNameList(text);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (names.length > 0) onSubmit(names);
  };

  return (
    <Modal title={`Schüler:innen in ${className} aufnehmen`} onClose={onCancel}>
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">Ein Name pro Zeile — auch Einfügen aus Excel funktioniert</span>
          <textarea
            className="input names-textarea"
            value={text}
            rows={8}
            placeholder={'Anna Beispiel\nBen Muster\nCem Demir'}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="button button-primary" disabled={names.length === 0}>
            {names.length <= 1
              ? 'Aufnehmen'
              : `${names.length} Schüler:innen aufnehmen`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
