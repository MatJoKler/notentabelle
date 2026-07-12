import {
  DEFAULT_WEIGHTS,
  gradeKey,
  type AppData,
  type Category,
  type GradeColumn,
  type Semester,
  type Weights,
} from './model';

/** Zellen eines Sheets: "A1" → Rohwert (Zahlen als String mit Punkt). */
export type CellMap = Record<string, string>;
export type ParsedWorkbook = Record<string, CellMap>;

const GRADE_SHEETS: Array<{ sheet: string; category: Category; semester: Semester; label: string }> = [
  { sheet: 'KA_1_Halbjahr', category: 'ka', semester: 1, label: 'KA' },
  { sheet: 'Tests_1_Halbjahr', category: 'test', semester: 1, label: 'Test' },
  { sheet: 'Mündlich_1_Halbjahr', category: 'muendlich', semester: 1, label: 'Mündlich' },
  { sheet: 'KA_2_Halbjahr', category: 'ka', semester: 2, label: 'KA' },
  { sheet: 'Tests_2_Halbjahr', category: 'test', semester: 2, label: 'Test' },
  { sheet: 'Mündlich_2_Halbjahr', category: 'muendlich', semester: 2, label: 'Mündlich' },
];

/** Erste Schüler-/Notenzeile in den Vorlagen-Sheets. */
const STUDENT_FIRST_ROW = 5; // Einstellungen: B/C/D ab Zeile 5
const GRADE_FIRST_ROW = 6; // Notensheets: Noten ab Zeile 6, Datum in Zeile 4

export interface ExcelColumn {
  category: Category;
  semester: Semester;
  title: string;
  date: string | null;
  grades: Array<{ studentIndex: number; value: number }>;
}

export interface ExcelSubjectData {
  /** null, wenn nur der Vorlagen-Platzhalter „FACH" eingetragen ist. */
  subjectName: string | null;
  schoolYear: string | null;
  /** "Vorname Nachname" in Zeilenreihenfolge; Index = Notenzeile. */
  students: string[];
  weights: Weights;
  columns: ExcelColumn[];
}

/** Excel-Serialdatum (Epoche 1899-12-30) → ISO-Datum. */
export function excelSerialToIso(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + serial * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function cellRow(ref: string): number {
  return Number(ref.replace(/^[A-Z]+/, ''));
}

function cellColumn(ref: string): string {
  return ref.replace(/\d+$/, '');
}

/** Spaltenbuchstaben → Index (A=0, Z=25, AA=26 …) für stabile Sortierung. */
function columnIndex(column: string): number {
  let index = 0;
  for (const char of column) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

function parseExcelGrade(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value < 1 || value > 6) return null;
  return value;
}

function extractWeights(settings: CellMap): Weights {
  const byLabel: Record<string, number> = {};
  for (const [ref, label] of Object.entries(settings)) {
    if (cellColumn(ref) !== 'F') continue;
    const value = Number(settings[`G${cellRow(ref)}`]);
    if (Number.isFinite(value)) byLabel[label.trim().toLowerCase()] = value;
  }
  const ka = byLabel['ka'];
  const tests = byLabel['test'] ?? byLabel['tests'];
  const muendlich = byLabel['mündlich'] ?? byLabel['muendlich'];
  if (ka === undefined || tests === undefined || muendlich === undefined) {
    return DEFAULT_WEIGHTS;
  }
  const clamp = (v: number) => Math.min(5, Math.max(1, Math.round(v)));
  return { ka: clamp(ka), tests: clamp(tests), muendlich: clamp(muendlich), mode: 'factor' };
}

function extractStudents(settings: CellMap): string[] {
  const rows = new Set<number>();
  for (const ref of Object.keys(settings)) {
    const column = cellColumn(ref);
    if ((column === 'C' || column === 'D') && cellRow(ref) >= STUDENT_FIRST_ROW) {
      rows.add(cellRow(ref));
    }
  }
  return [...rows]
    .sort((a, b) => a - b)
    .map((row) => `${settings[`D${row}`] ?? ''} ${settings[`C${row}`] ?? ''}`.trim())
    .filter((name) => name !== '');
}

function extractColumns(workbook: ParsedWorkbook): ExcelColumn[] {
  const columns: ExcelColumn[] = [];
  for (const { sheet, category, semester, label } of GRADE_SHEETS) {
    const cells = workbook[sheet] ?? {};

    // Alle Spaltenbuchstaben mit mindestens einer gültigen Note einsammeln
    const byColumn = new Map<string, Array<{ studentIndex: number; value: number }>>();
    for (const [ref, raw] of Object.entries(cells)) {
      const row = cellRow(ref);
      if (row < GRADE_FIRST_ROW) continue;
      const column = cellColumn(ref);
      if (['A', 'B', 'C', 'D', 'E', 'F'].includes(column)) continue; // Nr./Namen/Gesamt
      const value = parseExcelGrade(raw);
      if (value === null) continue;
      if (!byColumn.has(column)) byColumn.set(column, []);
      byColumn.get(column)!.push({ studentIndex: row - GRADE_FIRST_ROW, value });
    }

    const ordered = [...byColumn.keys()].sort((a, b) => columnIndex(a) - columnIndex(b));
    ordered.forEach((column, i) => {
      const head = cells[`${column}4`];
      let title = `${label} ${i + 1}`;
      let date: string | null = null;
      if (head !== undefined) {
        if (/^\d+(\.\d+)?$/.test(head)) {
          date = excelSerialToIso(Number(head));
        } else if (head.trim() !== '' && head.trim() !== 'Datum') {
          title = head.trim();
        }
      }
      const grades = byColumn.get(column)!.sort((a, b) => a.studentIndex - b.studentIndex);
      columns.push({ category, semester, title, date, grades });
    });
  }
  return columns;
}

/** Wirft mit verständlicher Meldung, wenn die Datei nicht der Vorlage entspricht. */
export function extractExcelData(workbook: ParsedWorkbook): ExcelSubjectData {
  const settings = workbook['Einstellungen'];
  if (!settings || GRADE_SHEETS.some(({ sheet }) => !(sheet in workbook))) {
    throw new Error('Die Datei entspricht nicht der Notentabellen-Vorlage (Sheets fehlen).');
  }

  const rawSubject = workbook['Übersicht']?.B2?.trim() ?? '';
  return {
    subjectName: rawSubject === '' || rawSubject === 'FACH' ? null : rawSubject,
    schoolYear: workbook['Übersicht']?.C5?.trim() || null,
    students: extractStudents(settings),
    weights: extractWeights(settings),
    columns: extractColumns(workbook),
  };
}

export interface MergeOptions {
  className: string;
  subjectName: string;
}

export interface ArchiveMergeOptions extends MergeOptions {
  /** Ziel-Schuljahr im Archiv, z.B. "2024/25". */
  schoolYear: string;
  /** Zeitstempel, falls der Archiv-Snapshot neu angelegt werden muss. */
  archivedDate: string;
}

/** Jahresinhalt, in den importiert wird — aktuelles Jahr und Archiv-Snapshots erfüllen ihn. */
type YearContent = Pick<AppData, 'classes' | 'students' | 'subjects' | 'columns' | 'grades'>;

/**
 * Kern des Imports: neue Klasse + Fach in einen Jahresinhalt einfügen.
 * Wirft, wenn der Klassenname bereits vergeben ist; ein gleichnamiges Fach
 * wird wiederverwendet (dessen Gewichte haben Vorrang).
 */
function mergeIntoYear<T extends YearContent>(year: T, excel: ExcelSubjectData, options: MergeOptions): T {
  const className = options.className.trim();
  const subjectName = options.subjectName.trim();

  const nameTaken = Object.values(year.classes).some(
    (c) => c.name.toLowerCase() === className.toLowerCase(),
  );
  if (nameTaken) {
    throw new Error(`Es gibt bereits eine Klasse „${className}“. Bitte anderen Namen wählen.`);
  }

  const classId = crypto.randomUUID();
  const studentIds = excel.students.map(() => crypto.randomUUID());

  const existingSubject = Object.entries(year.subjects).find(
    ([, s]) => s.name.toLowerCase() === subjectName.toLowerCase(),
  );
  const subjectId = existingSubject?.[0] ?? crypto.randomUUID();

  const subjects = {
    ...year.subjects,
    [subjectId]: existingSubject
      ? {
          ...existingSubject[1],
          assignedClassIds: [...existingSubject[1].assignedClassIds, classId],
        }
      : { name: subjectName, assignedClassIds: [classId], weights: excel.weights },
  };

  const columns: Record<string, GradeColumn> = { ...year.columns };
  const grades = { ...year.grades };
  const orderCounter = new Map<string, number>();
  for (const column of excel.columns) {
    const columnId = crypto.randomUUID();
    const orderKey = `${column.semester}:${column.category}`;
    const order = orderCounter.get(orderKey) ?? 0;
    orderCounter.set(orderKey, order + 1);
    columns[columnId] = {
      subjectId,
      classId,
      semester: column.semester,
      category: column.category,
      title: column.title,
      date: column.date,
      order,
    };
    for (const { studentIndex, value } of column.grades) {
      const studentId = studentIds[studentIndex];
      if (studentId !== undefined) grades[gradeKey(studentId, columnId)] = value;
    }
  }

  return {
    ...year,
    classes: { ...year.classes, [classId]: { name: className, studentIds } },
    students: {
      ...year.students,
      ...Object.fromEntries(
        studentIds.map((id, i) => [id, { name: excel.students[i], classId }]),
      ),
    },
    subjects,
    columns,
    grades,
  };
}

/** Excel-Daten ins aktuelle Schuljahr einfügen. */
export function mergeExcelImport(data: AppData, excel: ExcelSubjectData, options: MergeOptions): AppData {
  return mergeIntoYear(data, excel, options);
}

/** Excel-Daten in ein Archivjahr einfügen; der Snapshot wird bei Bedarf angelegt. */
export function mergeExcelImportIntoArchive(
  data: AppData,
  excel: ExcelSubjectData,
  options: ArchiveMergeOptions,
): AppData {
  const existing = data.archives[options.schoolYear];
  const snapshot = existing ?? {
    schoolYear: options.schoolYear,
    archivedDate: options.archivedDate,
    classes: {},
    students: {},
    subjects: {},
    columns: {},
    grades: {},
    notes: {},
  };
  return {
    ...data,
    archives: { ...data.archives, [options.schoolYear]: mergeIntoYear(snapshot, excel, options) },
  };
}
