// Gemeinsames Gerüst der E2E-Skripte: Browser-Start, Fehlererfassung, Prüf-Protokoll,
// Abschluss mit Exit-Code.
//
// Scharfe Regel: JEDER Konsolen- oder Seitenfehler der App lässt das Skript fehlschlagen —
// ein React-Fehler, der die Oberfläche nicht sichtbar zerlegt, soll nicht durchrutschen.
//
// Speicherweg: Die File System Access API öffnet einen echten Betriebssystem-Dialog und ist
// deshalb nicht automatisierbar. Die Skripte fahren darum den Fallback-Weg (Browser-Speicher),
// den Firefox- und Safari-Nutzer:innen ohnehin bekommen — erzwungen, indem
// `showSaveFilePicker` vor dem Laden entfernt wird. Der Datei-Weg bleibt Handarbeit.
import { mkdirSync } from 'node:fs';
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

export async function startE2E() {
  const errors = [];
  let failures = 0;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  // Ohne showSaveFilePicker meldet supportsFileSystemAccess() false → Browser-Speicher-Weg
  await context.addInitScript(() => {
    delete window.showSaveFilePicker;
    delete window.showOpenFilePicker;
  });

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
  async function openApp() {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const startButton = page.getByRole('button', { name: 'Im Browser starten' });
    if (await startButton.isVisible().catch(() => false)) await startButton.click();
    await page.getByRole('navigation').waitFor();
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
