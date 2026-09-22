// Parseo de archivo para el Smart Import (Fase 1). Corre en el navegador
// (dentro del wizard) — nunca se sube el archivo entero al servidor, sólo
// las filas ya mapeadas se envían en la confirmación final (ver
// modules/import/execute.ts).
//
// Decisión de dependencias: NO se usa el paquete `xlsx` (SheetJS) — tiene
// vulnerabilidades conocidas sin parche (prototype pollution + ReDoS,
// GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9) justo en el camino de
// parseo, que es exactamente la superficie que este archivo expone a
// datos NO confiables (un archivo subido por el usuario). Se usa
// `exceljs` sólo para .xlsx (formato binario real, no tiene sentido
// reimplementarlo) y un parser de CSV escrito a mano (RFC4180, sin
// regex con backtracking) para .csv, evitando esa dependencia riesgosa
// por completo del lado más simple.
//
// "No confiar solamente en la extensión" (Fase 1/8): el formato se
// detecta por el contenido (firma ZIP al inicio del archivo = xlsx),
// no por el nombre — subir un .csv que en realidad es un .xlsx (o
// viceversa) se maneja igual.

import ExcelJS from "exceljs";

import { MAX_FILE_SIZE_BYTES, MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "@/modules/import/shared";

export class ImportParseError extends Error {}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
}

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];

function looksLikeZip(bytes: Uint8Array): boolean {
  return ZIP_SIGNATURES.some((sig) => sig.every((b, i) => bytes[i] === b));
}

// Parser CSV mínimo (RFC4180): comillas, comas y comillas escapadas ("")
// dentro de un campo, separadores de línea \r\n / \n. Recorrido lineal
// carácter a carácter — sin regex, sin riesgo de ReDoS con archivos
// adversarios.
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text; // rich text
    if ("result" in value) return cellToString((value as { result?: ExcelJS.CellValue }).result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("");
    }
    return "";
  }
  return String(value);
}

async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ImportParseError("No pudimos leer el archivo .xlsx — puede estar dañado o no ser un Excel válido.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportParseError("El archivo no tiene ninguna hoja.");

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // índice 0 vacío por diseño de exceljs
    rows.push(values.slice(1).map(cellToString));
  });
  return rows;
}

function toSheet(matrix: string[][]): ParsedSheet {
  if (matrix.length === 0) throw new ImportParseError("El archivo está vacío.");

  const rawHeaders = matrix[0].map((h) => h.trim());
  if (rawHeaders.filter(Boolean).length === 0) throw new ImportParseError("El archivo no tiene columnas.");
  if (rawHeaders.length > MAX_IMPORT_COLUMNS) throw new ImportParseError(`El archivo tiene demasiadas columnas (máximo ${MAX_IMPORT_COLUMNS}).`);

  // Encabezados vacíos o repetidos se numeran para que sigan siendo
  // mapeables sin colisionar (ej.: dos columnas "" -> "Columna 2", "Columna 3").
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h, i) => {
    const base = h || `Columna ${i + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count > 1 ? `${base} (${count})` : base;
  });

  const dataRows = matrix.slice(1).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (dataRows.length === 0) throw new ImportParseError("El archivo no tiene ninguna fila de datos.");
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ImportParseError(`El archivo tiene ${dataRows.length} filas — el máximo por importación es ${MAX_IMPORT_ROWS}.`);
  }

  const rows = dataRows.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
  return { headers, rows };
}

export async function parseSpreadsheetBuffer(buffer: ArrayBuffer, filenameHint = ""): Promise<ParsedSheet> {
  if (buffer.byteLength === 0) throw new ImportParseError("El archivo está vacío.");
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new ImportParseError(`El archivo supera el tamaño máximo permitido (${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB).`);
  }

  const head = new Uint8Array(buffer.slice(0, 4));
  const isXlsx = looksLikeZip(head);

  if (!isXlsx && !/\.(csv|xlsx)$/i.test(filenameHint) && filenameHint) {
    throw new ImportParseError("Formato no soportado — subí un archivo .csv o .xlsx.");
  }

  const matrix = isXlsx ? await parseXlsxBuffer(buffer) : parseCsvText(new TextDecoder("utf-8").decode(buffer));
  return toSheet(matrix);
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  return parseSpreadsheetBuffer(buffer, file.name);
}
