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

**Dateipfade an den Harness sind Windows-Pfade.** Playwright läuft unter Windows-Node, also
wird `/tmp/x/bild.png` zu `C:\tmp\x\bild.png` umgedeutet — der Lauf meldet
`ALLE CHECKS BESTANDEN`, und die Datei liegt nirgends. Der Fehler ist still: Es gibt keine
Fehlermeldung, nur ein fehlendes Ergebnis. Deshalb im Skript immer in den Repo-Ordner
schreiben und erst danach mit WSL-Mitteln kopieren:

```js
await page.screenshot({ path: shot('name.png') });   // shot() → e2e/screenshots/
```
```bash
cp e2e/screenshots/name.png /pfad/im/wsl/ziel.png
```

Gegenprobe bei Zweifeln, welcher Interpreter läuft:
`'/mnt/c/Program Files/nodejs/node.exe' -e "console.log(process.platform)"` → `win32`.

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

### 3. Nur der Datei-Dialog ist unautomatisierbar, nicht der Datei-Weg

`showSaveFilePicker()` öffnet ein Fenster des Betriebssystems: kopflos bricht es sofort mit
`AbortError` ab, mit Fenster wartet es endlos, und über das DevTools-Protokoll
(`Page.setInterceptFileChooserDialog`) lässt es sich nur abbrechen, nicht beantworten.

Der Dialog ist aber genau ein Funktionsaufruf — alles dahinter ist prüfbar:

```js
startE2E()                          // Browser-Speicher-Weg (Firefox/Safari)
startE2E({ fileTarget: '/pfad/notentabelle.json' })   // Datei-Weg gegen echte Datei
```

`installFilePicker` in `harness.mjs` überbrückt den Dialog mit einem **echten**
`FileSystemFileHandle` aus dem Origin Private File System — nötig, weil die App
`queryPermission()` aufruft und den Handle per strukturiertem Klonen in IndexedDB ablegt;
ein handgebautes Objekt scheitert dort an `DataCloneError`. Echt bleiben: Freigabeprüfung,
Handle-Persistenz, `FileBackend`, Autosave-Entprellung, Dateiformat und die Datei selbst.

Grenze: Weil `getFile`/`createWritable` für diese eine Datei am Prototyp umgehängt sind,
belegt der Test die Logik der App rund um den Handle — nicht das Schreiben durch Chromium.
Was ohne echten Dialog bzw. echtes Browserprofil bleibt, steht als 3-Punkte-Checkliste in
`e2e/README.md`.

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
