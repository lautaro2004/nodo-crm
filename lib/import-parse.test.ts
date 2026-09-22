import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { ImportParseError, parseCsvText, parseSpreadsheetBuffer } from "./import-parse";

function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

async function buildXlsxBuffer(rows: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");
  rows.forEach((r) => sheet.addRow(r));
  const buf = await workbook.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : (buf as Uint8Array).buffer.slice(0) as ArrayBuffer;
}

describe("parseCsvText", () => {
  it("parsea comas, comillas y saltos de línea dentro de un campo", () => {
    const csv = 'Cliente,Teléfono,Domicilio\n"Pérez, Juan",1122334455,"Calle Falsa 123\nCasa 2"\nAna,999,Otra dirección';
    const rows = parseCsvText(csv);
    expect(rows[0]).toEqual(["Cliente", "Teléfono", "Domicilio"]);
    expect(rows[1]).toEqual(["Pérez, Juan", "1122334455", "Calle Falsa 123\nCasa 2"]);
    expect(rows[2]).toEqual(["Ana", "999", "Otra dirección"]);
  });

  it("comillas escapadas ('\"\"') dentro de un campo entre comillas", () => {
    const rows = parseCsvText('Nombre\n"Juan ""el grande"""');
    expect(rows[1]).toEqual(['Juan "el grande"']);
  });
});

describe("parseSpreadsheetBuffer — CSV (1. válido)", () => {
  it("un CSV válido produce headers y filas", async () => {
    const csv = "Cliente,Teléfono,Domicilio,Seña\nJuan Pérez,1122334455,Calle Falsa 123,1500\nAna Gómez,999888777,Otra dirección,";
    const sheet = await parseSpreadsheetBuffer(toBuffer(csv), "clientes.csv");
    expect(sheet.headers).toEqual(["Cliente", "Teléfono", "Domicilio", "Seña"]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0]).toEqual({ Cliente: "Juan Pérez", Teléfono: "1122334455", Domicilio: "Calle Falsa 123", Seña: "1500" });
  });

  it("detecta el formato por CONTENIDO, no por la extensión del archivo", async () => {
    const csv = "Nombre\nJuan";
    // extensión .xlsx pero contenido de texto plano -> se parsea como CSV igual
    const sheet = await parseSpreadsheetBuffer(toBuffer(csv), "en-realidad-es.xlsx");
    expect(sheet.headers).toEqual(["Nombre"]);
    expect(sheet.rows).toEqual([{ Nombre: "Juan" }]);
  });
});

describe("parseSpreadsheetBuffer — XLSX (1. válido)", () => {
  it("un XLSX válido produce headers y filas", async () => {
    const buffer = await buildXlsxBuffer([
      ["Cliente", "Teléfono", "Seña"],
      ["Juan Pérez", "1122334455", 1500],
      ["Ana Gómez", "999888777", 800],
    ]);
    const sheet = await parseSpreadsheetBuffer(buffer, "clientes.xlsx");
    expect(sheet.headers).toEqual(["Cliente", "Teléfono", "Seña"]);
    expect(sheet.rows[0]).toEqual({ Cliente: "Juan Pérez", Teléfono: "1122334455", Seña: "1500" });
  });
});

describe("parseSpreadsheetBuffer — archivo inválido", () => {
  it("archivo vacío", async () => {
    await expect(parseSpreadsheetBuffer(new ArrayBuffer(0), "x.csv")).rejects.toThrow(ImportParseError);
  });

  it("sólo encabezado, sin filas de datos", async () => {
    await expect(parseSpreadsheetBuffer(toBuffer("Cliente,Teléfono"), "x.csv")).rejects.toThrow(/fila de datos/);
  });

  it("xlsx corrupto (firma ZIP pero contenido basura)", async () => {
    const garbage = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01, 0x02, 0x03]);
    await expect(parseSpreadsheetBuffer(garbage.buffer, "roto.xlsx")).rejects.toThrow(ImportParseError);
  });

  it("supera el tamaño máximo", async () => {
    const huge = new ArrayBuffer(6 * 1024 * 1024);
    await expect(parseSpreadsheetBuffer(huge, "grande.csv")).rejects.toThrow(/tamaño máximo/);
  });

  it("supera la cantidad máxima de filas", async () => {
    const lines = ["Nombre", ...Array.from({ length: 2001 }, (_, i) => `Fila ${i}`)];
    await expect(parseSpreadsheetBuffer(toBuffer(lines.join("\n")), "x.csv")).rejects.toThrow(/máximo/);
  });
});
