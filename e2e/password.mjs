// Passwortschutz: Datei verschlüsseln, danach mit Passwort UND mit
// Wiederherstellungsschlüssel wieder öffnen.
//
// Der Nachweis läuft über die Datei auf der Platte, nicht über die Oberfläche: Vor dem
// Verschlüsseln steht ein verräterischer Name im Klartext darin, danach darf er nirgends
// mehr auftauchen. Eine Oberfläche, die „verschlüsselt" behauptet, während die Datei lesbar
// bleibt, fiele hier auf.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startE2E, ui } from './harness.mjs';

const BASE_URL = process.env.NOTENTABELLE_URL ?? 'http://localhost:5180/';
const workDir = mkdtempSync(join(tmpdir(), 'notentabelle-pw-'));
const fileTarget = join(workDir, 'notentabelle.json');

/** Kommt im Klartext in der Datei vor — und darf nach dem Verschlüsseln nicht mehr. */
const SECRET_NAME = 'Geheimnis Mustermann';
const PASSWORD = 'sehr-geheim-123';

const { page, check, checkEquals, openApp, waitSaved, finish } = await startE2E({ fileTarget });
const { classCard, goto } = ui(page);

const rawFile = () => {
  try {
    return readFileSync(fileTarget, 'utf8');
  } catch {
    return '';
  }
};

/** Wartet, bis die Datei auf der Platte die Bedingung erfüllt (Autosave ist entprellt). */
async function waitForFile(predicate, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const text = rawFile();
    if (text !== '' && predicate(text)) return text;
    if (Date.now() >= deadline) return text;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Neu laden und die gemerkte Datei wählen — endet auf der Entsperr-Maske. */
async function reopenLocked() {
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Weiter mit / }).click();
  await page.getByLabel('Passwort oder Wiederherstellungsschlüssel').waitFor();
}

async function unlock(secret) {
  await page.getByLabel('Passwort oder Wiederherstellungsschlüssel').fill(secret);
  await page.getByRole('button', { name: 'Entsperren' }).click();
}

/* ── 1 Datei anlegen und etwas Schützenswertes hineinschreiben ──────────── */
await openApp();
await goto('Klassen & Fächer');
await classCard.getByRole('button', { name: 'Klasse anlegen' }).click();
await page.getByLabel('Name der Klasse (z.B. 8c)').fill('8c');
await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
await classCard.getByRole('button', { name: 'Schüler:innen hinzufügen' }).click();
await page.getByLabel(/Ein Name pro Zeile/).fill(SECRET_NAME);
await page.getByRole('button', { name: 'Aufnehmen', exact: true }).click();

await waitForFile((text) => text.includes(SECRET_NAME));
check('Unverschlüsselt steht der Name im Klartext in der Datei', rawFile().includes(SECRET_NAME));

/* ── 2 Passwortschutz einrichten ────────────────────────────────────────── */
await goto('Einstellungen');
await page.getByRole('button', { name: 'Passwort festlegen …' }).click();
await page.getByLabel(/^Passwort \(mindestens/).fill(PASSWORD);
await page.getByLabel('Passwort wiederholen').fill(PASSWORD);
await page.getByRole('button', { name: 'Verschlüsseln' }).click();

const recoveryKey = (await page.locator('.recovery-key').innerText()).trim();
check('Wiederherstellungsschlüssel wird einmalig angezeigt',
  /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(recoveryKey), recoveryKey);
await page.getByRole('button', { name: 'Ich habe den Schlüssel gesichert' }).click();

/* ── 3 Die Datei auf der Platte ist wirklich verschlüsselt ──────────────── */
await waitSaved();
const encrypted = await waitForFile((text) => !text.includes(SECRET_NAME));
check('Datei ist als verschlüsselt gekennzeichnet', JSON.parse(encrypted).encrypted === true);
check('Der Name steht nicht mehr lesbar in der Datei', !encrypted.includes(SECRET_NAME));

/* ── 4 Ohne Passwort kommt niemand hinein ───────────────────────────────── */
await reopenLocked();
check('Beim Öffnen wird das Passwort verlangt',
  await page.getByRole('heading', { name: 'Datei entsperren' }).isVisible());

await unlock('falsches-passwort');
await page.locator('.start-error').waitFor();
check('Falsches Passwort wird abgewiesen',
  (await page.locator('.start-error').innerText()).includes('nicht richtig'));
check('Und die Oberfläche bleibt gesperrt', !(await page.getByRole('navigation').isVisible()));

/* ── 5 Das richtige Passwort öffnet die Datei ───────────────────────────── */
await unlock(PASSWORD);
await page.getByRole('navigation').waitFor();
await goto('Klassen & Fächer');
check('Nach dem Entsperren sind die Daten da',
  await classCard.getByText(SECRET_NAME).isVisible());

/* ── 6 Der Wiederherstellungsschlüssel öffnet sie ebenso ────────────────── */
await reopenLocked();
await unlock(recoveryKey);
await page.getByRole('navigation').waitFor();
await goto('Klassen & Fächer');
check('Auch der Wiederherstellungsschlüssel entsperrt',
  await classCard.getByText(SECRET_NAME).isVisible());
checkEquals('Und die Datei bleibt danach verschlüsselt',
  JSON.parse(rawFile()).encrypted, true);

await finish();
