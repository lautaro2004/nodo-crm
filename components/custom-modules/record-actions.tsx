"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/modules/${moduleId}/records/${recordId}`;

  async function setArchived(value: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: value }) });
    setBusy(false);
    if (!res.ok) return setError(await readApiError(res));
    router.refresh();
  }

  async function remove() {
    if (!confirm("¿Borrar este registro definitivamente? Se quitan también sus relaciones e imágenes. No se puede deshacer.")) return;
    setBusy(true);
    const res = await fetch(url, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError(await readApiError(res));
    router.push(basePath);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm text-red-600">{error}</span>}
      {!disabled && (
        <Button variant="secondary" disabled={busy} onClick={() => setArchived(!archived)}>
          {archived ? "Restaurar" : "Archivar"}
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" className="text-red-600 hover:text-red-700" disabled={busy} onClick={remove}>
          Borrar
        </Button>
      )}
    </div>
  );
}
