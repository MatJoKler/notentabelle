import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

export function TextPromptDialog({
  title,
  label,
  initialValue = '',
  confirmLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed !== '') onSubmit(trimmed);
  };

  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={submit}>
        <label className="field">
          <span className="field-label">{label}</span>
          <input
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="button button-primary" disabled={trimmed === ''}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
