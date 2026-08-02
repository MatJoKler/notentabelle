// Kompletter Durchlauf entlang der Teststrategie aus dem Design-Doc:
// Ersteinrichtung → Daten anlegen → Noten → Reload/Persistenz → Export/Import → Jahreswechsel.
//
// Gefahren wird der Browser-Speicher-Weg (siehe harness.mjs) — der Datei-Weg über die
// File System Access API öffnet einen Betriebssystem-Dialog und bleibt Handarbeit.
import { readFile } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shot, startE2E } from './harness.mjs';

const { page, check, checkEquals, openApp, waitSaved, finish } = await startE2E();
const workDir = mkdtempSync(join(tmpdir(), 'notentabelle-e2e-'));

const sidebar = page.locator('.sidebar');
const goto = (name) => sidebar.getByRole('button', { name, exact: true }).click();
const classCard = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Klassen', exact: true }) });
const subjectCard = page.locator('.card').filter({ has: page.getByRole('heading', { name: 'Fächer', exact: true }) });
const semester1 = page
  .locator('.semester-block')
  .filter({ has: page.getByRole('heading', { name: '1. Halbjahr' }) });

async function openGrades() {
  await sidebar.getByRole('button', { name: 'Mathematik', exact: true }).click();
  await sidebar.getByRole('button', { name: '8c', exact: true }).click();
  await page.getByRole('tab', { name: 'Klassenarbeiten' }).click();
}

const gradeInput = (name) =>
  semester1.getByRole('row', { name: new RegExp(name) }).getByRole('textbox').first();

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
await openGrades();
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
await openGrades();
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
await openGrades();
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
