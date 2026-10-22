"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";

export function EventActions({ eventId, status }: { eventId: string; status: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  // Qué acción está en curso: el spinner va en ese botón y el resto queda
  // deshabilitado (sin dobles envíos).
  const [busy, setBusy] = useState<string | null>(null);

  const STATUS_DONE: Record<string, string> = { completed: "Evento marcado como realizado", cancelled: "Evento cancelado", scheduled: "Evento reactivado" };

  async function setStatus(next: string) {
    setBusy(next);
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) return toast.error("No se pudo actualizar el evento", await readApiError(res));
      toast.success(STATUS_DONE[next] ?? "Evento actualizado");
      router.refresh();
    } catch {
      toast.error("Sin conexión", "El evento no se actualizó.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "¿Eliminar este evento?",
      description: "Se borra definitivamente. Si solo querés anularlo, usá Cancelar evento.",
      tone: "danger",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) {
        setBusy(null);
        return toast.error("No se pudo eliminar el evento", await readApiError(res));
      }
      toast.success("Evento eliminado");
      router.push("/dashboard/calendario");
      router.refresh();
    } catch {
      setBusy(null);
      toast.error("Sin conexión", "El evento no se eliminó.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "scheduled" ? (
        <>
          <Button variant="secondary" disabled={!!busy} loading={busy === "completed"} onClick={() => setStatus("completed")}>
            Marcar realizada
          </Button>
          <Button variant="secondary" disabled={!!busy} loading={busy === "cancelled"} onClick={() => setStatus("cancelled")}>
            Cancelar evento
          </Button>
        </>
      ) : (
        <Button variant="secondary" disabled={!!busy} loading={busy === "scheduled"} onClick={() => setStatus("scheduled")}>
          Reactivar
        </Button>
      )}
      <Button variant="danger" disabled={!!busy} loading={busy === "delete"} onClick={remove}>
        {busy === "delete" ? "Eliminando…" : "Eliminar"}
      </Button>
    </div>
  );
}
