export const TEMPLATE_VARIABLES = [
  { key: "contact.name", label: "Nombre del contacto" },
  { key: "company.name", label: "Nombre de la empresa" },
  { key: "lead.name", label: "Nombre del lead" },
  { key: "opportunity.name", label: "Nombre de la oportunidad" },
] as const;
export type VariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type VariableValues = Partial<Record<VariableKey, string>>;

export type EmailEntityType = "contact" | "lead" | "opportunity";

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
const VAR_RE = /\{\{\s*([a-zA-Z]+\.[a-zA-Z]+)\s*\}\}/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Reemplaza sólo variables conocidas que tengan valor. Las demás (sin
// dato para esta entidad, o desconocidas) quedan literales y se listan en
// `unresolved` para que el usuario las edite antes de enviar.
export function renderTemplate(text: string, values: VariableValues, opts: { html?: boolean } = {}) {
  const unresolved = new Set<string>();
  const output = text.replace(VAR_RE, (match, key: string) => {
    const value = KNOWN.has(key) ? values[key as VariableKey] : undefined;
    if (value === undefined || value === "") {
      unresolved.add(key);
      return match;
    }
    return opts.html ? escapeHtml(value) : value;
  });
  return { output, unresolved: [...unresolved] };
}

export function findVariables(text: string): string[] {
  return [...new Set([...text.matchAll(VAR_RE)].map((m) => m[1]))];
}

export const SAMPLE_VALUES: VariableValues = {
  "contact.name": "Juan Pérez",
  "company.name": "Acme S.A.",
  "lead.name": "María Gómez",
  "opportunity.name": "Proyecto Acme",
};
