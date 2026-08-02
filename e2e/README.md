# End-to-End-Tests

```bash
npm run e2e                # alle Skripte, eigener Dev-Server auf Port 5180
npm run e2e -- full-flow   # nur passende Skripte
NOTENTABELLE_URL=http://localhost:5173/ npm run e2e   # gegen laufenden Server
```

Läuft auf WSL, Windows nativ und macOS — Vite wird über den Node-Interpreter des laufenden
Prozesses gestartet, keine Shell- oder `.cmd`-Umwege. Screenshots landen in `screenshots/`
(nicht versioniert).

Beim ersten Lauf auf einem neuen Rechner einmalig den Browser holen:

```bash
npx playwright install chromium
```

## Was automatisiert ist

`full-flow.mjs` fährt die Teststrategie des Design-Docs auf dem **Browser-Speicher-Weg**
(Firefox/Safari) in einem echten Chromium: Ersteinrichtung → Klasse und Schüler:innen anlegen →
Fach zuordnen → Noten eintragen → Reload/Persistenz → Sicherung herunterladen → Klasse löschen
und wiederherstellen → Schuljahreswechsel mit Hochstufung.

`file-save.mjs` fährt den **Datei-Weg** (Chrome/Edge) gegen eine echte Datei in einem
temporären Ordner: „Neue Notendatei anlegen" → Datei entsteht auf der Platte → Note eintragen →
Node liest die Datei nach und findet die Note darin → Korrektur landet ebenfalls dort →
Neuladen nimmt die gemerkte Datei wieder auf. Als Gegenprobe wird die Datei von außen geändert;
die Änderung muss nach dem Neuladen in der Oberfläche ankommen. Damit ist belegt, dass die
Anzeige an genau dieser Datei hängt und nicht am Browser-Speicher.

`password.mjs` prüft den **Passwortschutz** an der Datei, nicht an der Oberfläche: Vor dem
Verschlüsseln steht ein verräterischer Schülername im Klartext in der Datei, danach darf er
nirgends mehr auftauchen. Weiter: falsches Passwort wird abgewiesen und die Oberfläche bleibt
gesperrt, richtiges Passwort **und** Wiederherstellungsschlüssel öffnen beide, und die Datei
bleibt danach verschlüsselt.

Jeder Konsolen- oder Seitenfehler der App lässt den Lauf fehlschlagen — auch dann, wenn alle
Interaktionen sichtbar geklappt haben.

## Der Betriebssystem-Dialog — die eine überbrückte Stelle

`showSaveFilePicker()` öffnet ein Fenster des Betriebssystems, kein Element der Seite. Es ist
mit Browser-Automatisierung nicht bedienbar; belegt durch drei Versuche:

* **kopflos** — der Aufruf bricht sofort ab: `AbortError: Failed to execute
  'showSaveFilePicker' on 'Window': The user aborted a request.`
* **mit Fenster** — der Dialog geht auf und wartet endlos auf einen Menschen.
* **DevTools-Protokoll** — `Page.setInterceptFileChooserDialog` sieht den Dialog zwar
  (`Page.fileChooserOpened`), kann ihn aber nur abbrechen: `AbortError: … Intercepted by
  Page.setInterceptFileChooserDialog().` Eine Datei zurückgeben lässt sich ihm nicht;
  `DOM.setFileInputFiles` verlangt einen DOM-Knoten, den es hier nicht gibt.

`file-save.mjs` ersetzt deshalb **nur diesen Dialog** (`installFilePicker` in `harness.mjs`).
Der zurückgegebene Handle ist trotzdem ein echter `FileSystemFileHandle` — sonst würde die App
an Stellen scheitern, die mitgetestet werden sollen: `queryPermission()` muss antworten, und
`persistHandle()` legt den Handle per strukturiertem Klonen in IndexedDB ab, woran ein
handgebautes Objekt mit `DataCloneError` scheitert. Echt bleiben damit: Freigabeprüfung,
Handle-Persistenz, `FileBackend`, Autosave-Entprellung, Dateiformat und die Datei selbst.

## Was Handarbeit bleibt

Nur das, was ohne echten Dialog bzw. echtes Browserprofil nicht zu haben ist:

1. **Dialog selbst** — „Neue Notendatei anlegen" in Chrome oder Edge: Der Speicherort-Dialog
   muss aufgehen, `notentabelle.json` vorschlagen und den Dateityp „Notentabelle-Datei"
   anbieten. Danach steht unten links der Dateiname, nicht „Browser-Speicher".
2. **Freigabe nach Browser-Neustart** — Note eintragen, „Alles gespeichert" abwarten, Browser
   **komplett** schließen (alle Fenster), neu öffnen. Es muss „Weiter mit „notentabelle.json""
   angeboten werden; Chrome fragt die Dateiberechtigung erneut ab, und nach der Freigabe ist
   die Note da.

Der Passwortschutz stand hier früher als dritter Punkt — er läuft ganz in der App ab und wird
seit `password.mjs` automatisch geprüft.

## Neues Prüfskript

Datei in diesem Ordner als `*.mjs` anlegen; `run-all.mjs` findet sie selbst.

```js
import { shot, startE2E, ui } from './harness.mjs';
const { page, check, checkEquals, openApp, waitSaved, finish } = await startE2E();
const { sidebar, goto, openGrades, gradeInput } = ui(page);
await openApp();
// … fahren und prüfen …
await finish();
```

Stolperstellen:

- `waitSaved()` vor jedem Reload — der Autosave ist um 1 s entprellt. Wo es auf die Datei
  ankommt, besser die Datei pollen als die Oberfläche: `waitSaved()` kehrt zurück, bevor
  React überhaupt auf „Speichert …" umgeschaltet hat.
- Locator mit `exact: true`, sonst greift „Anlegen" auch „Klasse anlegen" (Strict Mode).
- Dialog-Buttons liegen über einem `.modal-backdrop`; der Auslöser dahinter ist in dem
  Moment nicht klickbar.
- Screenshots nur über `shot(name)` — ein durchgereichter WSL-Pfad landet unter `C:\…`
  (Playwright läuft unter Windows-Node) und der Lauf meldet trotzdem Erfolg.
