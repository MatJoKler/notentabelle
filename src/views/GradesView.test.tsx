/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_WEIGHTS, emptyAppData, type AppData } from '../domain/model';
import { AppProvider } from '../state/AppContext';
import type { Session } from '../state/session';
import type { StorageBackend } from '../storage/backend';
import { GradesView } from './GradesView';

/**
 * Nur die PDF-Ausgabe ist ersetzt (jspdf, langsam und ohne DOM-Ergebnis).
 * Der Rest des Moduls bleibt echt, und `buildStudentReport` läuft unverändert —
 * geprüft wird also die Nutzlast, die die View an den Export übergibt.
 */
const exportClassPdfMock = vi.hoisted(() => vi.fn());
vi.mock('../export/output', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../export/output')>()),
  exportClassPdf: exportClassPdfMock,
}));

/* --------------------------------------------------------------------------
   Testaufbau: echte Provider-/Reducer-Kette, nur das Schreiben ist eine Attrappe
   -------------------------------------------------------------------------- */

/** Backend-Attrappe: einziger Ersatz für Echtes — Datei-I/O gehört nicht in den Test. */
function fakeBackend(): StorageBackend {
  return {
    kind: 'browser',
    label: 'Test',
    read: async () => null,
    write: async () => {},
  };
}

/**
 * Klasse 8c mit drei Schüler:innen, Fach Mathematik, eine KA-Spalte im 1. Halbjahr.
 * `studentIds` steht bewusst NICHT alphabetisch — die View muss selbst sortieren.
 */
function buildData(): AppData {
  const data = emptyAppData('2026/27');
  data.classes.c1 = { name: '8c', studentIds: ['s3', 's2', 's1'] };
  data.students.s1 = { name: 'Bauer, Anna', classId: 'c1' };
  data.students.s2 = { name: 'Öztürk, Mert', classId: 'c1' };
  data.students.s3 = { name: 'Zimmer, Tom', classId: 'c1' };
  data.subjects.sub1 = {
    name: 'Mathematik',
    assignedClassIds: ['c1'],
    weights: { ...DEFAULT_WEIGHTS },
  };
  data.columns.col1 = {
    subjectId: 'sub1',
    classId: 'c1',
    semester: 1,
    category: 'ka',
    title: 'KA 1',
    date: '2026-09-15',
    order: 0,
  };
  data.grades['s1:col1'] = 2;
  return data;
}

/** Rendert die View in der echten Provider-Kette und liefert den Datenstand-Spion. */
function renderView(data: AppData = buildData()) {
  const session: Session = { backend: fakeBackend(), data, encryption: null };
  render(
    <AppProvider session={session}>
      <GradesView subjectId="sub1" classId="c1" />
    </AppProvider>,
  );
}

/** Der Halbjahres-Block, in dem gesucht werden soll — beide HJ stehen gleichzeitig da. */
function semester(n: 1 | 2): HTMLElement {
  const block = screen.getByRole('heading', { name: `${n}. Halbjahr` }).closest('.semester-block');
  if (!block) throw new Error(`Block für ${n}. Halbjahr nicht gefunden`);
  return block as HTMLElement;
}

/** Die Notenzellen einer Schüler-Zeile (Spaltentitel/Datum sind keine textbox). */
function gradeInputs(block: HTMLElement, studentName: string): HTMLInputElement[] {
  const row = within(block).getByRole('row', { name: new RegExp(studentName) });
  return within(row).getAllByRole('textbox') as HTMLInputElement[];
}

/** Namensspalte aller Schüler-Zeilen in Anzeigereihenfolge. */
function studentOrder(block: HTMLElement): string[] {
  return [...block.querySelectorAll('tbody tr td.sticky-col')].map((td) => td.textContent ?? '');
}

let user: UserEvent;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(cleanup);

/* --------------------------------------------------------------------------
   Tabs & Schülerliste
   -------------------------------------------------------------------------- */

describe('GradesView — Navigation', () => {
  test('startet in der Übersicht und wechselt bei Klick zu den Klassenarbeiten', async () => {
    renderView();

    expect(screen.getByRole('tab', { name: 'Übersicht' })).toHaveProperty('ariaSelected', 'true');
    expect(screen.queryByRole('heading', { name: '1. Halbjahr' })).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));

    expect(screen.getByRole('heading', { name: '1. Halbjahr' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '2. Halbjahr' })).toBeTruthy();
  });

  test('zeigt bei leerer Klasse einen Hinweis statt einer Notentabelle', async () => {
    const data = buildData();
    data.classes.c1.studentIds = [];
    renderView(data);

    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));

    expect(screen.getByText(/noch keine Schüler:innen/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '1. Halbjahr' })).toBeNull();
  });

  test('sortiert Schüler:innen alphabetisch, unabhängig von der Reihenfolge in der Klasse', async () => {
    renderView();
    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));

    expect(studentOrder(semester(1))).toEqual(['Bauer, Anna', 'Öztürk, Mert', 'Zimmer, Tom']);
  });
});

/* --------------------------------------------------------------------------
   Noteneingabe
   -------------------------------------------------------------------------- */

describe('GradesView — Noteneingabe', () => {
  beforeEach(async () => {
    renderView();
    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));
  });

  test('übernimmt eine Komma-Eingabe als Dezimalnote', async () => {
    const [input] = gradeInputs(semester(1), 'Zimmer');

    await user.type(input, '2,5');
    await user.tab();

    // Nach dem Speichern zeigt die Zelle den Wert wieder mit Komma an
    expect(input.value).toBe('2,5');
    // Ø der Notenart übernimmt den neuen Wert
    const row = within(semester(1)).getByRole('row', { name: /Zimmer/ });
    expect(within(row).getAllByRole('cell').at(-2)?.textContent).toBe('2,50');
  });

  test('rechnet die Tendenznote „2+" in 1,75 um', async () => {
    const [input] = gradeInputs(semester(1), 'Zimmer');

    await user.type(input, '2+');
    await user.tab();

    expect(input.value).toBe('1,75');
  });

  test('verwirft eine Note über 6 und markiert die Zelle als ungültig', async () => {
    const [input] = gradeInputs(semester(1), 'Zimmer');

    await user.type(input, '7');
    await user.tab();

    expect(input.className).toContain('is-invalid');
    // Klassenschnitt der Spalte bleibt bei der einzigen gültigen Note (Bauer: 2)
    expect(within(semester(1)).getByRole('row', { name: /Klassenschnitt/ }).textContent).toContain(
      '2,00',
    );
  });

  test('lässt eine bestehende Note stehen, wenn die neue Eingabe ungültig ist', async () => {
    const [input] = gradeInputs(semester(1), 'Bauer');

    await user.clear(input);
    await user.type(input, 'abc');
    await user.tab();

    expect(input.className).toContain('is-invalid');
    const row = within(semester(1)).getByRole('row', { name: /Bauer/ });
    expect(within(row).getAllByRole('cell').at(-2)?.textContent).toBe('2,00');
  });

  test('löscht die Note, wenn die Zelle geleert wird', async () => {
    const block = semester(1);
    const [input] = gradeInputs(block, 'Bauer');

    await user.clear(input);
    await user.tab();

    const row = within(semester(1)).getByRole('row', { name: /Bauer/ });
    expect(within(row).getAllByRole('cell').at(-2)?.textContent).toBe('–');
    expect(within(semester(1)).getByRole('row', { name: /Klassenschnitt/ }).textContent).toContain(
      '–',
    );
  });
});

/* --------------------------------------------------------------------------
   Tastaturnavigation
   -------------------------------------------------------------------------- */

describe('GradesView — Tastaturnavigation', () => {
  beforeEach(async () => {
    renderView();
    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));
  });

  test('Enter übernimmt den Wert und springt in dieselbe Spalte der nächsten Zeile', async () => {
    const block = semester(1);
    const [bauer] = gradeInputs(block, 'Bauer');
    const [oeztuerk] = gradeInputs(block, 'Öztürk');

    bauer.focus();
    await user.clear(bauer);
    await user.type(bauer, '3');
    await user.keyboard('{Enter}');

    expect(bauer.value).toBe('3');
    expect(document.activeElement).toBe(oeztuerk);
  });

  test('Shift+Enter springt in die vorherige Zeile', async () => {
    const block = semester(1);
    const [bauer] = gradeInputs(block, 'Bauer');
    const [oeztuerk] = gradeInputs(block, 'Öztürk');

    oeztuerk.focus();
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(document.activeElement).toBe(bauer);
  });

  test('Enter in der letzten Zeile lässt den Fokus stehen', async () => {
    const block = semester(1);
    const [zimmer] = gradeInputs(block, 'Zimmer');

    zimmer.focus();
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(zimmer);
  });

  test('bleibt beim Zeilenwechsel in derselben Spalte', async () => {
    await user.click(within(semester(1)).getByRole('button', { name: 'Spalte hinzufügen' }));
    const bauer = gradeInputs(semester(1), 'Bauer');
    const oeztuerk = gradeInputs(semester(1), 'Öztürk');
    expect(bauer).toHaveLength(2);

    bauer[1].focus();
    await user.keyboard('{Enter}');

    expect(document.activeElement).toBe(oeztuerk[1]);
  });
});

/* --------------------------------------------------------------------------
   Spaltenverwaltung
   -------------------------------------------------------------------------- */

describe('GradesView — Spalten', () => {
  beforeEach(async () => {
    renderView();
    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));
  });

  test('nummeriert neue Spalten fortlaufend weiter', async () => {
    const addButton = within(semester(1)).getByRole('button', { name: 'Spalte hinzufügen' });

    await user.click(addButton);
    await user.click(addButton);

    const titles = [...semester(1).querySelectorAll<HTMLInputElement>('input.column-title')].map(
      (input) => input.value,
    );
    expect(titles).toEqual(['KA 1', 'KA 2', 'KA 3']);
  });

  test('zählt je Halbjahr getrennt', async () => {
    await user.click(within(semester(2)).getByRole('button', { name: 'Spalte hinzufügen' }));

    const titles = [...semester(2).querySelectorAll<HTMLInputElement>('input.column-title')].map(
      (input) => input.value,
    );
    expect(titles).toEqual(['KA 1']);
  });

  test('übernimmt einen umbenannten Spaltentitel beim Verlassen des Feldes', async () => {
    const title = semester(1).querySelector<HTMLInputElement>('input.column-title')!;

    await user.clear(title);
    await user.type(title, '  Bruchrechnung  ');
    await user.tab();

    expect(title.value).toBe('Bruchrechnung');
    expect(
      within(semester(1)).getByRole('button', { name: 'Spalte Bruchrechnung löschen' }),
    ).toBeTruthy();
  });

  test('verwirft einen leeren Spaltentitel und stellt den alten wieder her', async () => {
    const title = semester(1).querySelector<HTMLInputElement>('input.column-title')!;

    await user.clear(title);
    await user.tab();

    expect(title.value).toBe('KA 1');
  });

  test('löscht eine Spalte erst nach Bestätigung — Abbrechen behält sie', async () => {
    await user.click(within(semester(1)).getByRole('button', { name: 'Spalte KA 1 löschen' }));
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(within(semester(1)).getByRole('button', { name: 'Spalte KA 1 löschen' })).toBeTruthy();
  });

  test('entfernt beim Löschen die Spalte samt eingetragener Noten', async () => {
    await user.click(within(semester(1)).getByRole('button', { name: 'Spalte KA 1 löschen' }));
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

    expect(within(semester(1)).queryByRole('button', { name: 'Spalte KA 1 löschen' })).toBeNull();
    expect(within(semester(1)).getByText(/Noch keine Spalte/)).toBeTruthy();
    // Bauers 2 hing an dieser Spalte — der Halbjahresschnitt muss leer sein
    const row = within(semester(1)).getByRole('row', { name: /Bauer/ });
    expect(within(row).getAllByRole('cell').at(-1)?.textContent).toBe('–');
  });
});

/* --------------------------------------------------------------------------
   Notenspiegel
   -------------------------------------------------------------------------- */

describe('GradesView — Notenspiegel', () => {
  test('ist ausgeblendet und zeigt nach dem Einblenden die Verteilung der Spalte', async () => {
    const data = buildData();
    data.grades['s2:col1'] = 2.4; // rundet auf 2 → zwei Zweien
    data.grades['s3:col1'] = 5;
    renderView(data);
    await user.click(screen.getByRole('tab', { name: 'Klassenarbeiten' }));

    expect(within(semester(1)).queryByText('Anzahl Note 2')).toBeNull();

    await user.click(within(semester(1)).getByRole('button', { name: 'Notenspiegel anzeigen' }));

    const countFor = (grade: number) =>
      within(semester(1))
        .getByRole('row', { name: new RegExp(`Anzahl Note ${grade}`) })
        .querySelector('.distribution-count-cell')?.textContent;

    expect(countFor(2)).toBe('2');
    expect(countFor(5)).toBe('1');
    expect(countFor(3)).toBe('');
  });
});

/* --------------------------------------------------------------------------
   Abgaben-Listen
   -------------------------------------------------------------------------- */

describe('GradesView — Abgaben', () => {
  /**
   * Der Tab-Wechsel ist der eigentliche Prüfpunkt: er wirft die Tabelle weg und
   * baut sie aus dem Datenstand neu auf. Ohne ihn würde der lokale Feld-State
   * den Text auch dann zeigen, wenn nie etwas gespeichert wurde.
   */
  test('speichert einen Freitext-Eintrag über einen Tab-Wechsel hinweg', async () => {
    renderView();
    await user.click(screen.getByRole('tab', { name: 'Abgaben' }));
    await user.click(screen.getByRole('button', { name: 'Liste hinzufügen' }));

    const trackingInput = (studentName: string) =>
      within(screen.getByRole('row', { name: new RegExp(studentName) })).getByRole(
        'textbox',
      ) as HTMLInputElement;

    await user.type(trackingInput('Bauer'), 'III');
    await user.tab();

    await user.click(screen.getByRole('tab', { name: 'Übersicht' }));
    await user.click(screen.getByRole('tab', { name: 'Abgaben' }));

    expect(trackingInput('Bauer').value).toBe('III');
    expect(trackingInput('Zimmer').value).toBe('');
  });
});

/* --------------------------------------------------------------------------
   Übersicht: Jahres-/Halbjahresnoten und Klassenschnitte
   -------------------------------------------------------------------------- */

/**
 * Erwartungswerte von Hand hergeleitet, Gewichtung 50/25/25 (percent):
 *
 *            HJ1                          HJ2                    Jahr
 *   Bauer    (3·50 + 2·25 + 1·25)/100     dito = 2,25            2,25
 *            = 2,25
 *   Öztürk   nur KA 4         = 4,00      nur KA 6     = 6,00    5,00
 *   Zimmer   keine Noten      = –         –                      –
 *   Klasse   (2,25+4)/2 = 3,13            (2,25+6)/2 = 4,13      3,63
 *
 * Alle Zwischenwerte sind Vielfache von 1/8, also binär exakt — sonst hinge
 * das Runden auf den ,5-Grenzen an der Gleitkomma-Darstellung.
 */
function buildOverviewData(): AppData {
  const data = emptyAppData('2026/27');
  data.classes.c1 = { name: '8c', studentIds: ['s3', 's2', 's1'] };
  data.students.s1 = { name: 'Bauer, Anna', classId: 'c1' };
  data.students.s2 = { name: 'Öztürk, Mert', classId: 'c1' };
  data.students.s3 = { name: 'Zimmer, Tom', classId: 'c1' };
  data.subjects.sub1 = {
    name: 'Mathematik',
    assignedClassIds: ['c1'],
    weights: { ...DEFAULT_WEIGHTS },
  };

  const column = (id: string, semester: 1 | 2, category: 'ka' | 'test' | 'muendlich', order: number) => {
    data.columns[id] = {
      subjectId: 'sub1',
      classId: 'c1',
      semester,
      category,
      title: id,
      date: null,
      order,
    };
  };
  column('k1', 1, 'ka', 0);
  column('k2', 1, 'ka', 1);
  column('t1', 1, 'test', 0);
  column('m1', 1, 'muendlich', 0);
  column('k3', 2, 'ka', 0);
  column('k4', 2, 'ka', 1);
  column('t2', 2, 'test', 0);
  column('m2', 2, 'muendlich', 0);

  Object.assign(data.grades, {
    's1:k1': 2, 's1:k2': 4, 's1:t1': 2, 's1:m1': 1,
    's1:k3': 2, 's1:k4': 4, 's1:t2': 2, 's1:m2': 1,
    's2:k1': 4,
    's2:k3': 6,
  });
  return data;
}

/** Zellinhalte einer Übersichtszeile: Name, Jahr, HJ1+Notenarten, HJ2+Notenarten. */
function overviewRow(studentName: string): string[] {
  const row = within(screen.getByRole('table')).getByRole('row', {
    name: new RegExp(studentName),
  });
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

function statValue(label: string): HTMLElement {
  const card = screen.getByText(label).closest('.stat-card');
  if (!card) throw new Error(`Kachel „${label}" nicht gefunden`);
  return card.querySelector('.stat-value') as HTMLElement;
}

describe('GradesView — Übersicht', () => {
  beforeEach(() => {
    exportClassPdfMock.mockClear();
  });

  test('zeigt je Schüler:in Jahresnote, beide Halbjahre und alle Notenart-Schnitte', () => {
    renderView(buildOverviewData());

    expect(overviewRow('Bauer')).toEqual([
      'Bauer, Anna',
      '2,25', // Jahr
      '2,25', '3,00', '2,00', '1,00', // 1. HJ: Note, KA, Tests, Mündlich
      '2,25', '3,00', '2,00', '1,00', // 2. HJ
    ]);
    expect(overviewRow('Öztürk')).toEqual([
      'Öztürk, Mert',
      '5,00',
      '4,00', '4,00', '–', '–',
      '6,00', '6,00', '–', '–',
    ]);
  });

  test('zeigt für Schüler:innen ganz ohne Noten durchgehend Gedankenstriche', () => {
    renderView(buildOverviewData());

    expect(overviewRow('Zimmer')).toEqual(['Zimmer, Tom', ...Array(9).fill('–')]);
  });

  test('mittelt die Klassenschnitte über die Schüler:innen, nicht über alle Einzelnoten', () => {
    renderView(buildOverviewData());

    // Über alle Einzelnoten gerechnet käme 3,00 (Jahr) heraus — hier zählt je Kopf
    expect(statValue('Klassenschnitt (Jahr)').textContent).toBe('3,63');
    expect(statValue('Schnitt 1. Halbjahr').textContent).toBe('3,13');
    expect(statValue('Schnitt 2. Halbjahr').textContent).toBe('4,13');
  });

  test('lässt Schüler:innen ohne Noten aus dem Klassenschnitt heraus', () => {
    const data = buildOverviewData();
    data.students.s4 = { name: 'Ahrens, Lea', classId: 'c1' };
    data.classes.c1.studentIds.push('s4');
    renderView(data);

    // Als 0 mitgezählt läge der Schnitt bei 2,42 statt unverändert bei 3,63
    expect(statValue('Klassenschnitt (Jahr)').textContent).toBe('3,63');
    expect(overviewRow('Ahrens')).toEqual(['Ahrens, Lea', ...Array(9).fill('–')]);
  });

  test('zeigt Gedankenstriche, solange in der Klasse keine Note steht', () => {
    const data = buildOverviewData();
    data.grades = {};
    renderView(data);

    expect(statValue('Klassenschnitt (Jahr)').textContent).toBe('–');
    expect(statValue('Schnitt 1. Halbjahr').textContent).toBe('–');
  });

  test('färbt Noten nach Notenband ein', () => {
    renderView(buildOverviewData());
    const yearCell = (name: string) =>
      within(screen.getByRole('table')).getByRole('row', { name: new RegExp(name) }).children[1];

    expect(yearCell('Bauer').className).toContain('band-gut'); // 2,25
    expect(yearCell('Öztürk').className).toContain('band-schlecht'); // 5,00
    expect(yearCell('Zimmer').className).not.toMatch(/band-/); // ohne Note kein Band
    expect(statValue('Klassenschnitt (Jahr)').className).toContain('band-befriedigend'); // 3,63
  });

  test('übergibt dem Klassen-PDF alle Schüler:innen in Anzeigereihenfolge', async () => {
    renderView(buildOverviewData());

    await user.click(screen.getByRole('button', { name: /Klasse als PDF/ }));

    expect(exportClassPdfMock).toHaveBeenCalledTimes(1);
    const [reports, filename] = exportClassPdfMock.mock.calls[0];
    expect(reports.map((r: { title: string }) => r.title)).toEqual([
      'Bauer, Anna',
      'Öztürk, Mert',
      'Zimmer, Tom',
    ]);
    expect(filename).toBe('Klasse 8c 2026-27');
    // Die Berichte selbst entstehen echt — Stichprobe auf die Jahresnote
    expect(reports[0].subjects).toEqual([
      { name: 'Mathematik', semester1: '2,25', semester2: '2,25', year: '2,25', previous: null },
    ]);
  });
});
