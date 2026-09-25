"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/primitives";

const ERROR_MESSAGES: Record<string, string> = {
  task_without_due_date: "Poné una fecha de vencimiento en la tarea para agregarla al calendario.",
  google_not_connected: "Conectá Google Calendar en Configuración → Integraciones.",
  google_needs_reconnect: "Google revocó el acceso. Reconectá Google Calendar en Configuración → Integraciones.",
  google_sync_failed: "No pudimos actualizar Google Calendar. Probá de nuevo.",
  google_event_forbidden: "El evento está en el Google Calendar de otra persona.",
};

// Acción explícita por tarea: crea/actualiza/quita UN evento en el Google
// Calendar del usuario. Nada se sincroniza solo.
export function TaskGoogleCalendarAction({
  taskId,
  calendarConnected,
  hasDueDate,
  linked,
}: {
  taskId: string;
  calendarConnected: boolean;
  hasDueDate: boolean;
  linked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(method: "POST" | "DELETE") {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/tasks/${taskId}/google-calendar`, { method });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setMessage(ERROR_MESSAGES[body?.error ?? ""] ?? "No pudimos completar la acción. Probá de nuevo.");
      return;
    }
    router.refresh();
  }

  if (!calendarConnected) {
    return (
      <Link href="/dashboard/configuracion/integraciones" className="text-sm text-slate-500 hover:underline">
        Conectar Google Calendar →
      </Link>
    );
  }

  return (
    <div className="space-y-1.5">
      {linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-emerald-700">En tu Google Calendar</span>
          <Button variant="secondary" size="sm" disabled={loading || !hasDueDate} onClick={() => run("POST")}>
            Actualizar evento
          </Button>
          <Button variant="ghost" size="sm" disabled={loading} onClick={() => run("DELETE")}>
            Quitar
          </Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" disabled={loading || !hasDueDate} onClick={() => run("POST")}>
          {loading ? "Agregando…" : "Agregar a Google Calendar"}
        </Button>
      )}
      {!hasDueDate && <p className="text-xs text-slate-400">Requiere fecha de vencimiento.</p>}
      {message && <p className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
