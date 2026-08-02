---
name: running-notentabelle
description: Use when starting, driving, screenshotting or end-to-end testing the Notentabelle app, or when a dev server started from WSL is unreachable via curl/localhost
---

# Notentabelle starten und fahren

Die App über den E2E-Harness fahren, nicht von Hand starten — ein direkt gestarteter
Dev-Server ist aus der Claude-Shell nicht erreichbar (Fallstrick 1).

```bash
npm run e2e                # Dev-Server auf 5180 + alle Skripte, Exit-Code 0/1
npm run e2e -- full-flow   # nur passende Skripte
```

Einmalig je Rechner: `npx playwright install chromium`.

## 1. `node`/`npm` sind Windows-Binaries

Kein Linux-`node` (`command -v node` → leer). Folgen:

- Vite bindet Windows-seitig — `curl localhost:PORT` aus WSL läuft ins Leere, auch wenn
  Vite „ready" meldet. `pkill`/`ps` sehen die Prozesse ebenfalls nicht.
- Stacktrace mit `file:///C:/…` ist das Erkennungszeichen.
- **Pfade an den Harness sind Windows-Pfade:** `/tmp/x/bild.png` → `C:\tmp\x\bild.png`.
  Der Lauf meldet `ALLE CHECKS BESTANDEN`, die Datei liegt nirgends — stiller Fehler
  ohne Meldung.

Deshalb im Skript in den Repo-Ordner schreiben und erst danach mit WSL-Mitteln kopieren:

```js
await page.screenshot({ path: shot('name.png') });   // → e2e/screenshots/
```
```bash
cp e2e/screenshots/name.png /ziel/im/wsl.png
```

Aus demselben Grund startet `run-all.mjs` Vite über `process.execPath` +
`vite/bin/vite.js`, nie über einen `.cmd`-Shim — sonst läuft es nur noch auf einer der
drei Zielplattformen.

## 2. Windows-Werkzeuge aus WSL schweigen statt zu meckern

`netstat.exe` liefert OEM-Codepage (`file -` → „Non-ISO extended-ASCII"). GNU grep hält das
für binär und gibt **gar nichts** aus: `grep -c "445"` druckt nichts und endet mit 1,
obwohl Treffer da sind (`grep -ac` findet sie). Wer so einen Port prüft, hält den Server für
tot. Ebenso stumpf: `taskkill /FI "WINDOWTITLE eq *"` → `FEHLER: Der Suchfilter wurde nicht
erkannt.` Belastbar ist PowerShell:

```bash
powershell.exe -NoProfile -Command "(Get-NetTCPConnection -State Listen -LocalPort 5180 -EA SilentlyContinue | Measure-Object).Count"
```

**Nie pauschal `node.exe` killen** — es laufen Dev-Server anderer Repos (z.B. `raumplaner`
auf 5199). Immer über die Kommandozeile filtern:

```bash
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*notentabelle*vite*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
```

Notentabelle nutzt Port 5180, um 5173 und 5199 freizuhalten.

## 3. Nur der Datei-Dialog ist unautomatisierbar, nicht der Datei-Weg

`showSaveFilePicker()` ist ein Fenster des Betriebssystems: kopflos `AbortError`, mit
Fenster endloses Warten, per DevTools-Protokoll nur abbrechbar. Es ist aber genau ein
Funktionsaufruf — alles dahinter ist prüfbar:

```js
startE2E()                                            // Browser-Speicher (Firefox/Safari)
startE2E({ fileTarget: '/pfad/notentabelle.json' })   // Datei-Weg, echte Datei
```

`installFilePicker` überbrückt nur den Dialog, mit einem **echten**
`FileSystemFileHandle` (OPFS) — ein handgebautes Objekt scheitert an `persistHandle`
(`DataCloneError`). Echt bleiben Freigabeprüfung, Handle-Persistenz, `FileBackend`,
Autosave und Dateiformat. Grenze: belegt ist die Logik der App um den Handle, nicht
Chromiums Schreiben. Der Rest steht als 3-Punkte-Checkliste in `e2e/README.md`.

## 4. `npm ci` lädt keine Playwright-Browser

Diese npm-Version führt Install-Skripte nicht aus. Auf frischem Rechner sonst
„Executable doesn't exist" → `npx playwright install chromium`. In CI ist das erwünscht:
Der Deploy-Workflow braucht keine Browser.

## Screenshots ansehen

`e2e/screenshots/` (nicht versioniert). Grüne Checks bei leerem Bild sind ein Fehlstart —
das Bild mit `Read` öffnen.

## Neues Prüfskript

Muster und Stolperstellen beim Schreiben: Abschnitt „Neues Prüfskript" in `e2e/README.md`.
