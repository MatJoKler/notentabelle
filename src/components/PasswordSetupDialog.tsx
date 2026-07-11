import { useState, type FormEvent } from 'react';
import { sha256Hex } from '../storage/crypto';
import { downloadTextFile } from '../storage/fallback';
import { generateRecoveryKey } from '../storage/recoveryKey';
import { useApp } from '../state/AppContext';
import { Modal } from './Modal';

const MIN_LENGTH = 6;

/**
 * Passwortschutz einrichten oder ändern: Passwort zweimal eingeben,
 * danach wird einmalig der Wiederherstellungsschlüssel angezeigt.
 */
export function PasswordSetupDialog({ title, onClose }: { title: string; onClose: () => void }) {
  const { dispatch, setFilePasswords } = useApp();
  const [step, setStep] = useState<'form' | 'recovery'>('form');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_LENGTH) {
      setError(`Das Passwort braucht mindestens ${MIN_LENGTH} Zeichen.`);
      return;
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setBusy(true);
    const key = generateRecoveryKey();
    await setFilePasswords([password, key]);
    dispatch({
      type: 'security/set',
      security: {
        passwordHash: await sha256Hex(password),
        recoveryKeyHash: await sha256Hex(key),
        securityQuestion: null,
        securityAnswerHash: null,
      },
    });
    setRecoveryKey(key);
    setBusy(false);
    setStep('recovery');
  };

  if (step === 'recovery') {
    return (
      <Modal title="Wiederherstellungsschlüssel" onClose={onClose}>
        <p className="modal-message">
          Ihre Datei ist jetzt verschlüsselt. Falls Sie das Passwort vergessen, ist dieser
          Schlüssel der <strong>einzige</strong> Weg an Ihre Noten. Er wird nur dieses eine Mal
          angezeigt — bewahren Sie ihn getrennt vom Passwort auf.
        </p>
        <p className="recovery-key">{recoveryKey}</p>
        <div className="modal-actions">
          <button
            className="button"
            onClick={() =>
              downloadTextFile(
                `Notentabelle – Wiederherstellungsschlüssel\n\n${recoveryKey}\n\nMit diesem Schlüssel lässt sich die Notendatei öffnen, falls das Passwort verloren geht.`,
                'notentabelle-wiederherstellungsschluessel.txt',
              )
            }
          >
            Als Datei speichern
          </button>
          <button className="button button-primary" onClick={onClose}>
            Ich habe den Schlüssel gesichert
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-message">
          Die Notendatei wird mit diesem Passwort verschlüsselt. Beim nächsten Öffnen fragt die
          App danach.
        </p>
        {error && <p className="start-error">{error}</p>}
        <label className="field">
          <span className="field-label">Passwort (mindestens {MIN_LENGTH} Zeichen)</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        <label className="field" style={{ marginTop: '0.75rem' }}>
          <span className="field-label">Passwort wiederholen</span>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="button button-primary" disabled={busy || password === ''}>
            {busy ? 'Verschlüsselt …' : 'Verschlüsseln'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
