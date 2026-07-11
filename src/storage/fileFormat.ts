import { isLegacyData, migrateLegacyData } from '../domain/migrate';
import type { AppData } from '../domain/model';
import { decryptJson, encryptJson, type EncryptedPayload } from './crypto';

const FORMAT = 'notentabelle';

export class FileFormatError extends Error {}
export class PasswordRequiredError extends Error {}
export class WrongPasswordError extends Error {}

interface FileWrapper {
  format: typeof FORMAT;
  fileVersion: 1;
  encrypted: boolean;
  payload: AppData | EncryptedPayload;
}

/** AppData als Dateitext; mit Passwort wird der Payload AES-GCM-verschlüsselt. */
export async function serializeFile(data: AppData, password: string | null): Promise<string> {
  const wrapper: FileWrapper = {
    format: FORMAT,
    fileVersion: 1,
    encrypted: password !== null,
    payload: password !== null ? await encryptJson(data, password) : data,
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
 * Dateitext einlesen: eigenes Format (optional verschlüsselt) oder
 * Alt-App-Export (wird migriert). Wirft FileFormatError, PasswordRequiredError
 * oder WrongPasswordError.
 */
export async function deserializeFile(text: string, password?: string): Promise<AppData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new FileFormatError('Datei enthält kein gültiges JSON');
  }

  if (parsed !== null && typeof parsed === 'object' && (parsed as FileWrapper).format === FORMAT) {
    const wrapper = parsed as FileWrapper;
    if (!wrapper.encrypted) return wrapper.payload as AppData;
    if (password === undefined) {
      throw new PasswordRequiredError('Datei ist passwortgeschützt');
    }
    try {
      return (await decryptJson(wrapper.payload as EncryptedPayload, password)) as AppData;
    } catch {
      throw new WrongPasswordError('Passwort ist falsch');
    }
  }

  if (isLegacyData(parsed)) return migrateLegacyData(parsed);

  throw new FileFormatError('Unbekanntes Dateiformat');
}
