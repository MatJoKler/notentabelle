import type { StorageBackend } from './backend';

const LOCAL_STORAGE_KEY = 'notentabelle-data';

/** Fallback für Browser ohne File System Access API (Firefox/Safari):
 *  localStorage als Primärspeicher, Sicherung über manuellen Export. */
export class BrowserBackend implements StorageBackend {
  readonly kind = 'browser' as const;
  readonly label = 'Browser-Speicher';

  async read(): Promise<string | null> {
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  }

  async write(text: string): Promise<void> {
    localStorage.setItem(LOCAL_STORAGE_KEY, text);
  }
}

/** Manueller Export: Datei-Download anstoßen. */
export function downloadTextFile(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Manueller Import: Inhalt einer vom Nutzer gewählten Datei lesen. */
export function readTextFromFile(file: File): Promise<string> {
  return file.text();
}
