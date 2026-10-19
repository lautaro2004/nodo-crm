"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

export function RecordActions({
  moduleId,
  recordId,
  basePath,
  archived,
  canDelete,
  disabled,
}: {
  moduleId: string;
  recordId: string;
  basePath: string;
  archived: boolean;
  canDelete: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/modules/${moduleId}/records/${recordId}`;

  async function setArchived(value: boolean) {
    setBusy("archive");
    setError(null);
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: value }) });
      if (!res.ok) return setError(await readApiError(res));
      toast.success(value ? "Registro archivado" : "Registro restaurado");
      router.refresh();
    } catch {
      setError("Sin conexión. El cambio no se guardó.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "¿Borrar este registro definitivamente?",
      description: "Se quitan también sus relaciones e imágenes. No se puede deshacer.",
      tone: "danger",
    });
    if (!ok) return;
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        setBusy(null);
        return setError(await readApiError(res));
      }
      toast.success("Registro borrado");
      router.push(basePath);
      router.refresh();
    } catch {
      setBusy(null);
      setError("Sin conexión. El registro no se borró.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm text-red-600">{error}</span>}
      {!disabled && (
        <Button variant="secondary" disabled={!!busy} loading={busy === "archive"} onClick={() => setArchived(!archived)}>
          {archived ? "Restaurar" : "Archivar"}
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" className="text-red-600 hover:text-red-700" disabled={!!busy} loading={busy === "delete"} onClick={remove}>
          {busy === "delete" ? "Borrando…" : "Borrar"}
        </Button>
      )}
    </div>
  );
}
