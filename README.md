# Notentabelle — Ihr digitales Notenheft

Eine Web-App für Lehrkräfte: Noten eintragen, Schnitte werden automatisch berechnet,
alte Schuljahre bleiben im Archiv. **Alle Daten bleiben auf Ihrem eigenen Gerät** —
es gibt keinen Server, nichts wird ins Internet übertragen.

## Für Nutzer:innen — so einfach geht's

1. **Link öffnen** (bekommen Sie von der Person, die die App betreibt), am besten in
   **Chrome oder Edge**.
2. Beim ersten Start **„Neue Notendatei anlegen"** wählen und die Datei an einem Ort
   speichern, den Sie wiederfinden — z.B. im Ordner *Dokumente* oder in Ihrem
   OneDrive-Ordner (dann sind die Noten automatisch zusätzlich gesichert).
3. Fertig. Ab jetzt speichert die App **automatisch** in diese Datei. Beim nächsten
   Besuch genügt ein Klick auf „Weiter mit …".

### Was die App kann

- **Noteneingabe** je Fach und Klasse: Klassenarbeiten, Tests, Mündlich — getrennt
  nach Halbjahren, mit beliebig vielen Spalten (Titel + Datum)
- **Automatische Schnitte**: Notenart-Durchschnitt → gewichtete Halbjahresnote →
  Jahresnote (Gewichtung pro Fach einstellbar, Prozent oder Faktor)
- **Dashboard** mit Klassenschnitten, besten Schnitten, Förderbedarf und Notenverteilung
- **Schülerakte** mit Suche, Gefährdungsfilter, Notizen (Allgemein, Elterngespräch,
  Strafarbeit) und Vorjahresvergleich
- **Schuljahreswechsel**: Klassen werden automatisch hochgestuft (8c → 9c),
  Abschlussklassen wandern ins unveränderliche **Archiv**
- **Export**: Schüler-Übersicht als PDF oder Druck, Sicherungskopie als Datei
- **Passwortschutz** (optional): Die Notendatei wird verschlüsselt; ein
  Wiederherstellungsschlüssel schützt vor Passwortverlust

### Wichtige Hinweise

- **Firefox/Safari**: Diese Browser erlauben kein automatisches Speichern in eine
  Datei. Die App nutzt dann den Browser-Speicher — bitte regelmäßig über
  *Einstellungen → Sicherungskopie herunterladen* sichern.
- **Passwort vergessen?** Nur der Wiederherstellungsschlüssel (wird beim Einrichten
  des Passworts einmalig angezeigt) öffnet die Datei wieder. Ohne ihn sind die
  Daten nicht wiederherstellbar — das ist der Preis echter Verschlüsselung.
- **Alte Notentabelle**: Exporte der Vorgänger-App (`notenrechner-data.json`) können
  über *Einstellungen → Sicherung wiederherstellen* übernommen werden.

## Für Entwickler:innen

React + TypeScript + Vite, Tests mit Vitest. Local-First: Speicherung über die
File System Access API (Fallback: localStorage + Export).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest (Domain-Logik)
npm run build    # Produktionsbuild nach dist/
```

### Veröffentlichen (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push
auf `main` automatisch. Einmalig einrichten:

1. Öffentliches GitHub-Repo `notentabelle` anlegen und diesen Code pushen
2. Im Repo: *Settings → Pages → Source: „GitHub Actions"* wählen
3. Nach dem ersten Lauf ist die App unter
   `https://<benutzername>.github.io/notentabelle/` erreichbar

Heißt das Repo anders, muss `base` in `vite.config.ts` angepasst werden.

Weitere Dokumentation: `docs/superpowers/specs/` (Design-Doc) und `CLAUDE.md`
(Architektur-Regeln).
