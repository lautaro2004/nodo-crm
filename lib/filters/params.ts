// Lectura de filtros desde la URL. La URL es la ÚNICA fuente de estado de
// una lista (filtros, columnas, orden, Lista/Kanban): las vistas guardadas
// solo guardan ese query string, la exportación CSV y los informes lo
// reciben tal cual. Así no hay dos lógicas de filtrado distintas.

export type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

export function getParam(sp: SearchParamsLike, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Lista separada por comas: `status=new,contacted`. */
export function getList(sp: SearchParamsLike, key: string): string[] | undefined {
  const raw = getParam(sp, key);
  if (!raw) return undefined;
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export function getInt(sp: SearchParamsLike, key: string, min = 0, max = 3650): number | undefined {
  const raw = getParam(sp, key);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha `YYYY-MM-DD` (inicio del día, hora de Argentina). */
export function getDay(sp: SearchParamsLike, key: string): Date | undefined {
  const raw = getParam(sp, key);
  if (!raw || !DAY_RE.test(raw)) return undefined;
  const d = new Date(`${raw}T00:00:00-03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Fin de día exclusivo para un `to=YYYY-MM-DD` inclusivo. */
export function endOfDay(d: Date): Date {
  return new Date(d.getTime() + 86_400_000);
}

/** Filtros de campo personalizado: `cf.<definitionId>=valor`. */
export function getCustomFieldFilters(sp: SearchParamsLike): { definitionId: string; value: string }[] {
  const entries: [string, string][] =
    sp instanceof URLSearchParams
      ? Array.from(sp.entries())
      : Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]]));
  return entries
    .filter(([k, v]) => k.startsWith("cf.") && k.length > 3 && v.trim())
    .map(([k, v]) => ({ definitionId: k.slice(3), value: v.trim() }));
}

export function toURLSearchParams(sp: SearchParamsLike): URLSearchParams {
  if (sp instanceof URLSearchParams) return new URLSearchParams(sp);
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v === undefined) continue;
    out.set(k, Array.isArray(v) ? v[0] : v);
  }
  return out;
}
