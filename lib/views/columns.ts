// Columnas configurables de las listas. Solo claves y nombres (sin JSX):
// lo usan tanto el selector de columnas (cliente) como las tablas y la
// exportación CSV (servidor). El orden y la visibilidad viajan en la URL
// (`cols=name,status,owner`), igual que los filtros, y por eso se guardan
// con las vistas guardadas sin persistencia adicional.

export interface ColumnDef {
  key: string;
  label: string;
  /** Siempre visible y primera (identifica el registro). */
  locked?: boolean;
}

export const LEAD_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Nombre", locked: true },
  { key: "contact", label: "Contacto" },
  { key: "company", label: "Empresa" },
  { key: "status", label: "Estado" },
  { key: "owner", label: "Responsable" },
  { key: "source", label: "Origen" },
  { key: "lastFollowUp", label: "Último seguimiento" },
  { key: "reason", label: "Motivo" },
  { key: "created", label: "Creado" },
  { key: "updated", label: "Actualizado" },
];
export const LEAD_DEFAULT_COLUMNS = ["name", "contact", "status", "owner", "source", "lastFollowUp"];

export const OPPORTUNITY_COLUMNS: ColumnDef[] = [
  { key: "title", label: "Título", locked: true },
  { key: "account", label: "Empresa / Contacto" },
  { key: "stage", label: "Etapa" },
  { key: "status", label: "Estado" },
  { key: "amount", label: "Valor" },
  { key: "owner", label: "Responsable" },
  { key: "created", label: "Creada" },
  { key: "updated", label: "Actualizada" },
  { key: "closed", label: "Cerrada" },
];
export const OPPORTUNITY_DEFAULT_COLUMNS = ["title", "account", "stage", "status", "amount", "owner", "updated"];

/** Columnas visibles en orden, a partir de `cols` (inválidas se ignoran). */
export function resolveColumns(all: ColumnDef[], defaults: string[], raw: string | undefined | null): string[] {
  const valid = new Set(all.map((c) => c.key));
  const requested = raw ? raw.split(",").filter((k) => valid.has(k)) : defaults;
  const locked = all.filter((c) => c.locked).map((c) => c.key);
  const rest = Array.from(new Set(requested)).filter((k) => !locked.includes(k));
  return [...locked, ...rest];
}
