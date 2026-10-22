"use client";

import { useCallback, useState } from "react";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

// Lógica común de "eliminar registros" (barra de selección múltiple y botón
// de la ficha): vista previa del impacto → confirmación → borrado → aviso.
// Nunca informa éxito si el servidor no confirmó el borrado.

export interface RecordNoun {
  one: string; // "lead"
  many: string; // "leads"
  /** Género gramatical, para "eliminado/a". */
  feminine?: boolean;
}

interface Impact {
  found: number;
  unlinked: { label: string; count: number }[];
  removed: { label: string; count: number }[];
}

interface DeleteResult {
  deleted: string[];
  notFound: string[];
  failed: string[];
}

export type DeleteOutcome = { done: false } | { done: true; deleted: string[]; failed: string[] };

const count = (n: number, noun: RecordNoun) => `${n} ${n === 1 ? noun.one : noun.many}`;

export function useDeleteRecords(entityType: string, noun: RecordNoun) {
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (ids: string[]): Promise<DeleteOutcome> => {
      if (!ids.length || busy) return { done: false };
      setBusy(true);
      try {
        // 1. Qué pasa con lo relacionado (sin borrar nada todavía).
        let impact: Impact | null = null;
        try {
          const res = await fetch("/api/records/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType, ids, preview: true }),
          });
          if (!res.ok) {
            toast.error("No se pudo eliminar", await readApiError(res));
            return { done: false };
          }
          impact = (await res.json()) as Impact;
        } catch {
          toast.error("Sin conexión", "No se eliminó nada.");
          return { done: false };
        }

        const lines = ["No se puede deshacer."];
        if (impact.unlinked.length) lines.push("", "Se desvinculan (siguen existiendo):", ...impact.unlinked.map((i) => `• ${i.label}`));
        if (impact.removed.length) lines.push("", "También se borra:", ...impact.removed.map((i) => `• ${i.label}`));
        const n = ids.length;
        const ok = await confirm({
          title: n === 1 ? `¿Eliminar ${noun.feminine ? "esta" : "este"} ${noun.one}?` : `¿Eliminar ${count(n, noun)}?`,
          description: lines.join("\n"),
          confirmLabel: n === 1 ? "Eliminar" : `Eliminar ${n}`,
          tone: "danger",
        });
        if (!ok) return { done: false };

        // 2. Borrado.
        let result: DeleteResult;
        try {
          const res = await fetch("/api/records/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityType, ids }),
          });
          if (res.status !== 200 && res.status !== 207) {
            toast.error("No se pudo eliminar", await readApiError(res));
            return { done: false };
          }
          result = (await res.json()) as DeleteResult;
        } catch {
          toast.error("Sin conexión", "No sabemos si se eliminaron. Recargá la página para ver el estado actual.");
          return { done: false };
        }

        const gone = result.deleted.length + result.notFound.length;
        if (result.failed.length === 0) {
          const suffix = noun.feminine ? (gone === 1 ? "eliminada" : "eliminadas") : gone === 1 ? "eliminado" : "eliminados";
          toast.success(gone === 1 ? `${noun.one[0].toUpperCase()}${noun.one.slice(1)} ${suffix}` : `${count(gone, noun)} ${suffix}`);
        } else if (gone > 0) {
          toast.error(
            `Se eliminaron ${gone} de ${n}`,
            `${count(result.failed.length, noun)} no se ${result.failed.length === 1 ? "pudo" : "pudieron"} eliminar. Quedan seleccionados para reintentar.`
          );
        } else {
          toast.error("No se pudo eliminar", "Ocurrió un error. No se eliminó nada.");
        }
        return { done: true, deleted: [...result.deleted, ...result.notFound], failed: result.failed };
      } finally {
        setBusy(false);
      }
    },
    [busy, confirm, entityType, noun, toast]
  );

  return { deleteRecords: run, busy };
}
