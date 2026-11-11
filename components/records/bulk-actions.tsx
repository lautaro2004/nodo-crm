"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/modal";
import { SelectMenu } from "@/components/ui/select-menu";
import { Button } from "@/components/ui/primitives";
import { TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/error-messages";
import type { RecordNoun } from "@/components/records/use-delete-records";

// Menú "Acciones masivas" de la barra de selección: asignar propietario,
// actualizar estado/etapa y eliminar. Las opciones salen del servidor y cada
// cambio se valida ahí, registro por registro (mismas reglas que editar uno).

type Kind = "owner" | "status" | "stage";
interface Option {
  value: string;
  label: string;
}
interface Options {
  kinds: Kind[];
  owners: Option[];
  statuses: (Option & { requiresReason: boolean; reasonOptions: string[] })[];
  pipelines: { id: string; name: string; stages: Option[] }[];
}

const NO_OWNER = "__none__";

function done(noun: RecordNoun, n: number) {
  const suffix = noun.feminine ? (n === 1 ? "actualizada" : "actualizadas") : n === 1 ? "actualizado" : "actualizados";
  return `${n} ${n === 1 ? noun.one : noun.many} ${suffix}`;
}

export function BulkActionsMenu({
  entityType,
  ids,
  noun,
  canDelete,
  busy,
  onDelete,
  onUpdated,
}: {
  entityType: string;
  ids: string[];
  noun: RecordNoun;
  canDelete: boolean;
  busy: boolean;
  onDelete: () => void;
  /** Ids que fallaron (quedan seleccionados para reintentar). */
  onUpdated: (failed: string[]) => void;
}) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [action, setAction] = useState<Kind | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch(`/api/records/bulk-options?entityType=${encodeURIComponent(entityType)}`);
      if (!res.ok) throw new Error("options");
      setOptions((await res.json()) as Options);
    } catch {
      setLoadError(true);
    }
  }, [entityType]);

  useEffect(() => {
    if (menuOpen && !options && !loadError) void loadOptions();
  }, [menuOpen, options, loadError, loadOptions]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const choices = useMemo<Option[]>(() => {
    if (!options || !action) return [];
    if (action === "owner") return [{ value: NO_OWNER, label: "Sin propietario" }, ...options.owners];
    if (action === "status") return options.statuses;
    const many = options.pipelines.length > 1;
    return options.pipelines.flatMap((p) => p.stages.map((s) => ({ value: s.value, label: many ? `${p.name} · ${s.label}` : s.label })));
  }, [options, action]);

  const selectedStatus = action === "status" ? options?.statuses.find((s) => s.value === value) : undefined;
  const needsReason = !!selectedStatus?.requiresReason;
  const canApply = !!value && (!needsReason || reason.trim().length > 0);

  function open(kind: Kind) {
    setMenuOpen(false);
    setAction(kind);
    setValue("");
    setReason("");
    setError(null);
  }

  function close() {
    if (saving) return;
    setAction(null);
  }

  async function apply() {
    if (!action || !canApply) return;
    setSaving(true);
    setError(null);
    const body =
      action === "owner"
        ? { kind: "owner", ownerId: value === NO_OWNER ? null : value }
        : action === "status"
          ? { kind: "status", status: value, statusReason: needsReason ? reason.trim() : null }
          : { kind: "stage", stageId: value };
    try {
      const res = await fetch("/api/records/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, ids, action: body }),
      });
      if (res.status !== 200 && res.status !== 207 && res.status !== 500) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(errorMessage(data.error));
        return;
      }
      const result = (await res.json()) as { updated: string[]; notFound: string[]; failed: string[]; firstError: string | null };
      const ok = result.updated.length;
      if (result.failed.length === 0) {
        toast.success(done(noun, ok));
      } else if (ok > 0) {
        toast.error(`Se actualizaron ${ok} de ${ids.length}`, `${errorMessage(result.firstError)} Los que fallaron quedan seleccionados.`);
      } else {
        toast.error("No se pudo actualizar", errorMessage(result.firstError));
      }
      onUpdated(result.failed);
      if (ok > 0 || result.failed.length === 0) setAction(null);
      else setError(errorMessage(result.firstError));
    } catch {
      setError("Sin conexión. No sabemos si se aplicó el cambio: recargá la página para ver el estado actual.");
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<Kind, string> = {
    owner: "Asignar propietario",
    status: "Actualizar estado",
    stage: "Cambiar etapa",
  };
  const n = ids.length;
  const target = `${n} ${n === 1 ? noun.one : noun.many}`;

  return (
    <div ref={wrapRef} className="relative">
      <Button size="sm" variant="secondary" onClick={() => setMenuOpen((v) => !v)} disabled={busy} aria-haspopup="menu" aria-expanded={menuOpen}>
        Acciones masivas <span aria-hidden>▴</span>
      </Button>
      {menuOpen && (
        <div role="menu" aria-label="Acciones masivas" className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-1 text-slate-800 shadow-xl">
          {!options && !loadError && <p className="px-3 py-2 text-sm text-slate-500">Cargando…</p>}
          {loadError && (
            <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => void loadOptions()}>
              No se pudieron cargar las acciones. Reintentar
            </button>
          )}
          {options?.kinds.includes("owner") && (
            <MenuItem onClick={() => open("owner")}>Asignar propietario</MenuItem>
          )}
          {options?.kinds.includes("status") && <MenuItem onClick={() => open("status")}>Actualizar estado</MenuItem>}
          {options?.kinds.includes("stage") && <MenuItem onClick={() => open("stage")}>Cambiar etapa</MenuItem>}
          {canDelete && (
            <>
              <div className="my-1 h-px bg-slate-100" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <TrashIcon className="h-4 w-4" />
                Eliminar
              </button>
            </>
          )}
        </div>
      )}

      <Modal
        open={action !== null}
        onClose={close}
        busy={saving}
        title={action ? titles[action] : undefined}
        description={action ? `Se aplica a ${target} seleccionad${noun.feminine ? "as" : "os"}.` : undefined}
      >
        <div className="space-y-3">
          <SelectMenu
            value={value}
            onChange={setValue}
            options={choices}
            placeholder={action === "owner" ? "Elegí un propietario" : action === "stage" ? "Elegí una etapa" : "Elegí un estado"}
            ariaLabel={action ? titles[action] : "Opción"}
            searchable={action === "owner"}
            className="w-full"
          />
          {needsReason && selectedStatus && (
            <div>
              <p className="mb-1 text-sm text-slate-700">Este estado exige un motivo.</p>
              {selectedStatus.reasonOptions.length > 0 ? (
                <SelectMenu
                  value={reason}
                  onChange={setReason}
                  options={selectedStatus.reasonOptions.map((r) => ({ value: r, label: r }))}
                  placeholder="Elegí un motivo"
                  ariaLabel="Motivo"
                  className="w-full"
                />
              ) : (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm"
                  placeholder="Motivo"
                  aria-label="Motivo"
                />
              )}
            </div>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void apply()} disabled={!canApply} loading={saving}>
              Aplicar a {n}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={onClick}>
      {children}
    </button>
  );
}
