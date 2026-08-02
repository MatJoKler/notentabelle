// Kompletter Durchlauf entlang der Teststrategie aus dem Design-Doc:
// Ersteinrichtung → Daten anlegen → Noten → Reload/Persistenz → Export/Import → Jahreswechsel.
//
// Gefahren wird der Browser-Speicher-Weg (Firefox/Safari), erzwungen in harness.mjs.
// Den Datei-Weg über die File System Access API prüft file-save.mjs.
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shot, startE2E, ui } from './harness.mjs';

const { page, check, checkEquals, openApp, waitSaved, finish } = await startE2E();
const workDir = mkdtempSync(join(tmpdir(), 'notentabelle-e2e-'));

const { sidebar, semester1, classCard, subjectCard, goto, openGrades, gradeInput } = ui(page);

/* ── 1 Ersteinrichtung ──────────────────────────────────────────────────── */
await openApp();
const startYear = (await sidebar.locator('.sidebar-year').innerText()).replace('Schuljahr', '').trim();
check('Ersteinrichtung läuft auf dem Browser-Speicher',
  (await sidebar.locator('.save-source').innerText()).includes('Browser-Speicher'));
check('Schuljahr automatisch gesetzt', /^\d{4}\/\d{2}$/.test(startYear), startYear);

/* ── 2 Klasse und Schüler:innen anlegen ─────────────────────────────────── */
await goto('Klassen & Fächer');
await classCard.getByRole('button', { name: 'Klasse anlegen' }).click();
await page.getByLabel('Name der Klasse (z.B. 8c)').fill('8c');
await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

await classCard.getByRole('button', { name: 'Schüler:innen hinzufügen' }).click();
await page.getByLabel(/Ein Name pro Zeile/).fill('Bauer, Anna\nÖztürk, Mert\nZimmer, Tom');
await page.getByRole('button', { name: '3 Schüler:innen aufnehmen' }).click();
checkEquals('Klasse 8c mit drei Schüler:innen angelegt',
  (await classCard.locator('.class-count').first().innerText()).trim(), '3 Schüler:innen');

/* ── 3 Fach anlegen und der Klasse zuordnen ─────────────────────────────── */
await subjectCard.getByRole('button', { name: 'Fach anlegen' }).click();
await page.getByLabel('Name des Fachs (z.B. Mathematik)').fill('Mathematik');
await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
await subjectCard.getByLabel('8c').check();
check('Fach erscheint in der Seitenleiste',
  await sidebar.getByRole('button', { name: 'Mathematik', exact: true }).isVisible());

/* ── 4 Noten eintragen ──────────────────────────────────────────────────── */
await openGrades('Mathematik', '8c');
await semester1.getByRole('button', { name: 'Spalte hinzufügen' }).click();
for (const [name, note] of [['Bauer', '2'], ['Öztürk', '3'], ['Zimmer', '1']]) {
  const cell = gradeInput(name);
  await cell.fill(note);
  await cell.press('Tab');
}
checkEquals('Klassenschnitt der Arbeit', // (2+3+1)/3
  (await semester1.getByRole('row', { name: /Klassenschnitt/ }).locator('.grade-cell').first().innerText()).trim(),
  '2,00');

const bauer = gradeInput('Bauer');
await bauer.fill('9');
await bauer.press('Tab');
check('Note außerhalb 1–6 wird abgewiesen', (await bauer.getAttribute('class')).includes('is-invalid'));
await bauer.fill('2');
await bauer.press('Tab');
await page.screenshot({ path: shot('noten.png'), fullPage: true });

/* ── 5 Persistenz über einen echten Reload ──────────────────────────────── */
await waitSaved();
await openApp();
await openGrades('Mathematik', '8c');
checkEquals('Note überlebt den Reload', await gradeInput('Bauer').inputValue(), '2');

/* ── 6 Sicherungskopie herunterladen ────────────────────────────────────── */
await goto('Einstellungen');
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Sicherungskopie herunterladen' }).click(),
]);
const backupPath = join(workDir, 'sicherung.json');
await download.saveAs(backupPath);
const backup = JSON.parse(await readFile(backupPath, 'utf8'));
check('Sicherung hat das Notentabelle-Format',
  backup.format === 'notentabelle' && backup.encrypted === false);
checkEquals('Sicherung enthält alle Schüler:innen', Object.keys(backup.payload.students).length, 3);
checkEquals('Sicherung enthält die eingetragene Note',
  Object.values(backup.payload.grades).sort().join(','), '1,2,3');

/* ── 7 Klasse löschen und aus der Sicherung wiederherstellen ────────────── */
await goto('Klassen & Fächer');
await classCard.getByRole('button', { name: 'Löschen' }).first().click();
await page.getByRole('button', { name: 'Endgültig löschen' }).click();
check('Klasse ist gelöscht', await classCard.getByText('Noch keine Klassen').isVisible());

await goto('Einstellungen');
await page.locator('input[type="file"][accept*="json"]').setInputFiles(backupPath);
await page.getByRole('button', { name: 'Wiederherstellen', exact: true }).click();
await goto('Klassen & Fächer');
check('Klasse ist nach der Wiederherstellung zurück',
  await classCard.getByText('8c', { exact: true }).isVisible());
await openGrades('Mathematik', '8c');
checkEquals('Auch die Noten sind wieder da', await gradeInput('Bauer').inputValue(), '2');

/* ── 8 Schuljahreswechsel ───────────────────────────────────────────────── */
await waitSaved();
await goto('Archiv');
await page.getByRole('button', { name: `Schuljahr ${startYear} abschließen` }).click();
await page.getByRole('button', { name: 'Jetzt abschließen' }).click();

const newYear = (await sidebar.locator('.sidebar-year').innerText()).replace('Schuljahr', '').trim();
check('Schuljahr ist fortgeschaltet', newYear !== startYear, `${startYear} → ${newYear}`);
check('Altes Schuljahr steht im Archiv',
  await page.getByText(startYear, { exact: false }).first().isVisible());
await goto('Klassen & Fächer');
check('Klasse wurde hochgestuft (8c → 9c)',
  await classCard.getByText('9c', { exact: true }).isVisible());
await page.screenshot({ path: shot('nach-jahreswechsel.png'), fullPage: true });

await finish();
