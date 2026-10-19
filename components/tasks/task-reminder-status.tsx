"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { BellIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

// Sólo lectura + eliminar acá (mismo criterio que el resto del detalle de
// Task: "editar" siempre manda a la pantalla de edición, no hay edición
// inline de cada campo). El <select> de offset/personalizado vive en
// TaskReminderField, dentro de TaskForm.
export function TaskReminderStatus({ taskId, remindAt }: { taskId: string; remindAt: Date | null }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!remindAt) return <p className="text-sm text-slate-400">Sin recordatorio.</p>;

  async function remove() {
    if (busy || !(await confirm({ title: "¿Eliminar este recordatorio?", tone: "danger", confirmLabel: "Eliminar" }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reminder`, { method: "DELETE" });
      if (!res.ok) return toast.error("No se pudo eliminar el recordatorio", await readApiError(res));
      toast.success("Recordatorio eliminado");
      router.refresh();
    } catch {
      toast.error("Sin conexión", "El recordatorio no se eliminó.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-900">
      <BellIcon className="h-4 w-4 shrink-0 text-brand-500" />
      <span>
        {remindAt.toLocaleDateString("es-AR")} {remindAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1 text-xs text-slate-400 underline hover:text-red-600 disabled:opacity-60">
        {busy && <Spinner className="h-3 w-3" />}
        {busy ? "Eliminando…" : "Eliminar"}
      </button>
    </div>
  );
}
