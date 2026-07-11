import type { AppData } from '../domain/model';
import type { StorageBackend } from '../storage/backend';
import type { EncryptionContext } from '../storage/crypto';

/** Eine geöffnete Datenquelle: Backend + entschlüsselte Daten + Verschlüsselung. */
export interface Session {
  backend: StorageBackend;
  data: AppData;
  /** Kontext für das Wiederspeichern; null = unverschlüsselt. */
  encryption: EncryptionContext | null;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
