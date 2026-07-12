import { describe, expect, test } from 'vitest';
import { parseNameList } from './names';

describe('parseNameList', () => {
  test('ein Name pro Zeile', () => {
    expect(parseNameList('Anna Beispiel\nBen Muster')).toEqual(['Anna Beispiel', 'Ben Muster']);
  });

  test('leere Zeilen und Leerzeichen werden entfernt', () => {
    expect(parseNameList('  Anna  \n\n\nBen\n   ')).toEqual(['Anna', 'Ben']);
  });

  test('Windows-Zeilenumbrüche (Excel-Paste) funktionieren', () => {
    expect(parseNameList('Anna\r\nBen\r\nCem')).toEqual(['Anna', 'Ben', 'Cem']);
  });

  test('doppelte Namen bleiben erhalten (kann in echten Klassen vorkommen)', () => {
    expect(parseNameList('Anna\nAnna')).toEqual(['Anna', 'Anna']);
  });

  test('leere Eingabe ergibt leere Liste', () => {
    expect(parseNameList('')).toEqual([]);
    expect(parseNameList('  \n  ')).toEqual([]);
  });
});
