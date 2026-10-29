/**
 * Leitura de planilhas no navegador, sem dependencias: CSV e XLSX (Excel 2007+).
 * O XLSX e um ZIP de XMLs; descompacta com DecompressionStream("deflate-raw").
 * O formato .xls antigo (binario) nao e suportado.
 */

export type SpreadsheetRows = string[][];

export class SpreadsheetError extends Error {}

const textDecoder = (label: string) => new TextDecoder(label, { fatal: false });

function decodeText(bytes: Uint8Array): string {
  const utf8 = textDecoder("utf-8").decode(bytes);
  // Arquivo salvo como "CSV (separado por virgulas)" no Excel brasileiro vem em Windows-1252.
  if (utf8.includes("\uFFFD")) return textDecoder("windows-1252").decode(bytes);
  return utf8;
}

/** CSV com aspas, quebra de linha dentro de campo e separador ";" ou ",". */
export function parseCsv(text: string): SpreadsheetRows {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g)?.length || 0) >= (firstLine.match(/,/g)?.length || 0) ? ";" : ",";

  const rows: SpreadsheetRows = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readZipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError("Arquivo não é um .xlsx válido.");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>();
  const decoder = textDecoder("utf-8");

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.set(name, { name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipFile(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const start = entry.localOffset + 30 + nameLength + extraLength;
  const data = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return textDecoder("utf-8").decode(data);
  if (entry.method !== 8) throw new SpreadsheetError("Compactação do .xlsx não suportada.");
  if (typeof DecompressionStream === "undefined") {
    throw new SpreadsheetError("Este navegador não lê .xlsx. Salve a planilha como CSV e tente de novo.");
  }

  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

const parseXml = (xml: string) => new DOMParser().parseFromString(xml, "application/xml");
// getElementsByTagName ignora o prefixo de namespace de forma diferente entre navegadores.
const byTag = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS("*", tag));

async function parseXlsx(bytes: Uint8Array): Promise<SpreadsheetRows> {
  const entries = readZipEntries(bytes);
  const read = async (path: string) => {
    const entry = entries.get(path);
    return entry ? readZipFile(bytes, entry) : null;
  };

  // Primeira aba do arquivo (pela ordem do workbook, nao pelo nome do XML).
  let sheetPath = "xl/worksheets/sheet1.xml";
  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  if (workbook && rels) {
    const firstSheet = byTag(parseXml(workbook), "sheet")[0];
    const relId =
      firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") ||
      firstSheet?.getAttribute("r:id");
    const rel = byTag(parseXml(rels), "Relationship").find((r) => r.getAttribute("Id") === relId);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }

  const sheetXml = await read(sheetPath);
  if (!sheetXml) throw new SpreadsheetError("Não encontramos nenhuma aba na planilha.");

  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = sharedXml
    ? byTag(parseXml(sharedXml), "si").map((si) => byTag(si, "t").map((t) => t.textContent || "").join(""))
    : [];

  const rows: SpreadsheetRows = [];
  for (const rowEl of byTag(parseXml(sheetXml), "row")) {
    const row: string[] = [];
    let next = 0;
    for (const cell of byTag(rowEl, "c")) {
      const ref = cell.getAttribute("r");
      const index = ref ? columnIndex(ref) : next;
      const type = cell.getAttribute("t");
      const raw = byTag(cell, "v")[0]?.textContent ?? "";
      let value: string;
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = byTag(cell, "t").map((t) => t.textContent || "").join("");
      else if (type === "b") value = raw === "1" ? "VERDADEIRO" : "FALSO";
      else value = raw;
      row[index] = value.trim();
      next = index + 1;
    }
    const filled = Array.from(row, (c) => c ?? "");
    if (filled.some((c) => c !== "")) rows.push(filled);
  }
  return rows;
}

export async function readSpreadsheet(file: File): Promise<SpreadsheetRows> {
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(decodeText(bytes));
  if (name.endsWith(".xlsx")) return parseXlsx(bytes);
  if (name.endsWith(".xls")) {
    throw new SpreadsheetError('Arquivos .xls (Excel 97-2003) não são suportados. No Excel, use "Salvar como" .xlsx ou CSV.');
  }
  throw new SpreadsheetError("Formato não suportado. Envie uma planilha .xlsx ou .csv.");
}

/** "Número da CNH" -> "numerodacnh": compara cabecalhos sem acento, espaco ou caixa. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
