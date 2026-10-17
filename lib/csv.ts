// Generación de CSV para exportaciones e informes.
// - Separador ";" y BOM UTF-8: Excel en español (coma decimal) lo abre en
//   columnas y con acentos correctos sin pasos extra.
// - Protección contra "CSV injection": una celda que empieza con = + - @
//   (o tab/CR) se antepone con ' para que Excel no la ejecute como fórmula.

const SEP = ";";

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(SEP)).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}
