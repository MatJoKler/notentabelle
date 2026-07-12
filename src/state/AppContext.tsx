import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData } from '../domain/model';
import { newEncryptionContext } from '../storage/crypto';
import { debounce } from '../storage/debounce';
import { serializeFile } from '../storage/fileFormat';
import { appReducer, type Action } from './appReducer';
import type { SaveStatus, Session } from './session';

interface AppContextValue {
  data: AppData;
  dispatch: (action: Action) => void;
  saveStatus: SaveStatus;
  /** Art und Name der Datenquelle, z.B. 'file' / "notentabelle.json". */
  sourceKind: 'file' | 'browser';
  sourceLabel: string;
  /** true, wenn die Datei aktuell verschlüsselt gespeichert wird. */
  encrypted: boolean;
  /** Aktuellen Stand sofort speichern (z.B. vor Export/Schließen). */
  saveNow: () => void;
  /** Verschlüsselung neu setzen: Passwörter (z.B. [Passwort, Recovery-Key]) oder null. */
  setFilePasswords: (passwords: string[] | null) => Promise<void>;
  /** Letzte Änderung zurücknehmen; false-Wert = nichts zum Zurücknehmen. */
  undo: () => void;
  canUndo: boolean;
}

/** Mehr hilft selten — und jeder Eintrag ist ein kompletter Datenstand. */
const UNDO_LIMIT = 50;

const AppContext = createContext<AppContextValue | null>(null);

const AUTOSAVE_DELAY_MS = 1000;

export function AppProvider({ session, children }: { session: Session; children: ReactNode }) {
  // Kein useReducer: dispatch pflegt zusätzlich den Undo-Stapel
  const [data, setData] = useState(session.data);
  const historyRef = useRef<AppData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [encrypted, setEncrypted] = useState(session.encryption !== null);
  const encryptionRef = useRef(session.encryption);
  const isFirstRender = useRef(true);

  const dispatch = useCallback((action: Action) => {
    setData((current) => {
      const next = appReducer(current, action);
      if (next !== current) {
        historyRef.current = [...historyRef.current.slice(-(UNDO_LIMIT - 1)), current];
        setCanUndo(true);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (previous === undefined) return;
    setCanUndo(historyRef.current.length > 0);
    setData(previous);
  }, []);

  const writeNow = useCallback(
    async (snapshot: AppData) => {
      try {
        const text = await serializeFile(snapshot, encryptionRef.current);
        await session.backend.write(text);
        setSaveStatus('saved');
      } catch (error) {
        console.error('Speichern fehlgeschlagen', error);
        setSaveStatus('error');
      }
    },
    [session.backend],
  );

  const debouncedWrite = useMemo(() => debounce(writeNow, AUTOSAVE_DELAY_MS), [writeNow]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus('saving');
    debouncedWrite(data);
  }, [data, debouncedWrite]);

  // Ausstehende Änderungen beim Verlassen der Seite noch wegschreiben
  useEffect(() => {
    const flush = () => debouncedWrite.flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [debouncedWrite]);

  const value: AppContextValue = {
    data,
    dispatch,
    saveStatus,
    sourceKind: session.backend.kind,
    sourceLabel: session.backend.label,
    encrypted,
    saveNow: () => debouncedWrite.flush(),
    setFilePasswords: async (passwords) => {
      encryptionRef.current = passwords === null ? null : await newEncryptionContext(passwords);
      setEncrypted(passwords !== null);
      setSaveStatus('saving');
      await writeNow(data);
    },
    undo,
    canUndo,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp muss innerhalb von AppProvider verwendet werden');
  return context;
}
