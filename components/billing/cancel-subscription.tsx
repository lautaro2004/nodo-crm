"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// Baja de la suscripción (solo el dueño). La confirmación es parte de la
// pantalla; el estado final lo confirma el backend, no esta interfaz.
export function CancelSubscription() {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? "No pudimos cancelar la suscripción. Probá de nuevo en unos minutos.");
        return;
      }
      router.refresh();
    } catch {
      setError("No pudimos comunicarnos con el servicio de cobro. Actualizá la página para ver el estado antes de reintentar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Cancelar suscripción</h2>
      {!confirming ? (
        <>
          <p className="mt-1 text-sm text-slate-600">Se corta el débito automático en Mercado Pago.</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            Cancelar suscripción
          </button>
        </>
      ) : (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alertdialog" aria-label="Confirmar cancelación">
          <p className="font-medium">¿Seguro que querés cancelar?</p>
          <p className="mt-1">
            Se corta el cobro y Nodo queda pausado para tu negocio. No se borra nada: tus datos se conservan y vuelven si contratás de nuevo. La cancelación no devuelve
            lo ya pagado.
          </p>
          {error && <p className="mt-2 font-medium">{error}</p>}
          <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Mantener suscripción
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Cancelando…" : "Sí, cancelar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
