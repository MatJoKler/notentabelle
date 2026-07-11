import { describe, expect, test } from 'vitest';
import { decryptJson, encryptJson, sha256Hex } from './crypto';

describe('sha256Hex', () => {
  test('liefert bekannten SHA-256-Hash', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('encryptJson / decryptJson', () => {
  test('Roundtrip liefert Originaldaten', async () => {
    const data = { schoolYear: '2025/26', students: { s1: { name: 'Anna Ärger' } } };
    const encrypted = await encryptJson(data, 'geheim123');
    expect(await decryptJson(encrypted, 'geheim123')).toEqual(data);
  });

  test('Chiffrat enthält keinen Klartext', async () => {
    const encrypted = await encryptJson({ name: 'StrengGeheimerName' }, 'pw');
    expect(JSON.stringify(encrypted)).not.toContain('StrengGeheimerName');
  });

  test('falsches Passwort wirft Fehler', async () => {
    const encrypted = await encryptJson({ a: 1 }, 'richtig');
    await expect(decryptJson(encrypted, 'falsch')).rejects.toThrow();
  });

  test('zwei Verschlüsselungen desselben Inhalts unterscheiden sich (Salt/IV)', async () => {
    const a = await encryptJson({ a: 1 }, 'pw');
    const b = await encryptJson({ a: 1 }, 'pw');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});
