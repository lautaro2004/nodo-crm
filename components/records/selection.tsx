"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button, Spinner } from "@/components/ui/primitives";
import { TrashIcon, XIcon } from "@/components/ui/icons";
import { useDeleteRecords, type RecordNoun } from "@/components/records/use-delete-records";

// Selección múltiple compartida por todas las listas (tabla y Kanban) de
// Leads, Contactos, Empresas, Oportunidades y módulos personalizados.
//
//   <RecordSelection entityType="lead" ids={leads.map(l => l.id)} noun={…} canDelete={isAdmin}>
//     …<SelectAllHeader /> en el <thead>, <SelectCell id={…} /> en cada fila…
//   </RecordSelection>
//
// Las tablas siguen siendo componentes de servidor: solo las celdas de
// selección son de cliente. Sin permiso de borrado (miembros) no se
// muestran ni las casillas ni la barra.

interface SelectionState {
  enabled: boolean;
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  setAll: (value: boolean) => void;
}

const SelectionContext = createContext<SelectionState | null>(null);

function useSelection() {
  return useContext(SelectionContext);
}

export function RecordSelection({
  entityType,
  ids,
  noun,
  canDelete,
  children,
}: {
  entityType: string;
  /** Registros visibles (en el orden en que se muestran). */
  ids: string[];
  noun: RecordNoun;
  canDelete: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const { deleteRecords, busy } = useDeleteRecords(entityType, noun);

  // Si cambia la lista (filtros, búsqueda, recarga), la selección se queda
  // solo con lo que sigue visible: nunca se borra algo que no se ve.
  const idsKey = ids.join(",");
  useEffect(() => {
    const visible = new Set(idsKey ? idsKey.split(",") : []);
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [idsKey]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const setAll = useCallback((value: boolean) => setSelected(value ? new Set(ids) : new Set()), [ids]);

  const value = useMemo<SelectionState>(() => ({ enabled: canDelete, ids, selected, toggle, setAll }), [canDelete, ids, selected, toggle, setAll]);

  async function removeSelected() {
    const outcome = await deleteRecords([...selected]);
    if (!outcome.done) return;
    // Quedan seleccionados solo los que fallaron (para reintentar).
    setSelected(new Set(outcome.failed));
    router.refresh();
  }

  const n = selected.size;
  return (
    <SelectionContext.Provider value={value}>
      {children}
      {/* Espacio para que la barra fija no tape la última fila. */}
      {canDelete && n > 0 && <div aria-hidden className="h-20" />}
      {canDelete && n > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="region" aria-label="Acciones sobre la selección">
          <div className="pointer-events-auto flex animate-fade-in items-center gap-2 rounded-2xl bg-slate-900 py-2 pl-4 pr-2 text-sm text-white shadow-xl shadow-slate-900/20">
            <span className="font-medium tabular-nums" aria-live="polite">
              {n} {n === 1 ? `${noun.one} seleccionad${noun.feminine ? "a" : "o"}` : `${noun.many} seleccionad${noun.feminine ? "as" : "os"}`}
            </span>
            {n < ids.length && (
              <button type="button" className="rounded-lg px-2 py-1 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setAll(true)} disabled={busy}>
                Seleccionar {ids.length === 1 ? "el visible" : `los ${ids.length} visibles`}
              </button>
            )}
            <Button size="sm" variant="danger" onClick={() => void removeSelected()} disabled={busy}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : <TrashIcon className="h-3.5 w-3.5" />}
              Eliminar
            </Button>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
              onClick={() => setAll(false)}
              disabled={busy}
              aria-label="Quitar selección"
              title="Quitar selección"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </SelectionContext.Provider>
  );
}

const BOX = "h-4 w-4 cursor-pointer rounded accent-brand-500 align-middle";

/** Casilla "seleccionar todos los visibles" (con estado intermedio). */
export function SelectAllCheckbox({ label }: { label?: string }) {
  const s = useSelection();
  const ref = useRef<HTMLInputElement>(null);
  const all = !!s && s.ids.length > 0 && s.selected.size === s.ids.length;
  const some = !!s && s.selected.size > 0 && !all;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = some;
  }, [some]);
  if (!s?.enabled || s.ids.length === 0) return null;
  const input = (
    <input
      ref={ref}
      type="checkbox"
      className={BOX}
      checked={all}
      onChange={(e) => s.setAll(e.target.checked)}
      aria-label={label ? undefined : "Seleccionar todos los visibles"}
    />
  );
  return label ? (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
      {input}
      {label}
    </label>
  ) : (
    input
  );
}

/** Casilla de un registro (para tarjetas de Kanban u otros contenedores). */
export function RecordCheckbox({ id, label }: { id: string; label: string }) {
  const s = useSelection();
  if (!s?.enabled) return null;
  return (
    <input
      type="checkbox"
      className={BOX}
      checked={s.selected.has(id)}
      onChange={() => s.toggle(id)}
      // No inicia el arrastre de la tarjeta ni navega.
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      aria-label={`Seleccionar ${label}`}
    />
  );
}

/** <th> con la casilla de "todos" (no se renderiza sin permiso). */
export function SelectAllHeader({ plain = false }: { /** Encabezado sin fondo (tablas simples). */ plain?: boolean }) {
  const s = useSelection();
  if (!s?.enabled) return null;
  return (
    <th className={`w-10 pl-4 pr-0 text-left ${plain ? "py-3" : "bg-slate-50/70 py-2.5"}`}>
      <SelectAllCheckbox />
    </th>
  );
}

/** <td> con la casilla del registro (no se renderiza sin permiso). */
export function SelectCell({ id, label }: { id: string; label: string }) {
  const s = useSelection();
  if (!s?.enabled) return null;
  return (
    <td className="w-10 py-3 pl-4 pr-0">
      <RecordCheckbox id={id} label={label} />
    </td>
  );
}

/** Fondo de fila seleccionada (envuelve <tr> en tablas de servidor). */
export function SelectableRow({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const s = useSelection();
  const on = !!s?.enabled && s.selected.has(id);
  return (
    <tr className={`${className ?? ""} ${on ? "bg-brand-50/60 hover:bg-brand-50/80" : ""}`} aria-selected={s?.enabled ? on : undefined}>
      {children}
    </tr>
  );
}

/** Fila "Seleccionar todos los visibles" sobre un Kanban (sin permiso: nada). */
export function SelectAllBar() {
  const s = useSelection();
  if (!s?.enabled || s.ids.length === 0) return null;
  return (
    <div className="mb-2 flex items-center">
      <SelectAllCheckbox label={`Seleccionar todos los visibles (${s.ids.length})`} />
    </div>
  );
}
