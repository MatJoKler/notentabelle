/**
 * Abstraktion über die beiden Speicherwege:
 * - 'file': echte Datei via File System Access API (Chrome/Edge)
 * - 'browser': localStorage-Fallback mit manuellem Export (Firefox/Safari)
 */
export interface StorageBackend {
  readonly kind: 'file' | 'browser';
  /** Anzeigename der Datenquelle, z.B. der Dateiname. */
  readonly label: string;
  read(): Promise<string | null>;
  write(text: string): Promise<void>;
}
