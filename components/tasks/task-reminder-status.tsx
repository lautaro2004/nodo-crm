"use client";

import { useRouter } from "next/navigation";

import { BellIcon } from "@/components/ui/icons";

// Sólo lectura + eliminar acá (mismo criterio que el resto del detalle de
// Task: "editar" siempre manda a la pantalla de edición, no hay edición
// inline de cada campo). El <select> de offset/personalizado vive en
// TaskReminderField, dentro de TaskForm.
export function TaskReminderStatus({ taskId, remindAt }: { taskId: string; remindAt: Date | null }) {
  const router = useRouter();

  if (!remindAt) return <p className="text-sm text-slate-400">Sin recordatorio.</p>;

  async function remove() {
    if (!window.confirm("¿Eliminar este recordatorio?")) return;
    await fetch(`/api/tasks/${taskId}/reminder`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-900">
      <BellIcon className="h-4 w-4 shrink-0 text-indigo-500" />
      <span>
        {remindAt.toLocaleDateString("es-AR")} {remindAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <button type="button" onClick={remove} className="text-xs text-slate-400 underline hover:text-red-600">
        Eliminar
      </button>
    </div>
  );
}
