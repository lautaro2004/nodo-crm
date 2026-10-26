// Lo que una vista NO define se conserva de lo que la persona ya eligió
// (Lista/Kanban, columnas, pipeline). Se usa al aplicar una vista y al
// decidir si está "modificada": lo conservado no cuenta como cambio. Ver
// components/views/list-toolbar.tsx.
const CARRIED_VIEW_KEYS = ["display", "cols", "pipelineId"] as const;

export function withCarriedParams(viewParams: string, current: string | URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(viewParams);
  const cur = new URLSearchParams(current);
  for (const key of CARRIED_VIEW_KEYS) {
    const value = cur.get(key);
    if (value && !next.has(key)) next.set(key, value);
  }
  return next;
}
