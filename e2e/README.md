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

`full-flow.mjs` fährt die Teststrategie des Design-Docs in einem echten Chromium:
Ersteinrichtung → Klasse und Schüler:innen anlegen → Fach zuordnen → Noten eintragen →
Reload/Persistenz → Sicherung herunterladen → Klasse löschen und wiederherstellen →
Schuljahreswechsel mit Hochstufung.

Jeder Konsolen- oder Seitenfehler der App lässt den Lauf fehlschlagen — auch dann, wenn alle
Interaktionen sichtbar geklappt haben.

## Was Handarbeit bleibt

**Der Datei-Weg über die File System Access API.** `showSaveFilePicker()` öffnet einen
Betriebssystem-Dialog, den keine Browser-Automatisierung bedienen kann. Die Skripte entfernen
`showSaveFilePicker` deshalb vor dem Laden und fahren den Browser-Speicher-Weg — den, den
Firefox- und Safari-Nutzer:innen ohnehin bekommen.

Für den Datei-Weg in Chrome oder Edge diese Checkliste von Hand durchgehen:

1. **Anlegen** — „Neue Notendatei anlegen", Datei speichern. Unten links muss der Dateiname
   stehen (nicht „Browser-Speicher").
2. **Automatisches Speichern** — eine Note eintragen, kurz warten, bis „Alles gespeichert"
   erscheint. Die Datei im Dateimanager prüfen: Zeitstempel aktuell, Inhalt enthält die Note.
3. **Wiederaufnahme** — Tab schließen, App neu öffnen. Es muss „Weiter mit „<Dateiname>""
   angeboten werden; ein Klick öffnet die Daten ohne erneute Dateiauswahl.
4. **Freigabe entzogen** — Browser komplett neu starten, App öffnen, „Weiter mit …" klicken.
   Chrome fragt die Berechtigung erneut ab; nach der Freigabe müssen die Daten da sein.
5. **Vorhandene Datei öffnen** — „Vorhandene Notendatei öffnen" auf derselben Datei.
6. **Passwortschutz** — in den Einstellungen ein Passwort setzen, Wiederherstellungsschlüssel
   notieren, App neu laden: Die Passwortabfrage muss kommen. Beide Wege (Passwort und
   Schlüssel) einmal durchspielen.
