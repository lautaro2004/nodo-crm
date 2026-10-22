"use client";

import { useRouter } from "next/navigation";

import { Button, Spinner } from "@/components/ui/primitives";
import { TrashIcon } from "@/components/ui/icons";
import { useDeleteRecords, type RecordNoun } from "@/components/records/use-delete-records";

// "Eliminar" en la ficha de un registro: misma vista previa, confirmación,
// permisos y endpoint que la eliminación masiva. Al terminar vuelve a la lista.
export function DeleteRecordButton({
  entityType,
  id,
  noun,
  redirectTo,
}: {
  entityType: string;
  id: string;
  noun: RecordNoun;
  redirectTo: string;
}) {
  const router = useRouter();
  const { deleteRecords, busy } = useDeleteRecords(entityType, noun);

  async function onClick() {
    const outcome = await deleteRecords([id]);
    if (outcome.done && outcome.failed.length === 0) {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void onClick()} disabled={busy}>
      {busy ? <Spinner className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
      {busy ? "Eliminando…" : "Eliminar"}
    </Button>
  );
}
