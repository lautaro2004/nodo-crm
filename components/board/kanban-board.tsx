"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { InlineAlert } from "@/components/ui/primitives";
import { resolveStatusColor } from "@/lib/status-colors";
import { readApiError } from "@/lib/error-messages";

export interface BoardColumn {
  id: string;
  label: string;
  color: string | null | undefined;
  /** false = no se puede soltar acá (ej. "Convertido": solo vía el wizard). */
  droppable?: boolean;
  /** Texto bajo el título (ej. suma de montos). */
  meta?: ReactNode;
  /** Mensaje del estado vacío de la columna. */
  emptyLabel?: string;
}

export interface BoardItem {
  id: string;
  columnId: string;
  /** false = la tarjeta no se puede mover (ej. lead ya convertido). */
  movable?: boolean;
}

export type MoveResult = { ok: true } | { ok: false; error: string };

// Kanban compartido por Leads y Oportunidades.
//
// - Mismos datos que la vista Lista: la página (server component) lee y
//   pasa los registros; acá no hay una segunda fuente de verdad.
// - Mover = drag & drop (desktop) o el selector "Mover a…" de cada tarjeta
//   (teclado, lectores de pantalla y pantallas táctiles, donde el DnD
//   nativo de HTML5 no funciona).
// - Persistencia real: `onMove` hace el PATCH y devuelve ok/error. La
//   tarjeta se mueve de forma optimista; si el servidor rechaza (transición
//   no permitida, sin conexión, registro borrado por otra persona) vuelve
//   a su columna y se muestra el motivo. Tras guardar se refresca la página
//   para traer el estado real (incluidos cambios de otros usuarios).
export function KanbanBoard<T extends BoardItem>({
  columns,
  items,
  renderCard,
  onMove,
  itemNoun = "registros",
}: {
  columns: BoardColumn[];
  items: T[];
  renderCard: (item: T) => ReactNode;
  onMove: (item: T, toColumnId: string) => Promise<MoveResult>;
  itemNoun?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Movimientos optimistas en vuelo: id -> columna destino.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const view = items.map((i) => (overrides[i.id] ? { ...i, columnId: overrides[i.id] } : i));
  const droppableIds = new Set(columns.filter((c) => c.droppable !== false).map((c) => c.id));

  function clearOverride(id: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function move(item: T, toColumnId: string) {
    const fromColumnId = overrides[item.id] ?? item.columnId;
    if (toColumnId === fromColumnId || !droppableIds.has(toColumnId) || item.movable === false) return;
    if (savingIds.has(item.id)) return; // evita dos PATCH concurrentes sobre la misma tarjeta

    setError(null);
    setOverrides((o) => ({ ...o, [item.id]: toColumnId }));
    setSavingIds((prev) => new Set(prev).add(item.id));

    let result: MoveResult;
    try {
      result = await onMove(item, toColumnId);
    } catch {
      result = { ok: false, error: "Sin conexión. El cambio no se guardó." };
    }

    if (!result.ok) {
      clearOverride(item.id);
      setError(result.error);
      return;
    }
    // El override se limpia en la misma transición que el refresh: la
    // tarjeta no "salta" de vuelta mientras llegan los datos nuevos.
    startTransition(() => {
      router.refresh();
      clearOverride(item.id);
    });
  }

  return (
    <div>
      {error && <InlineAlert onDismiss={() => setError(null)}>{error}</InlineAlert>}

      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0" role="list" aria-label="Tablero Kanban">
        {columns.map((column) => {
          const cards = view.filter((i) => i.columnId === column.id);
          const color = resolveStatusColor(column.color);
          const canDrop = column.droppable !== false;
          const isOver = overColumn === column.id && dragId !== null && canDrop;
          return (
            <section
              key={column.id}
              role="listitem"
              aria-label={`${column.label}: ${cards.length}`}
              onDragOver={(e) => {
                if (!canDrop || !dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overColumn !== column.id) setOverColumn(column.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverColumn(null);
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setDragId(null);
                const item = items.find((i) => i.id === id);
                if (item) move(item, column.id);
              }}
              className={`flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl border transition-colors sm:w-72 ${
                isOver ? "border-brand-300 bg-brand-50/70" : "border-slate-200/70 bg-slate-100/60"
              }`}
            >
              <header className="px-3 pt-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-800">
                    <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot}`} />
                    <span className="truncate">{column.label}</span>
                  </h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200/80">
                    {cards.length}
                  </span>
                </div>
                {column.meta && <div className="mt-0.5 pl-[18px] text-xs text-slate-500">{column.meta}</div>}
                {!canDrop && <p className="mt-1 pl-[18px] text-[11px] text-slate-400">Solo lectura</p>}
              </header>

              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {cards.map((item) => {
                  const movable = item.movable !== false;
                  const saving = savingIds.has(item.id);
                  return (
                    <article
                      key={item.id}
                      draggable={movable && !saving}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", item.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(item.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverColumn(null);
                      }}
                      className={`group rounded-xl border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-card)] transition-[box-shadow,opacity,border-color] ${
                        movable ? "cursor-grab hover:border-slate-300 hover:shadow-[0_6px_16px_-8px_rgb(32_33_36/0.25)] active:cursor-grabbing" : ""
                      } ${dragId === item.id ? "opacity-50" : ""} ${saving ? "opacity-70" : ""}`}
                      aria-busy={saving}
                    >
                      {renderCard(item)}
                      {movable && (
                        <label className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                          <span className="shrink-0">Mover a</span>
                          <select
                            value={item.columnId}
                            disabled={saving}
                            onChange={(e) => move(item, e.target.value)}
                            className="min-w-0 flex-1 cursor-pointer truncate rounded-md border-0 bg-transparent py-0.5 pr-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                          >
                            {columns.map((c) => (
                              <option key={c.id} value={c.id} disabled={c.droppable === false && c.id !== item.columnId}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </article>
                  );
                })}
                {cards.length === 0 && (
                  <div
                    className={`flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-6 text-center text-xs ${
                      isOver ? "border-brand-300 text-brand-700" : "border-slate-300/70 text-slate-400"
                    }`}
                  >
                    {isOver ? "Soltá acá" : (column.emptyLabel ?? `Sin ${itemNoun}`)}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// PATCH genérico para un `onMove`: traduce la respuesta a MoveResult con
// el mensaje en castellano del código de error de la API.
export async function patchMove(url: string, body: Record<string, unknown>): Promise<MoveResult> {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return { ok: true };
  if (res.status === 404) return { ok: false, error: "Este registro ya no existe (¿lo borró otra persona?). Recargá la página." };
  return { ok: false, error: await readApiError(res) };
}
