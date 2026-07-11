import type { AppData } from '../domain/model';
import type { StorageBackend } from '../storage/backend';

/** Eine geöffnete Datenquelle: Backend + entschlüsselte Daten + ggf. Passwort. */
export interface Session {
  backend: StorageBackend;
  data: AppData;
  /** Passwort für die Dateiverschlüsselung; null = unverschlüsselt. */
  password: string | null;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
