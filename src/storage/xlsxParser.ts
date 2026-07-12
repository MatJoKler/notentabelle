import type { ParsedWorkbook } from '../domain/importExcel';

/**
 * Minimaler xlsx-Reader ohne Fremdbibliothek: xlsx ist ein ZIP-Archiv mit
 * XML-Dateien; entpackt wird mit der nativen DecompressionStream-API.
 * Gelesen wird nur, was der Excel-Import braucht: Sheetnamen, Zellwerte,
 * Shared Strings. Formeln werden ignoriert (der berechnete Wert zählt).
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // End-of-Central-Directory von hinten suchen (variabler Kommentar am Ende)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Keine gültige xlsx-Datei (ZIP-Ende fehlt)');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    // Lokaler Header hat eigene (ggf. abweichende) Extra-Feld-Länge
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);

    files.set(name, method === 8 ? await inflateRaw(compressed) : compressed.slice());
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function decode(files: Map<string, Uint8Array>, name: string): string {
  const data = files.get(name);
  if (!data) throw new Error(`xlsx unvollständig: ${name} fehlt`);
  return new TextDecoder().decode(data);
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const texts = [...si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]));
    strings.push(texts.join(''));
  }
  return strings;
}

function parseSheetCells(xml: string, shared: string[]): Record<string, string> {
  const cells: Record<string, string> = {};
  for (const match of xml.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = match[1];
    const inner = match[2] ?? '';
    const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
    if (!ref) continue;

    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    let value: string | undefined;
    if (type === 'inlineStr') {
      const texts = [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]));
      value = texts.join('');
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      if (v === undefined) continue;
      value = type === 's' ? shared[Number(v)] : unescapeXml(v);
    }
    if (value !== undefined && value !== '') cells[ref] = value;
  }
  return cells;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  const files = await readZip(buffer);

  const workbookXml = decode(files, 'xl/workbook.xml');
  const relsXml = decode(files, 'xl/_rels/workbook.xml.rels');
  const shared = files.has('xl/sharedStrings.xml')
    ? parseSharedStrings(decode(files, 'xl/sharedStrings.xml'))
    : [];

  const targets = new Map<string, string>();
  for (const rel of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="(worksheets\/[^"]+)"/g)) {
    targets.set(rel[1], `xl/${rel[2]}`);
  }

  const workbook: ParsedWorkbook = {};
  for (const sheet of workbookXml.matchAll(/<sheet name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    const target = targets.get(sheet[2]);
    if (!target) continue;
    workbook[unescapeXml(sheet[1])] = parseSheetCells(decode(files, target), shared);
  }
  return workbook;
}
