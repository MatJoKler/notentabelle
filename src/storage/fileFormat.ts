import { isLegacyData, migrateLegacyData } from '../domain/migrate';
import type { AppData } from '../domain/model';
import {
  decryptWithContext,
  encryptWithContext,
  newEncryptionContext,
  unlockContext,
  type EncryptionContext,
  type WrappedPayload,
} from './crypto';

const FORMAT = 'notentabelle';

export class FileFormatError extends Error {}
export class PasswordRequiredError extends Error {}
export class WrongPasswordError extends Error {}

interface FileWrapper {
  format: typeof FORMAT;
  fileVersion: 1;
  encrypted: boolean;
  payload: AppData | WrappedPayload;
}

/** Geöffnete Datei: Daten + Verschlüsselungskontext für das Wiederspeichern. */
export interface OpenedFile {
  data: AppData;
  encryption: EncryptionContext | null;
}

/** Felder ergänzen, die ältere Dateiversionen noch nicht kannten. */
function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    trackingColumns: data.trackingColumns ?? {},
    trackingValues: data.trackingValues ?? {},
    archives: Object.fromEntries(
      Object.entries(data.archives ?? {}).map(([year, snapshot]) => [
        year,
        {
          ...snapshot,
          trackingColumns: snapshot.trackingColumns ?? {},
          trackingValues: snapshot.trackingValues ?? {},
        },
      ]),
    ),
  };
}

/**
 * AppData als Dateitext. `encryption` akzeptiert einen bestehenden Kontext,
 * ein einzelnes Passwort (erzeugt einen neuen Kontext) oder null (Klartext).
 */
export async function serializeFile(
  data: AppData,
  encryption: EncryptionContext | string | null,
): Promise<string> {
  const context =
    typeof encryption === 'string' ? await newEncryptionContext([encryption]) : encryption;
  const wrapper: FileWrapper = {
    format: FORMAT,
    fileVersion: 1,
    encrypted: context !== null,
    payload: context !== null ? await encryptWithContext(data, context) : data,
  };
  return JSON.stringify(wrapper, null, 2);
}

export function isEncryptedFile(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return parsed?.format === FORMAT && parsed.encrypted === true;
  } catch {
    return false;
  }
}

/**
 * Dateitext öffnen: eigenes Format (optional verschlüsselt) oder Alt-App-Export
 * (wird migriert). Wirft FileFormatError, PasswordRequiredError oder WrongPasswordError.
 */
export async function openFile(text: string, password?: string): Promise<OpenedFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new FileFormatError('Datei enthält kein gültiges JSON');
  }

  if (parsed !== null && typeof parsed === 'object' && (parsed as FileWrapper).format === FORMAT) {
    const wrapper = parsed as FileWrapper;
    if (!wrapper.encrypted) {
      return { data: normalizeAppData(wrapper.payload as AppData), encryption: null };
    }
    if (password === undefined) {
      throw new PasswordRequiredError('Datei ist passwortgeschützt');
    }
    try {
      const encryption = await unlockContext(wrapper.payload as WrappedPayload, password);
      const data = (await decryptWithContext(wrapper.payload as WrappedPayload, encryption)) as AppData;
      return { data: normalizeAppData(data), encryption };
    } catch {
      throw new WrongPasswordError('Passwort ist falsch');
    }
  }

  if (isLegacyData(parsed)) return { data: migrateLegacyData(parsed), encryption: null };

  throw new FileFormatError('Unbekanntes Dateiformat');
}

/** Nur die Daten — Komfort für Import-Flows, die den Kontext nicht brauchen. */
export async function deserializeFile(text: string, password?: string): Promise<AppData> {
  return (await openFile(text, password)).data;
}
