import type { RecordNoun } from "@/components/records/use-delete-records";

// Sustantivos para los textos de selección y borrado.
export const RECORD_NOUNS = {
  lead: { one: "lead", many: "leads" },
  contact: { one: "contacto", many: "contactos" },
  company: { one: "empresa", many: "empresas", feminine: true },
  opportunity: { one: "oportunidad", many: "oportunidades", feminine: true },
} satisfies Record<string, RecordNoun>;

const MASCULINE_IN_A = new Set(["día", "dia", "problema", "sistema", "tema", "programa", "mapa", "plan", "idioma", "clima", "esquema", "diagrama"]);

/**
 * Género aproximado de un nombre que elige el negocio ("Caso", "Venta",
 * "Proyecto", "Operación", "Cita") para concordar "seleccionado/a".
 */
export function guessFeminine(word: string): boolean {
  const w = word.trim().toLowerCase().split(/\s+/)[0] ?? "";
  if (MASCULINE_IN_A.has(w)) return false;
  return /(a|ión|ion|dad|tad|tud|umbre)$/.test(w);
}

/** Sustantivo a partir de las etiquetas configuradas de un módulo. */
export function nounFromLabels(singular: string, plural: string): RecordNoun {
  return { one: singular.toLowerCase(), many: plural.toLowerCase(), feminine: guessFeminine(singular) };
}
