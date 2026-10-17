// Valores de campos personalizados: validación, forma canónica de
// guardado y formato de lectura. Puro (sin prisma): lo usan el editor del
// registro (cliente), el importador (preview en el navegador + ejecución
// en el servidor) y la API de valores, así los tres guardan y muestran lo
// mismo.
//
// CustomFieldValue.value es texto. Para que un mismo campo se pueda
// editar, filtrar y exportar sin importar de dónde vino el dato, se guarda
// SIEMPRE en una forma canónica:
//   number/currency → "1234.5"            boolean → "true" | "false"
//   date            → "2026-03-15"        datetime → "2026-03-15T10:30"
//   multiselect     → "A, B"              resto    → texto recortado

export const CUSTOM_FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Texto",
  number: "Número",
  currency: "Moneda",
  date: "Fecha",
  datetime: "Fecha y hora",
  boolean: "Sí / No",
  select: "Lista (una opción)",
  multiselect: "Lista (varias opciones)",
  email: "Email",
  phone: "Teléfono",
  url: "URL",
};

export const BOOLEAN_TRUE = new Set(["si", "sí", "yes", "true", "1", "x", "verdadero"]);
export const BOOLEAN_FALSE = new Set(["no", "false", "0", "falso"]);

export interface CustomFieldTypeInfo {
  type: string;
  options: string[];
  label: string;
}

const pad = (n: string) => n.padStart(2, "0");

/** dd/mm/aaaa, dd-mm-aaaa o aaaa-mm-dd → aaaa-mm-dd (null si no es fecha real). */
export function toIsoDate(raw: string): string | null {
  const v = raw.trim();
  let y: string, m: string, d: string;
  const dmy = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const ymd = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (dmy) [, d, m, y] = dmy;
  else if (ymd) [, y, m, d] = ymd;
  else return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  // Rechaza 31/02 y similares (Date los "corre" al mes siguiente).
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

function toIsoDateTime(raw: string): string | null {
  const v = raw.trim();
  const date = toIsoDate(v.split(/[T ]/)[0] ?? "");
  if (!date) return null;
  const time = v.match(/[T ](\d{1,2}):(\d{2})/);
  return time ? `${date}T${pad(time[1])}:${time[2]}` : `${date}T00:00`;
}

/** "1.234,50" / "1234.5" / "$ 1.234" → 1234.5 (null si no es número). */
export function toNumber(raw: string): number | null {
  let v = raw.trim().replace(/[$\s]/g, "");
  if (!v) return null;
  if (v.includes(",") && v.includes(".")) {
    // El separador decimal es el último que aparece.
    v = v.lastIndexOf(",") > v.lastIndexOf(".") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
  } else if (v.includes(",")) {
    v = v.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) {
    v = v.replace(/\./g, ""); // "1.234.567" → miles (formato es-AR)
  }
  if (!/^-?\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

function splitOptions(raw: string) {
  return raw
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Mensaje de error en español, o null si el valor es válido (vacío = válido). */
export function validateCustomValue(info: CustomFieldTypeInfo, raw: string): string | null {
  const value = raw.trim();
  const { label } = info;
  if (!value) return null;
  switch (info.type) {
    case "number":
    case "currency":
      return toNumber(value) === null ? `"${label}" no es un número válido: ${value}` : null;
    case "boolean":
      return BOOLEAN_TRUE.has(value.toLowerCase()) || BOOLEAN_FALSE.has(value.toLowerCase()) ? null : `"${label}" no es sí/no: ${value}`;
    case "date":
      return toIsoDate(value) ? null : `"${label}" no es una fecha válida: ${value}`;
    case "datetime":
      return toIsoDateTime(value) ? null : `"${label}" no es una fecha válida: ${value}`;
    case "select":
      return info.options.length > 0 && !info.options.includes(value) ? `"${label}": "${value}" no está entre las opciones` : null;
    case "multiselect": {
      if (info.options.length === 0) return null;
      const bad = splitOptions(value).find((p) => !info.options.includes(p));
      return bad ? `"${label}": "${bad}" no está entre las opciones` : null;
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : `"${label}" no es un email válido: ${value}`;
    default:
      return null;
  }
}

/** Forma canónica para guardar. Asume un valor ya validado; vacío → null. */
export function normalizeCustomValue(type: string, raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  switch (type) {
    case "number":
    case "currency": {
      const n = toNumber(value);
      return n === null ? value : String(n);
    }
    case "boolean":
      return BOOLEAN_TRUE.has(value.toLowerCase()) ? "true" : BOOLEAN_FALSE.has(value.toLowerCase()) ? "false" : value;
    case "date":
      return toIsoDate(value) ?? value;
    case "datetime":
      return toIsoDateTime(value) ?? value;
    case "multiselect":
      return splitOptions(value).join(", ");
    default:
      return value;
  }
}

/** Texto para mostrar en listas, detalle y CSV (es-AR). */
export function formatCustomValue(type: string, value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  switch (type) {
    case "boolean": {
      const v = value.toLowerCase();
      return BOOLEAN_TRUE.has(v) ? "Sí" : BOOLEAN_FALSE.has(v) ? "No" : value;
    }
    case "date": {
      const iso = toIsoDate(value);
      return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : value;
    }
    case "datetime": {
      const iso = toIsoDateTime(value);
      return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}` : value;
    }
    case "number": {
      const n = toNumber(value);
      return n === null ? value : n.toLocaleString("es-AR");
    }
    case "currency": {
      const n = toNumber(value);
      return n === null ? value : `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
    }
    default:
      return value;
  }
}

/**
 * Condición sobre CustomFieldValue.value para un filtro de lista. Tolera
 * los datos guardados antes de normalizar (ej. "Sí" o "15/03/2026"):
 * devuelve un OR de formas equivalentes.
 */
export function customValueFilterVariants(type: string, input: string): { equals?: string[]; contains: string[] } {
  const raw = input.trim();
  if (type === "boolean") {
    const v = raw.toLowerCase();
    const set = BOOLEAN_TRUE.has(v) ? BOOLEAN_TRUE : BOOLEAN_FALSE.has(v) ? BOOLEAN_FALSE : null;
    if (set) return { equals: Array.from(set), contains: [] };
  }
  if (type === "date" || type === "datetime") {
    const iso = toIsoDate(raw);
    if (iso) return { contains: [iso, `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`] };
  }
  if (type === "number" || type === "currency") {
    const n = toNumber(raw);
    if (n !== null) return { equals: [String(n)], contains: [raw] };
  }
  return { contains: [raw] };
}

/** Prefijo de las columnas de campos personalizados en las listas (`cols=name,cf_<id>`). */
export const CUSTOM_COLUMN_PREFIX = "cf_";
