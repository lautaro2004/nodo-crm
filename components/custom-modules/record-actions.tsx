"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";
import { DeleteRecordButton } from "@/components/records/delete-record-button";
import type { RecordNoun } from "@/components/records/use-delete-records";

export function RecordActions({
  moduleId,
  recordId,
  basePath,
  archived,
  canDelete,
  disabled,
  noun = { one: "registro", many: "registros" },
}: {
  moduleId: string;
  recordId: string;
  basePath: string;
  archived: boolean;
  canDelete: boolean;
  disabled?: boolean;
  noun?: RecordNoun;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<"archive" | null>(null);
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-sm text-red-600">{error}</span>}
      {!disabled && (
        <Button variant="secondary" disabled={!!busy} loading={busy === "archive"} onClick={() => setArchived(!archived)}>
          {archived ? "Restaurar" : "Archivar"}
        </Button>
      )}
      {canDelete && <DeleteRecordButton entityType={`cm:${moduleId}`} id={recordId} noun={noun} redirectTo={basePath} />}
    </div>
  );
}
