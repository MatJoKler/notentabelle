// Gemeinsames Gerüst der E2E-Skripte: Browser-Start, Fehlererfassung, Prüf-Protokoll,
// Abschluss mit Exit-Code.
//
// Scharfe Regel: JEDER Konsolen- oder Seitenfehler der App lässt das Skript fehlschlagen —
// ein React-Fehler, der die Oberfläche nicht sichtbar zerlegt, soll nicht durchrutschen.
//
// Speicherweg: `startE2E()` ohne Argument fährt den Browser-Speicher-Weg (Firefox/Safari),
// erzwungen durch Entfernen von `showSaveFilePicker`. Mit `startE2E({ fileTarget })` läuft
// stattdessen der Datei-Weg gegen eine echte Datei auf der Platte — siehe `installFilePicker`.
import { mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE_URL = process.env.NOTENTABELLE_URL ?? 'http://localhost:5180/';
const screenshotDir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');

/** Absoluter Pfad für einen Screenshot, unabhängig vom Arbeitsverzeichnis. */
export function shot(name) {
  mkdirSync(screenshotDir, { recursive: true });
  return join(screenshotDir, name);
}

/** Wegweiser durch die Oberfläche — von mehreren Prüfskripten genutzt. */
export function ui(page) {
  const sidebar = page.locator('.sidebar');
  const card = (heading) =>
    page.locator('.card').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
  const semester1 = page
    .locator('.semester-block')
    .filter({ has: page.getByRole('heading', { name: '1. Halbjahr' }) });

  return {
    sidebar,
    semester1,
    classCard: card('Klassen'),
    subjectCard: card('Fächer'),
    /** Hauptnavigation in der Seitenleiste. */
    goto: (name) => sidebar.getByRole('button', { name, exact: true }).click(),
    /** Notenblatt eines Fachs in einer Klasse, Reiter „Klassenarbeiten". */
    async openGrades(subject, className) {
      await sidebar.getByRole('button', { name: subject, exact: true }).click();
      await sidebar.getByRole('button', { name: className, exact: true }).click();
      await page.getByRole('tab', { name: 'Klassenarbeiten' }).click();
    },
    /** Erstes Notenfeld in der Zeile einer Schülerin/eines Schülers im 1. Halbjahr. */
    gradeInput: (name) =>
      semester1.getByRole('row', { name: new RegExp(name) }).getByRole('textbox').first(),
  };
}

/**
 * Ersetzt NUR den Betriebssystem-Dialog von `showSaveFilePicker`/`showOpenFilePicker` —
 * alles dahinter bleibt echt und wird mitgetestet.
 *
 * Warum überhaupt ein Ersatz: Der Auswahldialog ist ein Fenster des Betriebssystems, kein
 * Teil der Seite. Kopflos bricht Chromium ihn sofort mit `AbortError` ab, mit Fenster wartet
 * er endlos auf einen Menschen, und über das DevTools-Protokoll lässt er sich zwar abfangen
 * (`Page.setInterceptFileChooserDialog`), aber nur abbrechen — eine Datei zurückgeben kann
 * man ihm nicht. Genau diese eine Stelle wird hier überbrückt.
 *
 * Der zurückgegebene Handle ist trotzdem ein echter `FileSystemFileHandle` (aus dem
 * Origin Private File System). Das ist wichtig, weil die App mehr mit ihm macht, als nur zu
 * schreiben: `queryPermission()` muss antworten, und `persistHandle()` legt ihn per
 * strukturiertem Klonen in IndexedDB ab — ein handgebautes Objekt mit Methoden scheitert
 * dort an `DataCloneError`. Gelesen und geschrieben wird über zwei Bindings in die echte
 * Datei unter `fileTarget`; gepatcht wird am Prototyp, damit auch der aus IndexedDB
 * zurückgeholte Handle nach einem Reload noch auf dieselbe Datei zeigt.
 */
async function installFilePicker(context, fileTarget) {
  const fileName = fileTarget.split(/[\\/]/).pop();

  await context.exposeBinding('__ntReadFile', async () => {
    try {
      return await readFile(fileTarget, 'utf8');
    } catch {
      return null; // Datei existiert noch nicht
    }
  });
  await context.exposeBinding('__ntWriteFile', (_source, text) => writeFile(fileTarget, text, 'utf8'));

  await context.addInitScript((name) => {
    const proto = FileSystemFileHandle.prototype;
    const nativeGetFile = proto.getFile;
    const nativeCreateWritable = proto.createWritable;
    const isTarget = (handle) => handle.name === name;

    proto.getFile = async function () {
      if (!isTarget(this)) return nativeGetFile.call(this);
      const text = await window.__ntReadFile();
      return new File([text ?? ''], name, { type: 'application/json' });
    };

    proto.createWritable = async function (options) {
      const writable = await nativeCreateWritable.call(this, options);
      if (!isTarget(this)) return writable;
      const handle = this;
      const nativeClose = writable.close.bind(writable);
      // Erst den echten Stream schließen, dann das Ergebnis in die echte Datei spiegeln.
      writable.close = async () => {
        await nativeClose();
        await window.__ntWriteFile(await (await nativeGetFile.call(handle)).text());
      };
      return writable;
    };

    async function pickTargetFile() {
      const dir = await navigator.storage.getDirectory();
      const handle = await dir.getFileHandle(name, { create: true });
      // Ein echter Dialog legt die Datei sofort an — hier genauso.
      if ((await window.__ntReadFile()) === null) await window.__ntWriteFile('');
      return handle;
    }

    window.showSaveFilePicker = pickTargetFile;
    window.showOpenFilePicker = async () => [await pickTargetFile()];
  }, fileName);
}

/**
 * @param {{ fileTarget?: string }} [options] `fileTarget`: absoluter Pfad der Notendatei —
 *   setzt den Datei-Weg statt des Browser-Speicher-Wegs.
 */
export async function startE2E({ fileTarget } = {}) {
  const errors = [];
  let failures = 0;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  if (fileTarget) {
    await installFilePicker(context, fileTarget);
  } else {
    // Ohne showSaveFilePicker meldet supportsFileSystemAccess() false → Browser-Speicher-Weg
    await context.addInitScript(() => {
      delete window.showSaveFilePicker;
      delete window.showOpenFilePicker;
    });
  }

  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  const check = (name, ok, detail) => {
    console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
    if (!ok) failures++;
  };

  /** Wie `check`, aber vergleicht zwei Werte und zeigt bei Abweichung beide an. */
  const checkEquals = (name, actual, expected) =>
    check(name, actual === expected, actual === expected ? undefined : `erwartet „${expected}", gelesen „${actual}"`);

  /**
   * Lädt die App neu und startet in den Browser-Speicher — genau das, was eine Lehrkraft
   * beim zweiten Besuch erlebt. Beim ersten Aufruf legt das die Datenquelle an.
   */
  /**
   * Lädt die App neu und wählt auf dem Startbildschirm die Datenquelle.
   * @returns Beschriftung der geklickten Schaltfläche — damit ein Test belegen kann, auf
   *   welchem Weg er hereingekommen ist (neu angelegt oder gemerkte Datei wiederaufgenommen).
   */
  async function openApp() {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.locator('.start-actions').waitFor();
    let clicked = null;
    // „Weiter mit …" vor „Neue Notendatei anlegen": Der zweite Besuch soll die gemerkte
    // Datei wiederaufnehmen, nicht eine neue auswählen.
    for (const name of ['Im Browser starten', /^Weiter mit /, 'Neue Notendatei anlegen']) {
      const button = page.getByRole('button', { name });
      if (await button.isVisible().catch(() => false)) {
        clicked = (await button.innerText()).trim();
        await button.click();
        break;
      }
    }
    await page.getByRole('navigation').waitFor();
    return clicked;
  }

  /**
   * Wartet, bis der entprellte Autosave (1 s) durch ist. Ohne das wäre jeder Reload-Test
   * ein Wettlauf gegen den Timer.
   */
  async function waitSaved() {
    await page.waitForFunction(
      () => document.querySelector('.save-status')?.textContent === 'Alles gespeichert',
      undefined,
      { timeout: 10_000 },
    );
  }

  async function finish() {
    check('Keine Konsolen-/Seitenfehler', errors.length === 0, errors.join(' | '));
    await browser.close();
    console.log(failures === 0 ? 'ALLE CHECKS BESTANDEN' : `${failures} CHECK(S) FEHLGESCHLAGEN`);
    process.exitCode = failures === 0 ? 0 : 1;
  }

  return { browser, context, page, check, checkEquals, openApp, waitSaved, finish };
}
