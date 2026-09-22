// Lógica de mapeo/validación del Smart Import — pura (sin `prisma`, sin
// nada server-only) a propósito: el wizard la corre en el navegador para
// el preview (Fase 5), y modules/import/execute.ts corre EXACTAMENTE la
// misma función server-side como validación autoritativa antes de
// escribir nada (Fase 8: nunca confiar en un "válido" calculado del
// lado del cliente).

export const IMPORT_MODULES = ["contact", "company", "lead"] as const;
export type ImportModule = (typeof IMPORT_MODULES)[number];

// Límites deliberados de esta primera versión — ver resumen final. Un
// archivo más grande es "importación masiva", explícitamente fuera de
// alcance por ahora.
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_COLUMNS = 100;

export interface StandardFieldDef {
  key: string;
  label: string;
  required?: boolean;
  kind: "text" | "email" | "phone";
  synonyms: string[];
}

export interface ImportModuleDef {
  module: ImportModule;
  label: string;
  // Mismo string que ya usa CustomFieldDefinition.entityType/CustomFieldValue
  // en el resto del CRM — se reutiliza tal cual, no se inventa un tipo nuevo.
  entityType: "contact" | "company" | "lead";
  standardFields: StandardFieldDef[];
  // Identificadores usados para detectar duplicados, en orden de
  // prioridad (Fase 6). Documentado explícitamente: si una fila no trae
  // ninguno de estos valores, SIEMPRE se crea un registro nuevo — no hay
  // manera segura de saber si "coincide" con algo existente, y por eso no
  // se inventa un match por nombre (ambiguo: dos empresas o personas
  // pueden compartir nombre).
  identifierFields: string[];
}

export const IMPORT_MODULE_DEFS: Record<ImportModule, ImportModuleDef> = {
  contact: {
    module: "contact",
    label: "Contactos",
    entityType: "contact",
    identifierFields: ["email", "phone"],
    standardFields: [
      { key: "name", label: "Nombre", required: true, kind: "text", synonyms: ["nombre", "cliente", "name", "contacto", "razon social"] },
      { key: "email", label: "Email", kind: "email", synonyms: ["email", "correo", "mail", "e-mail"] },
      { key: "phone", label: "Teléfono", kind: "phone", synonyms: ["telefono", "teléfono", "phone", "celular", "whatsapp", "tel"] },
    ],
  },
  company: {
    module: "company",
    label: "Empresas",
    entityType: "company",
    identifierFields: ["domain", "phone"],
    standardFields: [
      { key: "name", label: "Nombre", required: true, kind: "text", synonyms: ["nombre", "empresa", "cliente", "name", "razon social"] },
      { key: "domain", label: "Dominio / Sitio web", kind: "text", synonyms: ["dominio", "sitio", "web", "website", "domain", "url"] },
      { key: "phone", label: "Teléfono", kind: "phone", synonyms: ["telefono", "teléfono", "phone", "celular", "whatsapp", "tel"] },
    ],
  },
  lead: {
    module: "lead",
    label: "Leads",
    entityType: "lead",
    identifierFields: ["email", "phone"],
    standardFields: [
      { key: "name", label: "Nombre", required: true, kind: "text", synonyms: ["nombre", "cliente", "name", "lead", "razon social"] },
      { key: "email", label: "Email", kind: "email", synonyms: ["email", "correo", "mail", "e-mail"] },
      { key: "phone", label: "Teléfono", kind: "phone", synonyms: ["telefono", "teléfono", "phone", "celular", "whatsapp", "tel"] },
    ],
  },
};

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Mismo algoritmo que ya usa components/custom-fields/custom-fields-manager.tsx
// para derivar un `key` de CustomFieldDefinition a partir de una etiqueta.
export function slugifyKey(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || `campo_${Date.now()}`;
}

// Sugerencia de mapeo automático (Fase 2): compara el header normalizado
// contra los sinónimos de cada campo estándar del módulo. Nunca reemplaza
// la posibilidad de mapear a mano — sólo precompleta el <select>.
export function suggestStandardField(header: string, moduleDef: ImportModuleDef): string | null {
  const h = normalizeHeader(header);
  for (const field of moduleDef.standardFields) {
    if (field.synonyms.some((s) => h === s || h.replace(/\s+/g, "") === s.replace(/\s+/g, ""))) return field.key;
  }
  return null;
}

export type GuessedType = "text" | "number" | "boolean" | "date";

const BOOLEAN_TRUE = new Set(["si", "sí", "yes", "true", "1", "x"]);
const BOOLEAN_FALSE = new Set(["no", "false", "0"]);

// Heurística simple sobre una muestra de valores no vacíos — sólo para
// PRE-SELECCIONAR el tipo al crear un custom field desde el importador
// (Fase 4: "si es posible detectar razonablemente el tipo... mostrar una
// sugerencia, pero el usuario siempre debe poder cambiarlo").
export function guessColumnType(samples: string[]): GuessedType {
  const values = samples.map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return "text";

  if (values.every((v) => BOOLEAN_TRUE.has(v.toLowerCase()) || BOOLEAN_FALSE.has(v.toLowerCase()))) return "boolean";
  if (values.every((v) => /^-?\d+([.,]\d+)?$/.test(v))) return "number";
  if (values.every((v) => !Number.isNaN(Date.parse(normalizeDateForParse(v))))) return "date";
  return "text";
}

function normalizeDateForParse(v: string): string {
  // Date.parse no entiende dd/mm/yyyy de forma confiable — lo reordena a
  // yyyy-mm-dd para el chequeo heurístico únicamente.
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v;
}

export type MappingTarget =
  | { kind: "ignore" }
  | { kind: "standard"; fieldKey: string }
  | { kind: "custom"; definitionId: string; fieldType: string; options: string[] };

export interface ColumnMapping {
  column: string;
  target: MappingTarget;
}

export interface RowValidationResult {
  standard: Record<string, string>;
  custom: Record<string, string>;
  errors: string[];
}

export function validateStandardValue(field: StandardFieldDef, raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return field.required ? `Falta "${field.label}"` : null;
  }
  if (field.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `"${field.label}" no es un email válido: ${value}`;
  return null;
}

export interface CustomFieldTypeInfo {
  type: string;
  options: string[];
  label: string;
}

// Recibe SIEMPRE type/options de una fuente autoritativa (las
// definiciones reales del negocio) — nunca del propio cliente: ver la
// diferencia entre `MappingTarget.custom` (lo que arma la UI para el
// preview, con datos que el propio cliente ya tiene) y cómo
// modules/import/execute.ts vuelve a llamar a esta misma función con la
// definición releída de la base.
export function validateCustomValue(info: CustomFieldTypeInfo, raw: string): string | null {
  const value = raw.trim();
  const { label } = info;
  if (!value) return null;
  switch (info.type) {
    case "number":
    case "currency":
      if (Number.isNaN(Number(value.replace(",", ".")))) return `"${label}" no es un número válido: ${value}`;
      return null;
    case "boolean":
      if (!BOOLEAN_TRUE.has(value.toLowerCase()) && !BOOLEAN_FALSE.has(value.toLowerCase())) return `"${label}" no es sí/no: ${value}`;
      return null;
    case "date":
    case "datetime":
      if (Number.isNaN(Date.parse(normalizeDateForParse(value)))) return `"${label}" no es una fecha válida: ${value}`;
      return null;
    case "select":
      if (info.options.length > 0 && !info.options.includes(value)) return `"${label}": "${value}" no está entre las opciones`;
      return null;
    case "multiselect":
      if (info.options.length > 0) {
        const parts = value.split(",").map((p) => p.trim());
        const bad = parts.find((p) => !info.options.includes(p));
        if (bad) return `"${label}": "${bad}" no está entre las opciones`;
      }
      return null;
    default:
      return null;
  }
}

// Corre el mapeo completo sobre UNA fila cruda del archivo. Usada tal
// cual del lado del cliente (preview) y del lado del servidor
// (autoritativa, dentro de modules/import/execute.ts).
export function applyMapping(
  row: Record<string, string>,
  mapping: ColumnMapping[],
  moduleDef: ImportModuleDef,
  customLabelByDefinitionId: Map<string, string>
): RowValidationResult {
  const standard: Record<string, string> = {};
  const custom: Record<string, string> = {};
  const errors: string[] = [];

  for (const { column, target } of mapping) {
    const raw = row[column] ?? "";
    if (target.kind === "ignore") continue;

    if (target.kind === "standard") {
      const field = moduleDef.standardFields.find((f) => f.key === target.fieldKey);
      if (!field) continue;
      const error = validateStandardValue(field, raw);
      if (error) errors.push(error);
      else if (raw.trim()) standard[field.key] = raw.trim();
      continue;
    }

    const label = customLabelByDefinitionId.get(target.definitionId) ?? target.definitionId;
    const error = validateCustomValue({ type: target.fieldType, options: target.options, label }, raw);
    if (error) errors.push(error);
    else if (raw.trim()) custom[target.definitionId] = raw.trim();
  }

  const requiredField = moduleDef.standardFields.find((f) => f.required);
  if (requiredField && !standard[requiredField.key] && !errors.some((e) => e.includes(requiredField.label))) {
    errors.push(`Falta "${requiredField.label}"`);
  }

  return { standard, custom, errors };
}
