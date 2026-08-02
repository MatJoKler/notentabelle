// Der wichtigste Speicherweg: „Neue Notendatei anlegen" → Speicherort wählen → ab jetzt
// speichert die App automatisch in genau diese Datei.
//
// Geprüft wird gegen eine echte Datei auf der Platte: Node legt sie nicht selbst an und
// füllt sie nicht — das macht die App. Node liest nur nach und vergleicht.
//
// Überbrückt ist einzig der Betriebssystem-Dialog (siehe `installFilePicker` in harness.mjs);
// Handle-Freigabe, IndexedDB-Persistenz, FileBackend, Autosave und Dateiformat laufen echt.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shot, startE2E, ui } from './harness.mjs';

const workDir = mkdtempSync(join(tmpdir(), 'notentabelle-datei-'));
const fileTarget = join(workDir, 'notentabelle.json');

const { page, check, checkEquals, openApp, finish } = await startE2E({ fileTarget });

/**
 * Inhalt der Notendatei so, wie sie gerade auf der Platte liegt — `null`, solange dort noch
 * nichts Lesbares steht. Ein kaputter Speicherweg soll als roter Haken auffallen, nicht als
 * Abbruch mit Aufrufliste.
 */
function readTargetFile() {
  try {
    return JSON.parse(readFileSync(fileTarget, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Wartet, bis die Datei auf der Platte die Bedingung erfüllt — der Autosave ist entprellt,
 * die Oberfläche ist also früher fertig als die Datei. Läuft die Frist ab, kommt trotzdem
 * der zuletzt gelesene Stand zurück: Der Aufrufer soll die Abweichung als Fehlschlag zeigen,
 * nicht bloß eine Zeitüberschreitung werfen.
 */
async function waitForFile(predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = readTargetFile();
    if (last !== null && predicate(last)) return last;
    if (Date.now() >= deadline) return last;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Alle Noten eines Schülers aus dem Dateiinhalt — Schlüssel ist `${StudentId}:${ColumnId}`. */
const gradesOf = (file, studentId) =>
  Object.entries(file?.payload?.grades ?? {})
    .filter(([key]) => key.startsWith(`${studentId}:`))
    .map(([, value]) => value);

const { sidebar, semester1, classCard, subjectCard, goto, openGrades, gradeInput } = ui(page);

/* ── 1 Vor dem ersten Klick gibt es die Datei nicht ─────────────────────── */
check('Zielort ist vor dem Test leer', !existsSync(fileTarget), fileTarget);

/* ── 2 „Neue Notendatei anlegen" legt die Datei wirklich an ─────────────── */
checkEquals('Einstieg über „Neue Notendatei anlegen"', await openApp(), 'Neue Notendatei anlegen');
check('Datei liegt nach der Auswahl auf der Platte', existsSync(fileTarget), fileTarget);
checkEquals('App speichert in die Datei, nicht in den Browser-Speicher',
  (await sidebar.locator('.save-source').innerText()).trim(), 'notentabelle.json');

const initial = await waitForFile((file) => file.format === 'notentabelle');
check('Datei hat sofort das Notentabelle-Format',
  initial?.format === 'notentabelle' && initial?.fileVersion === 1 && initial?.encrypted === false,
  initial === null
    ? 'leere oder unlesbare Datei'
    : `${initial.format}, Version ${initial.fileVersion}, verschlüsselt=${initial.encrypted}`);
checkEquals('Noch keine Noten in der Datei', Object.keys(initial?.payload?.grades ?? {}).length, 0);

/* ── 3 Klasse, Schüler:innen und Fach anlegen ───────────────────────────── */
await goto('Klassen & Fächer');
await classCard.getByRole('button', { name: 'Klasse anlegen' }).click();
await page.getByLabel('Name der Klasse (z.B. 8c)').fill('8c');
await page.getByRole('button', { name: 'Anlegen', exact: true }).click();

await classCard.getByRole('button', { name: 'Schüler:innen hinzufügen' }).click();
await page.getByLabel(/Ein Name pro Zeile/).fill('Bauer, Anna\nÖztürk, Mert');
await page.getByRole('button', { name: '2 Schüler:innen aufnehmen' }).click();

await subjectCard.getByRole('button', { name: 'Fach anlegen' }).click();
await page.getByLabel('Name des Fachs (z.B. Mathematik)').fill('Mathematik');
await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
await subjectCard.getByLabel('8c').check();

/* ── 4 Eine Note eintragen — und sie in der Datei wiederfinden ──────────── */
await openGrades('Mathematik', '8c');
await semester1.getByRole('button', { name: 'Spalte hinzufügen' }).click();
const bauer = gradeInput('Bauer');
await bauer.fill('2');
await bauer.press('Tab');

const saved = await waitForFile((file) => Object.keys(file.payload?.grades ?? {}).length > 0);
const bauerId = Object.entries(saved?.payload?.students ?? {})
  .find(([, student]) => JSON.stringify(student).includes('Bauer'))?.[0];

check('Die App hat automatisch gespeichert — ohne Zutun',
  Object.keys(saved?.payload?.grades ?? {}).length > 0);
checkEquals('Die eingetragene Note steht in der Datei', JSON.stringify(gradesOf(saved, bauerId)), '[2]');
check('Es ist dieselbe Klasse wie in der Oberfläche',
  JSON.stringify(saved?.payload?.classes ?? {}).includes('8c'));
await page.screenshot({ path: shot('datei-speicherweg.png'), fullPage: true });

/* ── 5 Weitere Änderung landet ebenfalls in der Datei ───────────────────── */
await bauer.fill('1');
await bauer.press('Tab');
const corrected = await waitForFile((file) => JSON.stringify(gradesOf(file, bauerId)) === '[1]');
checkEquals('Auch die Korrektur wird in dieselbe Datei geschrieben',
  JSON.stringify(gradesOf(corrected, bauerId)), '[1]');

/* ── 6 Gegenprobe: Die App hängt wirklich an DIESER Datei ───────────────── */
// Von außen in der Datei eine 4 eintragen. Kommt sie nach dem Neuladen in der Oberfläche
// an, kann die Anzeige nicht aus dem Browser-Speicher stammen.
// Fehlt die Note in der Datei, bleibt die Bearbeitung aus — der Vergleich unten schlägt
// dann fehl, statt den Schritt still zu überspringen.
const external = readTargetFile();
const gradeKey = Object.keys(external?.payload?.grades ?? {}).find((key) => key.startsWith(`${bauerId}:`));
if (gradeKey !== undefined) {
  external.payload.grades[gradeKey] = 4;
  writeFileSync(fileTarget, JSON.stringify(external, null, 2), 'utf8');
}

checkEquals('Nach dem Neuladen wird die gemerkte Datei zur Wiederaufnahme angeboten',
  await openApp(), 'Weiter mit „notentabelle.json“');
checkEquals('Und die App speichert weiter in dieselbe Datei',
  (await sidebar.locator('.save-source').innerText()).trim(), 'notentabelle.json');
await openGrades('Mathematik', '8c');
checkEquals('Die von außen geänderte Note kommt aus der Datei in die Oberfläche',
  await gradeInput('Bauer').inputValue(), '4');

await finish();
