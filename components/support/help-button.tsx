"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Modal } from "@/components/ui/modal";

// Pedido de ayuda a un técnico de Kodexa. Manda el texto y la ruta de la
// página donde estaba la persona (sin parámetros). Nada de datos de pago.
export function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    if (sent) {
      setSent(false);
      setSubject("");
      setMessage("");
    }
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim() || undefined, message, pagePath: pathname }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "No pudimos enviar el pedido. Probá de nuevo en unos minutos.");
        return;
      }
      setSent(true);
    } catch {
      setError("No pudimos enviar el pedido. Revisá tu conexión y probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pedir ayuda"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs font-semibold">
          ?
        </span>
        <span className="hidden sm:inline">Ayuda</span>
      </button>
      <Modal
        open={open}
        onClose={close}
        busy={busy}
        title={sent ? "Recibimos tu pedido" : "Pedir ayuda"}
        description={sent ? undefined : "Contanos qué pasó y un técnico de Kodexa lo revisa."}
      >
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Gracias. Un técnico de Kodexa lo va a revisar y se comunica con vos al email de tu cuenta.</p>
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-slate-900 hover:bg-brand-400"
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm text-slate-700">
              Asunto (opcional)
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm"
                placeholder="Ej.: No puedo guardar un lead"
              />
            </label>
            <label className="block text-sm text-slate-700">
              ¿Qué pasó?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
                maxLength={2000}
                rows={5}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:text-sm"
                placeholder="Qué intentabas hacer, qué esperabas y qué viste."
              />
            </label>
            <p className="text-xs text-slate-500">Enviamos también la página donde estabas ({pathname}). No incluyas contraseñas ni datos de tarjeta.</p>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy || message.trim().length < 10}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-slate-900 hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Enviando…" : "Enviar pedido"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
