import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseXlsx } from './xlsxParser';

/** Integrationstest gegen die echte Vorlagen-Datei aus dem Repo. */
async function loadTemplate() {
  const buffer = readFileSync('Alte Umsetzung/00. Notentabellevorlage.xlsx');
  return parseXlsx(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

describe('parseXlsx', () => {
  test('liest alle Sheets der Vorlage', async () => {
    const workbook = await loadTemplate();
    expect(Object.keys(workbook)).toEqual([
      'Übersicht',
      'KA_1_Halbjahr',
      'Tests_1_Halbjahr',
      'Mündlich_1_Halbjahr',
      'KA_2_Halbjahr',
      'Tests_2_Halbjahr',
      'Mündlich_2_Halbjahr',
      'Fehlende_Abgaben',
      'Einstellungen',
    ]);
  });

  test('löst Shared Strings auf (Texte statt Indizes)', async () => {
    const workbook = await loadTemplate();
    expect(workbook['Übersicht'].B2).toBe('FACH');
    expect(workbook['Übersicht'].C5).toBe('2025/26');
    expect(workbook['Einstellungen'].F5).toBe('KA');
  });

  test('liefert Zahlen als Rohwerte', async () => {
    const workbook = await loadTemplate();
    expect(workbook['Einstellungen'].G5).toBe('3');
    expect(workbook['KA_1_Halbjahr'].G4).toBe('45953');
  });

  test('wirft bei Nicht-ZIP-Daten', async () => {
    await expect(parseXlsx(new TextEncoder().encode('kein zip').buffer)).rejects.toThrow();
  });
});
