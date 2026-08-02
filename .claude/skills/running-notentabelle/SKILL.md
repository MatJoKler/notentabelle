---
name: running-notentabelle
description: Use when starting, driving, screenshotting or end-to-end testing the Notentabelle app, or when a dev server started from WSL is unreachable via curl/localhost
---

# Notentabelle starten und fahren

## Überblick

Die App wird über den E2E-Harness gefahren, nicht von Hand gestartet. Ein direkt
gestarteter Dev-Server ist aus der Claude-Shell **nicht erreichbar** — siehe Fallstrick 1.

```bash
npm run e2e                # Dev-Server auf 5180 + alle Skripte, Exit-Code 0/1
npm run e2e -- full-flow   # nur passende Skripte
```

Einmalig auf einem neuen Rechner: `npx playwright install chromium`.

## Fallstricke dieser Umgebung

### 1. `node`/`npm` sind Windows-Binaries, aus WSL aufgerufen

Es gibt kein Linux-`node` (`command -v node` → leer; `npm` liegt unter
`/mnt/c/Program Files/nodejs/npm`). Folgen:

- Vite bindet seinen Port **auf der Windows-Seite**. `curl http://localhost:PORT` aus der
  WSL-Shell läuft ins Leere — auch wenn Vite „ready" meldet.
- Ein per `run_in_background` gestarteter Server ist aus späteren Shell-Aufrufen erst recht
  nicht erreichbar.
- `pkill`/`ps` aus WSL sehen diese Prozesse nicht. Nutze
  `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\""`.
- Stacktrace mit `file:///C:/…` ist das Erkennungszeichen.

Deshalb startet `e2e/run-all.mjs` Vite über `process.execPath` und
`node_modules/vite/bin/vite.js` — nie über einen `.cmd`-Shim. Diesen Weg beibehalten, sonst
läuft es nur noch auf einer der drei Zielplattformen.

### 2. Niemals pauschal `node.exe` killen

Auf diesem Rechner laufen Dev-Server anderer Repos (z.B. `raumplaner` auf Port 5199). Immer
über die Kommandozeile filtern:

```bash
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*notentabelle*vite*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
```

Notentabelle nutzt bewusst Port 5180, um 5173 und 5199 freizuhalten.

### 3. Der Datei-Weg ist nicht automatisierbar

`showSaveFilePicker()` öffnet einen Betriebssystem-Dialog. Keine Browser-Automatisierung
bedient ihn. `e2e/harness.mjs` entfernt die Funktion vor dem Laden, wodurch die App den
Browser-Speicher-Weg nimmt (der reale Firefox/Safari-Pfad).

Wer den Datei-Weg prüfen will, geht die Checkliste in `e2e/README.md` **von Hand** durch.
Nicht versuchen, den Dialog zu automatisieren — es geht nicht.

### 4. `npm ci` lädt keine Playwright-Browser

Die npm-Version hier führt Install-Skripte nicht aus (`allow-scripts`-Warnung). Auf einem
frischen Rechner scheitert `npm run e2e` sonst mit „Executable doesn't exist" —
`npx playwright install chromium` nachholen. In CI ist das erwünscht: Der Deploy-Workflow
braucht keine Browser.

## Screenshot ansehen, nicht nur Checks lesen

`e2e/screenshots/` (nicht versioniert). Grüne Checks bei leerem Bild sind ein Fehlstart —
das Bild mit `Read` öffnen.

## Neues Prüfskript anlegen

Datei in `e2e/` als `*.mjs`; `run-all.mjs` findet sie selbst. Muster:

```js
import { shot, startE2E } from './harness.mjs';
const { page, check, checkEquals, openApp, waitSaved, finish } = await startE2E();
await openApp();
// … fahren und prüfen …
await finish();
```

- `waitSaved()` vor jedem Reload — der Autosave ist um 1 s entprellt.
- Locator mit `exact: true`, sonst greift „Anlegen" auch „Klasse anlegen" (Strict Mode).
- Dialog-Buttons liegen über einem `.modal-backdrop`; der Auslöser dahinter ist nicht klickbar.
