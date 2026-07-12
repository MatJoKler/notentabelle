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

  test('mit Kontext (Passwort + Recovery-Key): beide öffnen, Wiederspeichern erhält beide', async () => {
    const { newEncryptionContext } = await import('./crypto');
    const { openFile } = await import('./fileFormat');
    const context = await newEncryptionContext(['geheim', 'WIEDERHERSTELLUNG']);
    const text = await serializeFile(sample(), context);

    expect(await deserializeFile(text, 'WIEDERHERSTELLUNG')).toEqual(sample());

    const opened = await openFile(text, 'geheim');
    const resaved = await serializeFile(opened.data, opened.encryption);
    expect(await deserializeFile(resaved, 'WIEDERHERSTELLUNG')).toEqual(sample());
  });
});

describe('deserializeFile (ältere eigene Dateien)', () => {
  test('Dateien ohne Tracking-Felder werden beim Laden normalisiert', async () => {
    const wrapper = JSON.parse(await serializeFile(sample(), null));
    delete wrapper.payload.trackingColumns;
    delete wrapper.payload.trackingValues;
    const data = await deserializeFile(JSON.stringify(wrapper));
    expect(data.trackingColumns).toEqual({});
    expect(data.trackingValues).toEqual({});
  });

  test('auch Archiv-Snapshots werden normalisiert', async () => {
    const source = sample();
    source.archives['2024/25'] = {
      schoolYear: '2024/25',
      archivedDate: 'x',
      classes: {},
      students: {},
      subjects: {},
      columns: {},
      grades: {},
      notes: {},
      trackingColumns: {},
      trackingValues: {},
    };
    const wrapper = JSON.parse(await serializeFile(source, null));
    delete wrapper.payload.archives['2024/25'].trackingColumns;
    delete wrapper.payload.archives['2024/25'].trackingValues;
    const data = await deserializeFile(JSON.stringify(wrapper));
    expect(data.archives['2024/25'].trackingColumns).toEqual({});
    expect(data.archives['2024/25'].trackingValues).toEqual({});
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
