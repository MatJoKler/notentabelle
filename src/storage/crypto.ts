const PBKDF2_ITERATIONS = 310_000;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* --------------------------------------------------------------------------
   Key-Wrapping: Ein zufälliger Datenschlüssel verschlüsselt den Inhalt und
   wird je Passwort (z.B. Passwort + Wiederherstellungsschlüssel) separat
   „eingewickelt“. Beim erneuten Speichern werden die Wraps unverändert
   übernommen — man muss nur EIN Passwort kennen.
   -------------------------------------------------------------------------- */

export interface KeyWrap {
  salt: string; // Base64, PBKDF2-Salt für das Wrap-Passwort
  iv: string; // Base64
  wrappedKey: string; // Base64, AES-GCM-verschlüsselter Datenschlüssel
}

export interface WrappedPayload {
  iv: string; // Base64, IV der Inhalts-Verschlüsselung
  ciphertext: string; // Base64
  wraps: KeyWrap[];
}

export interface EncryptionContext {
  dataKey: CryptoKey;
  wraps: KeyWrap[];
}

async function wrapDataKey(rawKey: Uint8Array, password: string): Promise<KeyWrap> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKey(password, salt);
  const wrapped = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    kek,
    rawKey as BufferSource,
  );
  return { salt: toBase64(salt), iv: toBase64(iv), wrappedKey: toBase64(new Uint8Array(wrapped)) };
}

function importDataKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey as BufferSource, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/** Neuer Datenschlüssel mit einem Wrap je Passwort. */
export async function newEncryptionContext(passwords: string[]): Promise<EncryptionContext> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const wraps = await Promise.all(passwords.map((password) => wrapDataKey(rawKey, password)));
  return { dataKey: await importDataKey(rawKey), wraps };
}

/** Kontext aus einer Datei entsperren; wirft, wenn kein Wrap zum Passwort passt. */
export async function unlockContext(payload: WrappedPayload, password: string): Promise<EncryptionContext> {
  for (const wrap of payload.wraps) {
    try {
      const kek = await deriveKey(password, fromBase64(wrap.salt));
      const rawKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromBase64(wrap.iv) as BufferSource },
        kek,
        fromBase64(wrap.wrappedKey) as BufferSource,
      );
      return { dataKey: await importDataKey(new Uint8Array(rawKey)), wraps: payload.wraps };
    } catch {
      // nächsten Wrap probieren
    }
  }
  throw new Error('Kein Wrap passt zum Passwort');
}

export async function encryptWithContext(data: unknown, context: EncryptionContext): Promise<WrappedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    context.dataKey,
    new TextEncoder().encode(JSON.stringify(data)) as BufferSource,
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)), wraps: context.wraps };
}

export async function decryptWithContext(payload: WrappedPayload, context: EncryptionContext): Promise<unknown> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) as BufferSource },
    context.dataKey,
    fromBase64(payload.ciphertext) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/** Komfort: entsperren + entschlüsseln in einem Schritt. */
export async function decryptWithPassword(payload: WrappedPayload, password: string): Promise<unknown> {
  return decryptWithContext(payload, await unlockContext(payload, password));
}
