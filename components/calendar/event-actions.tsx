"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/primitives";

export function EventActions({ eventId, status }: { eventId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: string) {
    setBusy(true);
    await fetch(`/api/calendar/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("¿Eliminar este evento definitivamente? Si solo querés anularlo, usá Cancelar evento.")) return;
    setBusy(true);
    await fetch(`/api/calendar/events/${eventId}`, { method: "DELETE" });
    router.push("/dashboard/calendario");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "scheduled" ? (
        <>
          <Button variant="secondary" disabled={busy} onClick={() => setStatus("completed")}>
            Marcar realizada
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setStatus("cancelled")}>
            Cancelar evento
          </Button>
        </>
      ) : (
        <Button variant="secondary" disabled={busy} onClick={() => setStatus("scheduled")}>
          Reactivar
        </Button>
      )}
      <Button variant="danger" disabled={busy} onClick={remove}>
        Eliminar
      </Button>
    </div>
  );
}
