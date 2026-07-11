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
```

## Architektur-Regeln

- `src/domain/` ist framework-frei und vollständig getestet — alle Berechnungs- und Fachlogik hierhin, nie in Komponenten
- Notenwerte: 1–6, Dezimal, Eingabe mit Komma oder Punkt; Ergebnisse auf 2 Nachkommastellen
- Spalten-Metadaten (Titel/Datum) zentral in `AppData.columns`, nie pro Schüler dupliziert
- Keine `alert()`/`confirm()` — eigene Modal-/Toast-Komponenten
- Abhängigkeiten minimal halten (aktuell: react, react-dom, jspdf)
