"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const listMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

interface Props {
  planId: string;
  interval: "month" | "year";
  currentExtra: number;
  includedUsers: number;
  seatsInUse: number;
  extraUnitPrice: number;
  currency: string;
}

interface Quote {
  arsAmount: number;
  converted: boolean;
  listAmount: number;
  listCurrency: string;
}

// Cambio de usuarios extra de una suscripción activa (solo el dueño). El
// precio sale de Nexo (cotización); acá solo se pide y se confirma.
export function ExtraUsersForm({ planId, interval, currentExtra, includedUsers, seatsInUse, extraUnitPrice, currency }: Props) {
  const router = useRouter();
  const [extra, setExtra] = React.useState(currentExtra);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const minExtra = Math.max(0, seatsInUse - includedUsers);
  const changed = extra !== currentExtra;

  React.useEffect(() => {
    let cancelled = false;
    setQuote(null);
    setQuoteError(null);
    fetch("/api/billing/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, interval, extraUsers: extra }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Quote & { error?: string; message?: string };
        if (cancelled) return;
        if (!res.ok) setQuoteError(data.message ?? data.error ?? "No pudimos calcular el monto.");
        else setQuote(data);
      })
      .catch(() => !cancelled && setQuoteError("No pudimos calcular el monto."));
    return () => {
      cancelled = true;
    };
  }, [planId, interval, extra]);

  async function confirm() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/extra-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraUsers: extra }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string; seatLimit?: number };
      if (!res.ok) {
        setMessage({ ok: false, text: data.message ?? "No pudimos cambiar los usuarios. No se hizo ningún cambio." });
        return;
      }
      setMessage({ ok: true, text: `Listo: ahora podés tener hasta ${data.seatLimit ?? includedUsers + extra} usuarios.` });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "No pudimos cambiar los usuarios. Probá de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Usuarios extra (+{listMoney(extraUnitPrice, currency)} c/u {interval === "year" ? "por año" : "por mes"})
          <input
            type="number"
            min={minExtra}
            max={500}
            value={extra}
            onChange={(e) => setExtra(Math.max(minExtra, Math.min(500, Math.trunc(Number(e.target.value) || 0))))}
            className="mt-1 block w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={!changed || saving || !quote}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Confirmar cambio"}
        </button>
      </div>

      {quote && (
        <p className="text-sm text-slate-700">
          Con {includedUsers + extra} usuarios pagarías <strong>{ars.format(quote.arsAmount)}</strong> {interval === "year" ? "por año" : "por mes"}
          {quote.converted ? ` (${listMoney(quote.listAmount, quote.listCurrency)} al dólar oficial de hoy)` : ""}.
        </p>
      )}
      {quoteError && <p className="text-sm text-red-700">{quoteError}</p>}
      <p className="text-xs text-slate-500">
        El nuevo límite rige al instante; el nuevo monto se cobra desde el próximo débito (sin prorrateo). No se puede bajar por debajo de los usuarios que
        ya usás ({seatsInUse}).
      </p>
      {message && <p className={message.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
    </div>
  );
}
