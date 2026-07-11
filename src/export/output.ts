import type { AppData } from '../domain/model';
import { downloadTextFile } from '../storage/fallback';
import { serializeFile } from '../storage/fileFormat';
import type { StudentReport } from './studentReport';

function safeFilename(name: string): string {
  return name.replace(/[^\wäöüÄÖÜß. -]/g, '').trim() || 'export';
}

/** Unverschlüsselte Sicherungskopie als Datei-Download. */
export async function exportBackup(data: AppData): Promise<void> {
  const text = await serializeFile(data, null);
  const date = new Date().toISOString().slice(0, 10);
  downloadTextFile(text, `notentabelle-sicherung-${date}.json`);
}

/** Notenübersicht eines Schülers als PDF speichern (jsPDF wird erst hier geladen). */
export async function exportStudentPdf(report: StudentReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const left = 14;
  let y = 20;

  const ensureSpace = (needed: number) => {
    if (y + needed > 282) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, left, y);
  y += 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.meta} · Gesamtschnitt ${report.overall}`, left, y);
  y += 10;

  const hasPrevious = report.subjects.some((s) => s.previous !== null);
  const columns = [
    { header: 'Fach', x: left },
    { header: '1. HJ', x: 105 },
    { header: '2. HJ', x: 130 },
    { header: 'Jahr', x: 155 },
    ...(hasPrevious ? [{ header: 'Vorjahr', x: 180 }] : []),
  ];

  doc.setFont('helvetica', 'bold');
  for (const column of columns) doc.text(column.header, column.x, y);
  y += 2;
  doc.line(left, y, 196, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  for (const subject of report.subjects) {
    ensureSpace(8);
    const cells = [subject.name, subject.semester1, subject.semester2, subject.year, subject.previous ?? ''];
    columns.forEach((column, i) => doc.text(cells[i], column.x, y));
    y += 7;
  }

  if (report.notes.length > 0) {
    y += 6;
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Notizen', left, y);
    y += 8;
    doc.setFontSize(11);
    for (const note of report.notes) {
      const lines = doc.splitTextToSize(note.text, 175) as string[];
      ensureSpace(7 + lines.length * 5.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${note.label} · ${note.date}`, left, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text(lines, left, y);
      y += lines.length * 5.5 + 3;
    }
  }

  doc.save(`${safeFilename(report.title)}.pdf`);
}

/** Druckansicht in neuem Fenster öffnen und Druckdialog starten. */
export function openStudentPrintView(report: StudentReport): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const hasPrevious = report.subjects.some((s) => s.previous !== null);
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  printWindow.document.write(`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escape(report.title)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #1e2a32; margin: 2rem; }
  h1 { margin: 0 0 0.25rem; }
  .meta { color: #5b6b74; margin: 0 0 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.45rem 0.7rem; text-align: center; }
  th:first-child, td:first-child { text-align: left; }
  th { background: #f0f2ef; }
  h2 { font-size: 1.1rem; }
  .note { border-left: 3px solid #2d6a4f; padding: 0.3rem 0.8rem; margin-bottom: 0.8rem; }
  .note-head { font-size: 0.85rem; color: #5b6b74; font-weight: 600; }
  .note p { margin: 0.2rem 0 0; white-space: pre-wrap; }
</style>
</head>
<body>
<h1>${escape(report.title)}</h1>
<p class="meta">${escape(report.meta)} · Gesamtschnitt ${escape(report.overall)}</p>
<table>
<thead><tr><th>Fach</th><th>1. HJ</th><th>2. HJ</th><th>Jahr</th>${hasPrevious ? '<th>Vorjahr</th>' : ''}</tr></thead>
<tbody>
${report.subjects
  .map(
    (s) =>
      `<tr><td>${escape(s.name)}</td><td>${s.semester1}</td><td>${s.semester2}</td><td><strong>${s.year}</strong></td>${
        hasPrevious ? `<td>${s.previous ?? ''}</td>` : ''
      }</tr>`,
  )
  .join('\n')}
</tbody>
</table>
${
  report.notes.length > 0
    ? `<h2>Notizen</h2>` +
      report.notes
        .map(
          (n) =>
            `<div class="note"><span class="note-head">${escape(n.label)} · ${escape(n.date)}</span><p>${escape(n.text)}</p></div>`,
        )
        .join('\n')
    : ''
}
<script>window.addEventListener('load', () => window.print());</script>
</body>
</html>`);
  printWindow.document.close();
}
