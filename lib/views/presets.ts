// Vistas predefinidas (no se guardan en la base: son atajos a filtros).
// Cada una es solo un query string sobre la misma lista.
export interface ViewPreset {
  id: string;
  name: string;
  params: string;
  hint: string;
}

export const LEAD_PRESETS: ViewPreset[] = [
  { id: "preset:new", name: "Leads nuevos", params: "status=new&sort=recent", hint: "En estado inicial, más recientes primero" },
  { id: "preset:unassigned", name: "Leads sin responsable", params: "ownerId=none&open=1", hint: "Abiertos y sin asignar" },
  { id: "preset:nofollowup", name: "Leads sin seguimiento", params: "open=1&nofollowup=3&sort=followup", hint: "Abiertos sin llamada/email/reunión/nota en 3 días" },
  { id: "preset:mine", name: "Mis leads", params: "ownerId=me&open=1", hint: "Abiertos asignados a vos" },
];

export const OPPORTUNITY_PRESETS: ViewPreset[] = [
  { id: "preset:stalled", name: "Oportunidades estancadas", params: "stalled=1&display=list&sort=updated", hint: "Abiertas sin cambios en 14 días" },
  { id: "preset:mine", name: "Mis oportunidades", params: "ownerId=me&status=open", hint: "Abiertas asignadas a vos" },
  { id: "preset:unassigned", name: "Sin responsable", params: "ownerId=none&status=open&display=list", hint: "Abiertas sin asignar" },
  { id: "preset:top", name: "Mayor valor", params: "status=open&display=list&sort=amount", hint: "Abiertas ordenadas por valor" },
];

// Parámetros que NO forman parte de una vista (navegación/estado efímero).
const EPHEMERAL = new Set(["view", "page"]);

/** Normaliza un query string para guardarlo/compararlo (orden estable). */
export function normalizeViewParams(input: string | URLSearchParams): string {
  const sp = new URLSearchParams(input);
  const entries = Array.from(sp.entries()).filter(([k, v]) => !EPHEMERAL.has(k) && v !== "");
  entries.sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}
