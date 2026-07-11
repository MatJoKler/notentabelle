import { useCallback, useEffect, useState } from 'react';
import { emptyAppData } from '../domain/model';
import { schoolYearLabelForDate } from '../domain/schoolYear';
import type { StorageBackend } from '../storage/backend';
import { BrowserBackend } from '../storage/fallback';
import {
  FileFormatError,
  PasswordRequiredError,
  WrongPasswordError,
  openFile,
  serializeFile,
} from '../storage/fileFormat';
import {
  FileBackend,
  createNewDataFile,
  ensureReadWritePermission,
  loadPersistedHandle,
  openExistingDataFile,
  persistHandle,
  supportsFileSystemAccess,
} from '../storage/fileStorage';
import type { Session } from './session';

export type BootstrapState =
  | { phase: 'checking' }
  | { phase: 'start'; persistedName: string | null; fsaSupported: boolean; error: string | null }
  | { phase: 'password'; text: string; backend: StorageBackend; error: string | null }
  | { phase: 'ready'; session: Session };

export interface Bootstrap {
  state: BootstrapState;
  continuePersisted: () => Promise<void>;
  openExisting: () => Promise<void>;
  createNew: () => Promise<void>;
  useBrowser: () => Promise<void>;
  submitPassword: (password: string) => Promise<void>;
}

function initialData() {
  return emptyAppData(schoolYearLabelForDate(new Date()));
}

/** Nutzer hat den Datei-Dialog abgebrochen — kein Fehler. */
function isPickerAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useSessionBootstrap(): Bootstrap {
  const [state, setState] = useState<BootstrapState>({ phase: 'checking' });

  useEffect(() => {
    (async () => {
      let persistedName: string | null = null;
      if (supportsFileSystemAccess()) {
        try {
          persistedName = (await loadPersistedHandle())?.name ?? null;
        } catch {
          persistedName = null;
        }
      }
      setState({ phase: 'start', persistedName, fsaSupported: supportsFileSystemAccess(), error: null });
    })();
  }, []);

  const showStartError = useCallback((message: string) => {
    setState((prev) =>
      prev.phase === 'start' || prev.phase === 'password'
        ? { phase: 'start', persistedName: null, fsaSupported: supportsFileSystemAccess(), error: message }
        : prev,
    );
  }, []);

  const openBackend = useCallback(
    async (backend: StorageBackend) => {
      const text = await backend.read();
      if (text === null) {
        // Neue/leere Quelle: mit frischem Schuljahr starten und sofort speichern
        const data = initialData();
        await backend.write(await serializeFile(data, null));
        setState({ phase: 'ready', session: { backend, data, encryption: null } });
        return;
      }
      try {
        const opened = await openFile(text);
        setState({ phase: 'ready', session: { backend, ...opened } });
      } catch (error) {
        if (error instanceof PasswordRequiredError) {
          setState({ phase: 'password', text, backend, error: null });
        } else if (error instanceof FileFormatError) {
          showStartError('Diese Datei ist keine Notentabelle-Datei.');
        } else {
          throw error;
        }
      }
    },
    [showStartError],
  );

  const continuePersisted = useCallback(async () => {
    const handle = await loadPersistedHandle();
    if (!handle) {
      showStartError('Die zuletzt genutzte Datei wurde nicht gefunden. Bitte neu auswählen.');
      return;
    }
    if (!(await ensureReadWritePermission(handle))) {
      showStartError('Ohne Freigabe kann die Datei nicht genutzt werden. Bitte erneut versuchen.');
      return;
    }
    try {
      await openBackend(new FileBackend(handle));
    } catch {
      showStartError('Die Datei konnte nicht gelesen werden. Bitte neu auswählen.');
    }
  }, [openBackend, showStartError]);

  const openExisting = useCallback(async () => {
    try {
      const handle = await openExistingDataFile();
      if (!(await ensureReadWritePermission(handle))) return;
      await persistHandle(handle);
      await openBackend(new FileBackend(handle));
    } catch (error) {
      if (!isPickerAbort(error)) showStartError('Die Datei konnte nicht geöffnet werden.');
    }
  }, [openBackend, showStartError]);

  const createNew = useCallback(async () => {
    try {
      const handle = await createNewDataFile();
      if (!(await ensureReadWritePermission(handle))) return;
      await persistHandle(handle);
      await openBackend(new FileBackend(handle));
    } catch (error) {
      if (!isPickerAbort(error)) showStartError('Die Datei konnte nicht angelegt werden.');
    }
  }, [openBackend, showStartError]);

  const useBrowser = useCallback(async () => {
    await openBackend(new BrowserBackend());
  }, [openBackend]);

  const submitPassword = useCallback(
    async (password: string) => {
      if (state.phase !== 'password') return;
      try {
        const opened = await openFile(state.text, password);
        setState({ phase: 'ready', session: { backend: state.backend, ...opened } });
      } catch (error) {
        if (error instanceof WrongPasswordError) {
          setState({ ...state, error: 'Das Passwort ist nicht richtig. Bitte erneut eingeben.' });
        } else {
          showStartError('Die Datei konnte nicht entschlüsselt werden.');
        }
      }
    },
    [state, showStartError],
  );

  return { state, continuePersisted, openExisting, createNew, useBrowser, submitPassword };
}
