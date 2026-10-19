import { normalizeCustomValue, validateCustomValue } from "@/lib/custom-fields";

// Normalización y mapeo de datos externos (filas de Sheets, mensajes de
// Instagram) a un lead de Nodo. Funciones puras: sin base de datos, para
// poder testearlas y reutilizarlas en la "prueba de mapeo" de la UI.

export const LEAD_TARGETS = ["name", "email", "phone", "note"] as const;
export type StandardTarget = (typeof LEAD_TARGETS)[number];
/** Destino de una columna: campo estándar, campo personalizado (`cf:<id>`) o ignorar. */
export type MappingTarget = StandardTarget | `cf:${string}` | "ignore";

export const TARGET_LABELS: Record<StandardTarget, string> = {
  name: "Nombre",
  email: "Email",
  phone: "Teléfono",
  note: "Mensaje / nota",
};

export interface CustomFieldInfo {
  id: string;
  label: string;
  type: string;
  options: string[];
}

export interface NormalizedLeadData {
  name: string | null;
  email: string | null;
  phone: string | null;
  note: string | null;
  custom: Record<string, string>; // definitionId → valor ya normalizado
}

export type MapResult = { ok: true; data: NormalizedLeadData } | { ok: false; errors: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 500;
const MAX_NOTE = 2000;

export function normalizeEmail(raw: string | null | undefined): string | null | "invalid" {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return null;
  return EMAIL_RE.test(value) && value.length <= 254 ? value : "invalid";
}

/**
 * Teléfono: se conserva un "+" inicial y los dígitos. Válido entre 6 y 15
 * dígitos (E.164). No se inventa un código de país.
 */
export function normalizePhone(raw: string | null | undefined): string | null | "invalid" {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return "invalid";
  return (value.startsWith("+") ? "+" : "") + digits;
}

/** Clave de comparación de teléfonos: últimos 10 dígitos (ignora prefijos 0/15/+54). */
export function phoneMatchKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits.slice(-10) : null;
}

function clean(raw: unknown, max = MAX_TEXT): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).replace(/\s+/g, " ").trim();
  return value ? value.slice(0, max) : null;
}

/**
 * Aplica el mapeo configurado a una fila (`encabezado → valor`), valida y
 * normaliza. `required` lista destinos obligatorios (ej. ["name", "email"]).
 * Además siempre se exige al menos un dato de contacto o un nombre.
 */
export function mapRow(
  values: Record<string, unknown>,
  mapping: Record<string, MappingTarget>,
  required: string[],
  customFields: CustomFieldInfo[]
): MapResult {
  const errors: string[] = [];
  const raw: Partial<Record<StandardTarget, string>> = {};
  const rawCustom: Record<string, string> = {};
  const cfById = new Map(customFields.map((f) => [f.id, f]));

  for (const [header, target] of Object.entries(mapping)) {
    if (!target || target === "ignore") continue;
    const value = clean(values[header], target === "note" ? MAX_NOTE : MAX_TEXT);
    if (value === null) continue;
    if (target.startsWith("cf:")) {
      const id = target.slice(3);
      if (cfById.has(id)) rawCustom[id] = value;
    } else if ((LEAD_TARGETS as readonly string[]).includes(target)) {
      const key = target as StandardTarget;
      // Dos columnas al mismo destino: se concatenan solo para la nota.
      raw[key] = key === "note" && raw.note ? `${raw.note}\n${value}`.slice(0, MAX_NOTE) : (raw[key] ?? value);
    }
  }

  const email = normalizeEmail(raw.email);
  if (email === "invalid") errors.push(`Email inválido: ${raw.email}`);
  const phone = normalizePhone(raw.phone);
  if (phone === "invalid") errors.push(`Teléfono inválido: ${raw.phone}`);

  const custom: Record<string, string> = {};
  for (const [id, value] of Object.entries(rawCustom)) {
    const def = cfById.get(id)!;
    const message = validateCustomValue({ type: def.type, options: def.options, label: def.label }, value);
    if (message) errors.push(message);
    else {
      const normalized = normalizeCustomValue(def.type, value);
      if (normalized !== null) custom[id] = normalized;
    }
  }

  const data: NormalizedLeadData = {
    name: raw.name ?? null,
    email: email === "invalid" ? null : email,
    phone: phone === "invalid" ? null : phone,
    note: raw.note ?? null,
    custom,
  };

  for (const target of required) {
    const present = target.startsWith("cf:") ? !!data.custom[target.slice(3)] : !!data[target as StandardTarget];
    if (!present) {
      const label = target.startsWith("cf:") ? (cfById.get(target.slice(3))?.label ?? "Campo personalizado") : (TARGET_LABELS[target as StandardTarget] ?? target);
      errors.push(`Falta el dato obligatorio "${label}"`);
    }
  }
  if (!data.name && !data.email && !data.phone) errors.push("La fila no tiene nombre, email ni teléfono");

  return errors.length ? { ok: false, errors: Array.from(new Set(errors)) } : { ok: true, data };
}

/** Nombre a usar cuando la fuente no trae uno (nunca se deja vacío). */
export function fallbackLeadName(data: Pick<NormalizedLeadData, "name" | "email" | "phone">, sourceLabel: string): string {
  return data.name ?? data.email ?? data.phone ?? `Lead de ${sourceLabel}`;
}
