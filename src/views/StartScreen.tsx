import { useState, type FormEvent } from 'react';
import type { Bootstrap } from '../state/useSessionBootstrap';

/**
 * Erster Bildschirm: Datenquelle wählen. In Browsern ohne File System Access API
 * (Firefox/Safari) wird der Browser-Speicher mit Export-Hinweis angeboten.
 */
export function StartScreen({ bootstrap }: { bootstrap: Bootstrap }) {
  const { state } = bootstrap;
  if (state.phase === 'checking') return <div className="start" />;

  if (state.phase === 'password') {
    return <PasswordPrompt bootstrap={bootstrap} error={state.error} />;
  }
  if (state.phase !== 'start') return null;

  return (
    <div className="start">
      <div className="start-card">
        <p className="start-brand">Notentabelle</p>
        <h1 className="start-title">Ihr digitales Notenheft</h1>
        <p className="start-lead">
          Alle Noten bleiben in einer Datei auf Ihrem eigenen Gerät — nichts wird ins Internet
          übertragen.
        </p>

        {state.error && <p className="start-error">{state.error}</p>}

        {state.fsaSupported ? (
          <div className="start-actions">
            {state.persistedName && (
              <button className="button button-primary" onClick={bootstrap.continuePersisted}>
                Weiter mit „{state.persistedName}“
              </button>
            )}
            <button
              className={`button ${state.persistedName ? '' : 'button-primary'}`}
              onClick={bootstrap.createNew}
            >
              Neue Notendatei anlegen
            </button>
            <button className="button" onClick={bootstrap.openExisting}>
              Vorhandene Notendatei öffnen
            </button>
          </div>
        ) : (
          <div className="start-actions">
            <button className="button button-primary" onClick={bootstrap.useBrowser}>
              Im Browser starten
            </button>
            <p className="start-hint">
              Dieser Browser kann Dateien nicht direkt speichern. Ihre Daten liegen im
              Browser-Speicher — sichern Sie sie regelmäßig über „Exportieren“ in den
              Einstellungen. Für automatisches Speichern in eine Datei empfehlen wir Chrome oder
              Edge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordPrompt({ bootstrap, error }: { bootstrap: Bootstrap; error: string | null }) {
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== '') void bootstrap.submitPassword(password);
  };

  return (
    <div className="start">
      <form className="start-card" onSubmit={submit}>
        <p className="start-brand">Notentabelle</p>
        <h1 className="start-title">Datei entsperren</h1>
        <p className="start-lead">
          Diese Notendatei ist passwortgeschützt. Sie können auch Ihren
          Wiederherstellungsschlüssel (XXXX-XXXX-XXXX-XXXX) eingeben.
        </p>
        {error && <p className="start-error">{error}</p>}
        <label className="field">
          <span className="field-label">Passwort oder Wiederherstellungsschlüssel</span>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </label>
        <div className="start-actions">
          <button type="submit" className="button button-primary" disabled={password === ''}>
            Entsperren
          </button>
        </div>
      </form>
    </div>
  );
}
