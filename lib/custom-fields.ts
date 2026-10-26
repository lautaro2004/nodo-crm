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
  /** Validaciones extra (CustomFieldDefinition.validation). */
  validation?: FieldValidation | null;
}

// ── Validaciones configurables por tipo ─────────────────────────────────
// Se guardan en CustomFieldDefinition.validation (JSON). Solo se aceptan
// las claves que tienen sentido para el tipo del campo (ver
// VALIDATION_KEYS_BY_TYPE): un "mínimo" en un campo de texto no existe.

export interface FieldValidation {
  minLength?: number | null;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  /** aaaa-mm-dd */
  minDate?: string | null;
  maxDate?: string | null;
}

export const VALIDATION_KEYS_BY_TYPE: Record<string, (keyof FieldValidation)[]> = {
  text: ["minLength", "maxLength"],
  phone: ["minLength", "maxLength"],
  number: ["min", "max"],
  currency: ["min", "max"],
  date: ["minDate", "maxDate"],
  datetime: ["minDate", "maxDate"],
};

export const VALIDATION_LABELS: Record<keyof FieldValidation, string> = {
  minLength: "Mínimo de caracteres",
  maxLength: "Máximo de caracteres",
  min: "Valor mínimo",
  max: "Valor máximo",
  minDate: "Fecha mínima",
  maxDate: "Fecha máxima",
};

/** Tipos con lista de opciones editable. */
export const OPTION_TYPES = new Set(["select", "multiselect"]);
/** Tipos que admiten valor predeterminado. */
export const DEFAULTABLE_TYPES = new Set(["text", "number", "currency", "date", "boolean", "select", "multiselect", "email", "phone", "url"]);

/**
 * Deja solo las validaciones que corresponden al tipo, con valores
 * coherentes. Devuelve el objeto limpio (null si no queda ninguna) o un
 * mensaje de error.
 */
export function sanitizeValidation(type: string, input: FieldValidation | null | undefined): { ok: true; value: FieldValidation | null } | { ok: false; message: string } {
  if (!input) return { ok: true, value: null };
  const allowed = VALIDATION_KEYS_BY_TYPE[type] ?? [];
  const out: FieldValidation = {};
  for (const key of allowed) {
    const v = input[key];
    if (v === null || v === undefined || v === "") continue;
    if (key === "minDate" || key === "maxDate") {
      const iso = toIsoDate(String(v));
      if (!iso) return { ok: false, message: `${VALIDATION_LABELS[key]}: fecha inválida.` };
      out[key] = iso;
    } else {
      const n = typeof v === "number" ? v : toNumber(String(v));
      if (n === null || !Number.isFinite(n)) return { ok: false, message: `${VALIDATION_LABELS[key]}: número inválido.` };
      if ((key === "minLength" || key === "maxLength") && (n < 0 || !Number.isInteger(n) || n > 2000)) {
        return { ok: false, message: `${VALIDATION_LABELS[key]}: usá un entero entre 0 y 2000.` };
      }
      out[key] = n;
    }
  }
  if (out.minLength != null && out.maxLength != null && out.minLength > out.maxLength) return { ok: false, message: "El mínimo de caracteres supera al máximo." };
  if (out.min != null && out.max != null && out.min > out.max) return { ok: false, message: "El valor mínimo supera al máximo." };
  if (out.minDate && out.maxDate && out.minDate > out.maxDate) return { ok: false, message: "La fecha mínima es posterior a la máxima." };
  return { ok: true, value: Object.keys(out).length ? out : null };
}

function checkValidation(info: CustomFieldTypeInfo, value: string): string | null {
  const v = info.validation;
  if (!v) return null;
  const { label } = info;
  if (info.type === "text" || info.type === "phone") {
    if (v.minLength != null && value.length < v.minLength) return `"${label}" necesita al menos ${v.minLength} caracteres.`;
    if (v.maxLength != null && value.length > v.maxLength) return `"${label}" admite hasta ${v.maxLength} caracteres.`;
  }
  if (info.type === "number" || info.type === "currency") {
    const n = toNumber(value);
    if (n !== null && v.min != null && n < v.min) return `"${label}" no puede ser menor que ${v.min.toLocaleString("es-AR")}.`;
    if (n !== null && v.max != null && n > v.max) return `"${label}" no puede ser mayor que ${v.max.toLocaleString("es-AR")}.`;
  }
  if (info.type === "date" || info.type === "datetime") {
    const iso = toIsoDate(value.split(/[T ]/)[0] ?? "");
    const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    if (iso && v.minDate && iso < v.minDate) return `"${label}" no puede ser anterior al ${fmt(v.minDate)}.`;
    if (iso && v.maxDate && iso > v.maxDate) return `"${label}" no puede ser posterior al ${fmt(v.maxDate)}.`;
  }
  return null;
}

/** Valores elegidos en un multiselect guardado ("A, B"). */
export function splitMultiValue(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean);
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
  if (!value) return null;
  return validateType(info, value) ?? checkValidation(info, value);
}

function validateType(info: CustomFieldTypeInfo, value: string): string | null {
  const { label } = info;
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
    case "file":
      // Se guarda la ruta en Storage; se muestra solo el nombre original
      // (último segmento, ver modules/records/files.ts).
      return value.split("/").pop() || value;
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
