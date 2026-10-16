// Paleta de 10 colores para estados (Lead/Empresa) y etapas de pipeline.
//
// - Lo que se guarda en la base es la CLAVE (`"sky"`, `"emerald"`, …), no
//   un hex: así la paleta puede ajustarse (contraste, modo oscuro futuro)
//   sin migrar datos.
// - El color es solo visual: nombre, orden, isWon/isLost y las reglas de
//   transición NO dependen de él.
// - Compatibilidad: los Workspaces creados antes guardaron hex (ver
//   lib/industry-templates.ts histórico). `resolveStatusColor` los mapea a
//   la clave equivalente al LEER — no se reescribe ningún dato existente.
//   Un valor desconocido o null cae en "slate" (neutro), nunca en un color
//   inventado.
//
// Las clases van escritas completas (no interpoladas) para que Tailwind las
// detecte en el build.

export const STATUS_COLOR_KEYS = [
  "slate",
  "sky",
  "blue",
  "violet",
  "pink",
  "orange",
  "amber",
  "teal",
  "emerald",
  "red",
] as const;

export type StatusColorKey = (typeof STATUS_COLOR_KEYS)[number];

export interface StatusColor {
  key: StatusColorKey;
  label: string;
  hint: string;
  /** Punto/indicador (contraste ≥ 3:1 sobre blanco, apto para no-texto). */
  dot: string;
  /** Chip de estado: fondo suave + texto oscuro (≥ 4.5:1) + borde. */
  badge: string;
  /** Borde superior de la columna Kanban. */
  bar: string;
  /** Fondo tenue de la columna Kanban. */
  column: string;
  /** Hex del punto, para usos fuera de Tailwind. */
  hex: string;
}

export const STATUS_COLORS: Record<StatusColorKey, StatusColor> = {
  slate: {
    key: "slate",
    label: "Gris",
    hint: "Neutro / inicial",
    dot: "bg-slate-400",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    bar: "bg-slate-400",
    column: "bg-slate-100/60",
    hex: "#a4a39e",
  },
  sky: {
    key: "sky",
    label: "Celeste",
    hint: "Nuevo / entrada",
    dot: "bg-sky-500",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
    bar: "bg-sky-500",
    column: "bg-sky-50/60",
    hex: "#0ea5e9",
  },
  blue: {
    key: "blue",
    label: "Azul",
    hint: "Contactado / en curso",
    dot: "bg-blue-600",
    badge: "bg-blue-50 text-blue-800 ring-blue-200",
    bar: "bg-blue-600",
    column: "bg-blue-50/60",
    hex: "#2563eb",
  },
  violet: {
    key: "violet",
    label: "Violeta",
    hint: "Calificado / propuesta",
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
    bar: "bg-violet-500",
    column: "bg-violet-50/60",
    hex: "#8b5cf6",
  },
  pink: {
    key: "pink",
    label: "Rosa",
    hint: "Seguimiento especial",
    dot: "bg-pink-500",
    badge: "bg-pink-50 text-pink-800 ring-pink-200",
    bar: "bg-pink-500",
    column: "bg-pink-50/60",
    hex: "#ec4899",
  },
  orange: {
    key: "orange",
    label: "Naranja",
    hint: "Prioridad / negociación",
    dot: "bg-brand-500",
    badge: "bg-brand-50 text-brand-800 ring-brand-200",
    bar: "bg-brand-500",
    column: "bg-brand-50/60",
    hex: "#fb6e1a",
  },
  amber: {
    key: "amber",
    label: "Ámbar",
    hint: "En espera / atención",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    bar: "bg-amber-500",
    column: "bg-amber-50/60",
    hex: "#f59e0b",
  },
  teal: {
    key: "teal",
    label: "Turquesa",
    hint: "Activo / cliente",
    dot: "bg-teal-500",
    badge: "bg-teal-50 text-teal-800 ring-teal-200",
    bar: "bg-teal-500",
    column: "bg-teal-50/60",
    hex: "#14b8a6",
  },
  emerald: {
    key: "emerald",
    label: "Verde",
    hint: "Positivo / ganado",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    bar: "bg-emerald-500",
    column: "bg-emerald-50/60",
    hex: "#10b981",
  },
  red: {
    key: "red",
    label: "Rojo",
    hint: "Perdido / descartado",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-800 ring-red-200",
    bar: "bg-red-500",
    column: "bg-red-50/60",
    hex: "#ef4444",
  },
};

// Hex que guardaron los templates de rubro antes de esta paleta.
const LEGACY_HEX: Record<string, StatusColorKey> = {
  "#64748b": "slate",
  "#94a3b8": "slate",
  "#0ea5e9": "sky",
  "#3b82f6": "blue",
  "#2563eb": "blue",
  "#6366f1": "violet",
  "#8b5cf6": "violet",
  "#ec4899": "pink",
  "#f97316": "orange",
  "#fb6e1a": "orange",
  "#f59e0b": "amber",
  "#eab308": "amber",
  "#14b8a6": "teal",
  "#22c55e": "emerald",
  "#10b981": "emerald",
  "#ef4444": "red",
  "#dc2626": "red",
};

export function isStatusColorKey(value: unknown): value is StatusColorKey {
  return typeof value === "string" && (STATUS_COLOR_KEYS as readonly string[]).includes(value);
}

export function resolveStatusColorKey(value: string | null | undefined): StatusColorKey {
  if (!value) return "slate";
  const v = value.trim().toLowerCase();
  if (isStatusColorKey(v)) return v;
  return LEGACY_HEX[v] ?? "slate";
}

export function resolveStatusColor(value: string | null | undefined): StatusColor {
  return STATUS_COLORS[resolveStatusColorKey(value)];
}

// Color por defecto de una etapa de pipeline sin color configurado: verde
// para Ganado, rojo para Perdido, neutro para el resto. Solo de lectura —
// no se persiste.
export function stageColorKey(stage: { color?: string | null; isWon?: boolean; isLost?: boolean }): StatusColorKey {
  if (stage.color) return resolveStatusColorKey(stage.color);
  if (stage.isWon) return "emerald";
  if (stage.isLost) return "red";
  return "slate";
}
