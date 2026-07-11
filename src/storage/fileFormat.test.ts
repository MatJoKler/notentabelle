import { describe, expect, test } from 'vitest';
import { emptyAppData } from '../domain/model';
import {
  FileFormatError,
  PasswordRequiredError,
  WrongPasswordError,
  deserializeFile,
  isEncryptedFile,
  serializeFile,
} from './fileFormat';

function sample() {
  const data = emptyAppData('2025/26');
  data.classes.c1 = { name: '8c', studentIds: ['s1'] };
  data.students.s1 = { name: 'Anna Beispiel', classId: 'c1' };
  return data;
}

describe('serializeFile / deserializeFile (unverschlüsselt)', () => {
  test('Roundtrip liefert Originaldaten', async () => {
    const text = await serializeFile(sample(), null);
    expect(await deserializeFile(text)).toEqual(sample());
  });

  test('Datei trägt Format-Kennung', async () => {
    const parsed = JSON.parse(await serializeFile(sample(), null));
    expect(parsed.format).toBe('notentabelle');
    expect(parsed.encrypted).toBe(false);
  });

  test('isEncryptedFile erkennt unverschlüsselte Datei', async () => {
    expect(isEncryptedFile(await serializeFile(sample(), null))).toBe(false);
  });
});

describe('serializeFile / deserializeFile (verschlüsselt)', () => {
  test('Roundtrip mit Passwort', async () => {
    const text = await serializeFile(sample(), 'geheim');
    expect(await deserializeFile(text, 'geheim')).toEqual(sample());
  });

  test('Klartextnamen tauchen nicht in der Datei auf', async () => {
    const text = await serializeFile(sample(), 'geheim');
    expect(text).not.toContain('Anna');
  });

  test('isEncryptedFile erkennt verschlüsselte Datei', async () => {
    expect(isEncryptedFile(await serializeFile(sample(), 'geheim'))).toBe(true);
  });

  test('ohne Passwort: PasswordRequiredError', async () => {
    const text = await serializeFile(sample(), 'geheim');
    await expect(deserializeFile(text)).rejects.toBeInstanceOf(PasswordRequiredError);
  });

  test('falsches Passwort: WrongPasswordError', async () => {
    const text = await serializeFile(sample(), 'geheim');
    await expect(deserializeFile(text, 'falsch')).rejects.toBeInstanceOf(WrongPasswordError);
  });
});

describe('deserializeFile (Fremdformate)', () => {
  test('Alt-App-Export wird automatisch migriert', async () => {
    const legacy = JSON.stringify({
      schoolYear: '2024/25',
      classes: { class_1: { name: '8c', students: [{ id: 'student_1', name: 'Anna' }] } },
      subjects: {},
      grades: {},
      studentNotes: {},
      archives: {},
    });
    const data = await deserializeFile(legacy);
    expect(data.version).toBe(1);
    expect(data.students.student_1.name).toBe('Anna');
  });

  test('unbekanntes JSON: FileFormatError', async () => {
    await expect(deserializeFile('{"foo": 1}')).rejects.toBeInstanceOf(FileFormatError);
  });

  test('kein JSON: FileFormatError', async () => {
    await expect(deserializeFile('kein json')).rejects.toBeInstanceOf(FileFormatError);
  });
});
