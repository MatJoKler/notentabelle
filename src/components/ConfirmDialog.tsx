import { Modal } from './Modal';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="modal-message">{message}</p>
      <div className="modal-actions">
        <button className="button" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="button button-danger" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
