# Design: Notentabelle — Kompletter Neuaufbau

Datum: 2026-07-11 · Autor: mawi (mit Claude) · Status: Freigegeben

## Problem & Ziel

Die bestehende Notenverwaltung (`Alte Umsetzung/notentabelle_alt.html`, 4.578 Zeilen Single-File-Vanilla-JS) speichert ausschließlich im localStorage — Browserdaten löschen bedeutet Totalverlust — und ist als Monolith nicht wartbar. Sie wird komplett neu aufgesetzt.

**Ziel:** Moderne, browserbasierte, OS-unabhängige Notenverwaltung für Lehrkräfte mit garantierter Datenspeicherung ohne eigenen Server. Nutzer sind technisch wenig versierte Dritte — Bedienung: Link öffnen, fertig.

## Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Funktionsumfang | Voller Umfang der alten App | Bewährte Features, nichts verlieren |
| Speicherung | File System Access API: echte lokale Datei mit Auto-Save; Fallback Download/Upload (Firefox/Safari) | „Definitive Speicherung ohne Server“ — Datei kann in OneDrive/Nextcloud-Ordner liegen |
| Verteilung | GitHub Pages (kostenlos, öffentliches Repo) | Nutzer brauchen nur eine URL, kein Git-Wissen |
| Tech-Stack | React + TypeScript + Vite, Vitest | Reaktive Tabellen, Typsicherheit, Standard-Ökosystem |
| Architektur | Local-First SPA | Host liefert nur Code; alle Notendaten bleiben beim Nutzer (Datenschutz) |

## Fachliche Anforderungen

- **Notensystem:** Deutsche Noten 1–6, Dezimalwerte erlaubt (Komma oder Punkt), Validierung 1 ≤ x ≤ 6
- **Struktur:** Fächer → zugeordnete Klassen → Schüler; 2 Halbjahre; 3 Notenarten: Klassenarbeiten (KA), Tests, Mündlich; beliebig viele Notenspalten je Notenart mit Titel + Datum
- **Berechnung** (2 Nachkommastellen):
  - Ø je Notenart = arithmetisches Mittel der gültigen Werte
  - Halbjahresnote = gewichtetes Mittel der vorhandenen Notenart-Durchschnitte; fehlende Komponenten fallen samt Gewicht weg
  - Jahresnote = (HJ1 + HJ2) / 2; ist nur ein Halbjahr vorhanden, zählt dieses
  - Gewichtung pro Fach: Modus `percent` (0–100, Summe 100) oder `factor` (1–5); Default 50/25/25 percent
- **Features:** Fächer-/Klassen-/Schülerverwaltung inkl. Klassenwechsel mit Notenübernahme; Noteneingabe mit Tastaturnavigation (Enter/Tab) und Live-Schnitten; Dashboard (Statistiken, Top/Flop 3, Notenverteilung); Fachansicht; Schülerakte mit Suche + Gefährdungsfilter (Ø≥4,5 gefährdet, Ø≥5,0 kritisch); Notizen pro Schüler (Allgemein/Elterngespräch/Strafarbeit); Archiv mit Schuljahreswechsel (Hochstufung 8c→9c, Abschluss ab Stufe 10, Read-only); Vorjahresvergleich mit Trend; PDF-Export + Druckansicht; JSON-Export/Import inkl. Alt-Format-Migration; Login mit Passwort, Sicherheitsfrage + Recovery-Key, verschlüsselte Speicherung
- **Verbesserungen ggü. alt:** Spalten-Metadaten zentral pro Spalte statt redundant pro Schüler; native WebCrypto AES-GCM statt CryptoJS-CDN; eigene Modals/Toasts statt `alert()`/`confirm()`

## Datenmodell

```ts
interface AppData {
  version: 1;
  schoolYear: string;                    // "2026/27"
  classes: Record<ClassId, { name: string; studentIds: StudentId[] }>;
  students: Record<StudentId, { name: string; classId: ClassId }>;
  subjects: Record<SubjectId, {
    name: string;
    assignedClassIds: ClassId[];
    weights: { ka: number; tests: number; muendlich: number; mode: 'percent' | 'factor' };
  }>;
  columns: Record<ColumnId, {            // zentral, nicht pro Schüler
    subjectId: SubjectId; classId: ClassId;
    semester: 1 | 2; category: 'ka' | 'test' | 'muendlich';
    title: string; date: string | null; order: number;
  }>;
  grades: Record<`${StudentId}:${ColumnId}`, number>;
  notes: Record<StudentId, Array<{ id: string; type: 'general' | 'parent' | 'punishment'; text: string; timestamp: string }>>;
  archives: Record<string, ArchivedYear>; // Snapshot je Schuljahr
  security: { passwordHash: string | null; securityQuestion: string | null; securityAnswerHash: string | null; recoveryKeyHash: string | null };
}
```

Dateiformat auf Platte: Wrapper-JSON `{ format: 'notentabelle', encrypted: boolean, payload: ... }`; Payload optional AES-GCM-verschlüsselt (PBKDF2-Key aus Passwort). Alt-Daten (`notenrechner-data.json`) werden per Migrationsfunktion importiert.

## Architektur

```
src/
├── domain/    # Reine, framework-freie, voll getestete Logik
│   ├── model.ts       # Typen
│   ├── calc.ts        # avg, weighted, yearGrade, gradeColor, Gefährdung
│   ├── schoolYear.ts  # Archivierung, Hochstufung (^(\d+)([a-zA-Z]+)$, MAX_GRADE_LEVEL=10)
│   └── migrate.ts     # Alt-Format → neues Format
├── storage/
│   ├── fileStorage.ts # FSA-Picker, Handle-Persistenz in IndexedDB, debounced Auto-Save
│   ├── fallback.ts    # Download/Upload ohne FSA-API
│   └── crypto.ts      # WebCrypto: SHA-256, AES-GCM + PBKDF2
├── state/     # Context/Reducer für AppData + Dirty-Tracking
├── components/ # GradeInput, Modal, Toast, StatCard, …
├── views/     # Dashboard, SubjectView, GradeEntryView, ClassesView,
│              # StudentSearchView, ArchiveView, SettingsView, LoginView, SetupWizard
└── styles/    # Plain CSS mit CSS-Variablen
```

Abhängigkeiten minimal: `react`, `react-dom`, `jspdf`; Dev: `vite`, `typescript`, `vitest`, `@testing-library/react`.

## Fehlerbehandlung

- Ungültige Noteneingaben: Inline-Markierung, Wert wird nicht übernommen
- Dateizugriff verweigert/Handle verloren: Nutzerfreundlicher Dialog zur Neuauswahl; ungespeicherte Änderungen bleiben im Speicher + IndexedDB-Sicherung
- Falsches Passwort / defekte Datei: klare Fehlermeldung, Recovery-Weg über Sicherheitsfrage/Recovery-Key
- Import: Validierung des Formats vor Übernahme, niemals stillschweigend Daten überschreiben (Bestätigungsdialog)

## Teststrategie

- Domain-Logik komplett per Vitest (TDD): Berechnungsformeln mit Vergleichswerten aus der Alt-App, Hochstufungs- und Archivierungslogik, Migration
- Storage: Unit-Tests mit gemockten Handles; Fallback-Pfad per Feature-Flag
- End-to-End manuell per verify-Skill: Ersteinrichtung → Daten anlegen → Noten → Reload → Persistenz → Export/Import → Jahreswechsel
