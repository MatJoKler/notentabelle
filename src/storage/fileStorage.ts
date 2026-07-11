import type { StorageBackend } from './backend';

/* Die File System Access API fehlt in den Standard-DOM-Typen teilweise. */
declare global {
  interface Window {
    showOpenFilePicker(options?: {
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
      multiple?: boolean;
    }): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: {
      suggestedName?: string;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }): Promise<FileSystemFileHandle>;
  }
  interface FileSystemHandle {
    queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  }
}

const FILE_TYPES = [
  { description: 'Notentabelle-Datei', accept: { 'application/json': ['.json' as const] } },
];

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export async function openExistingDataFile(): Promise<FileSystemFileHandle> {
  const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
  return handle;
}

export async function createNewDataFile(): Promise<FileSystemFileHandle> {
  return window.showSaveFilePicker({ suggestedName: 'notentabelle.json', types: FILE_TYPES });
}

/** true, wenn Lese- und Schreibzugriff (ggf. nach Nutzer-Prompt) gewährt ist. */
export async function ensureReadWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const mode = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(mode)) === 'granted') return true;
  return (await handle.requestPermission(mode)) === 'granted';
}

export class FileBackend implements StorageBackend {
  readonly kind = 'file' as const;

  constructor(private readonly handle: FileSystemFileHandle) {}

  get label(): string {
    return this.handle.name;
  }

  async read(): Promise<string | null> {
    const file = await this.handle.getFile();
    const text = await file.text();
    return text === '' ? null : text;
  }

  async write(text: string): Promise<void> {
    const writable = await this.handle.createWritable();
    await writable.write(text);
    await writable.close();
  }
}

/* --- Handle-Persistenz in IndexedDB: Datei nur einmal auswählen müssen --- */

const DB_NAME = 'notentabelle';
const STORE = 'handles';
const HANDLE_KEY = 'dataFile';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  await requestToPromise(tx.objectStore(STORE).put(handle, HANDLE_KEY));
  db.close();
}

export async function loadPersistedHandle(): Promise<FileSystemFileHandle | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const handle = await requestToPromise<FileSystemFileHandle | undefined>(
    tx.objectStore(STORE).get(HANDLE_KEY),
  );
  db.close();
  return handle ?? null;
}

export async function clearPersistedHandle(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  await requestToPromise(tx.objectStore(STORE).delete(HANDLE_KEY));
  db.close();
}
