import { describe, expect, test } from 'vitest';
import {
  decryptWithPassword,
  encryptWithContext,
  newEncryptionContext,
  sha256Hex,
  unlockContext,
} from './crypto';

describe('sha256Hex', () => {
  test('liefert bekannten SHA-256-Hash', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('encryptWithContext / decryptWithPassword', () => {
  test('Roundtrip liefert Originaldaten', async () => {
    const data = { schoolYear: '2025/26', students: { s1: { name: 'Anna Ärger' } } };
    const context = await newEncryptionContext(['geheim123']);
    expect(await decryptWithPassword(await encryptWithContext(data, context), 'geheim123')).toEqual(data);
  });

  test('Chiffrat enthält keinen Klartext', async () => {
    const context = await newEncryptionContext(['pw']);
    const encrypted = await encryptWithContext({ name: 'StrengGeheimerName' }, context);
    expect(JSON.stringify(encrypted)).not.toContain('StrengGeheimerName');
  });

  test('zwei Verschlüsselungen desselben Inhalts unterscheiden sich (IV)', async () => {
    const context = await newEncryptionContext(['pw']);
    const a = await encryptWithContext({ a: 1 }, context);
    const b = await encryptWithContext({ a: 1 }, context);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});

describe('Key-Wrapping: Passwort + Wiederherstellungsschlüssel', () => {
  test('jedes der Passwörter entschlüsselt die Daten', async () => {
    const context = await newEncryptionContext(['geheim', 'RECOVERY-KEY-1234']);
    const payload = await encryptWithContext({ note: 2.5 }, context);
    expect(await decryptWithPassword(payload, 'geheim')).toEqual({ note: 2.5 });
    expect(await decryptWithPassword(payload, 'RECOVERY-KEY-1234')).toEqual({ note: 2.5 });
  });

  test('falsches Passwort wirft Fehler', async () => {
    const context = await newEncryptionContext(['geheim', 'RECOVERY-KEY-1234']);
    const payload = await encryptWithContext({ a: 1 }, context);
    await expect(decryptWithPassword(payload, 'falsch')).rejects.toThrow();
  });

  test('entsperrter Kontext kann erneut speichern, ohne die anderen Passwörter zu kennen', async () => {
    const original = await newEncryptionContext(['geheim', 'RECOVERY-KEY-1234']);
    const payload = await encryptWithContext({ version: 1 }, original);

    // Öffnen nur mit dem Passwort …
    const unlocked = await unlockContext(payload, 'geheim');
    const resaved = await encryptWithContext({ version: 2 }, unlocked);

    // … und der Recovery-Key funktioniert weiterhin
    expect(await decryptWithPassword(resaved, 'RECOVERY-KEY-1234')).toEqual({ version: 2 });
  });
});
