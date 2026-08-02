# Notentabelle

**Privates Coding-Projekt** von mawi — abweichend von der globalen PO-Rolle gilt hier: Code schreiben und ändern ist ausdrücklich erlaubt und der Normalfall.

## Isolationsregeln

- Nichts aus diesem Projekt darf von anderen Projekten in `IdeaProjects` genutzt oder referenziert werden.
- Lesender Zugriff aus diesem Projekt auf andere Repos ist erlaubt.
- Dokumentation bleibt in diesem Repo (kein Mastermind-Hub).

## Was ist das?

Local-First-Webanwendung zur Notenverwaltung für Lehrkräfte: Noten 1–6 eintragen, Schnitte werden automatisch berechnet (Notenart-Ø → gewichtete Halbjahresnote → Jahresnote), Archiv vergangener Schuljahre. Keine Server: Daten liegen in einer lokalen Datei des Nutzers (File System Access API, Fallback Download/Upload), Auslieferung über GitHub Pages.

- Design-Doc: `docs/superpowers/specs/2026-07-11-notentabelle-neuaufbau-design.md`
- Alte Referenz-Implementierung (nur lesen, nicht erweitern): `Alte Umsetzung/notentabelle_alt.html`

## Stack & Befehle

React + TypeScript + Vite, Tests mit Vitest.

```bash
npm run dev      # Dev-Server (localhost — nötig für File System Access API)
npm test         # Vitest
npm run build    # Produktionsbuild
npm run e2e      # End-to-End im echten Browser (Playwright, eigener Dev-Server auf 5180)
```

`npm run e2e -- <filter>` läuft nur passende Skripte. Beide Speicherwege sind abgedeckt:
`full-flow.mjs` den Browser-Speicher (Firefox/Safari), `file-save.mjs` den Datei-Weg gegen
eine echte Datei. Unautomatisierbar ist allein der Betriebssystem-Dialog von
`showSaveFilePicker` — was dadurch Handarbeit bleibt, steht in `e2e/README.md`.

## Architektur-Regeln

- `src/domain/` ist framework-frei und vollständig getestet — alle Berechnungs- und Fachlogik hierhin, nie in Komponenten
- Notenwerte: 1–6, Dezimal, Eingabe mit Komma oder Punkt; Ergebnisse auf 2 Nachkommastellen
- Spalten-Metadaten (Titel/Datum) zentral in `AppData.columns`, nie pro Schüler dupliziert
- Keine `alert()`/`confirm()` — eigene Modal-/Toast-Komponenten
- Abhängigkeiten minimal halten (aktuell: react, react-dom, jspdf)
- Komponententests laufen unter jsdom: `/** @vitest-environment jsdom */` als erste Zeile der
  Testdatei (Default bleibt `node`, damit die Domain-Tests schnell bleiben). Gerendert wird
  über den echten `AppProvider` mit Attrappen-`StorageBackend` — siehe `src/views/GradesView.test.tsx`
