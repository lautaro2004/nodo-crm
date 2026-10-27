"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { CrmPlanOption, NexoPlanOption } from "@/modules/billing/plans";

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

interface Quote {
  combo?: { discountPct: number; subtotalArs: number; discountArs: number };
  arsAmount: number;
  converted: boolean;
}

interface Props {
  plans: CrmPlanOption[];
  nexoPlans: NexoPlanOption[];
  comboPct: number;
  /** Plan de Nodo actual (si hoy tenés un combo, el de Nodo que lo compone). */
  currentPlanId: string;
  /** Plan de Nexo del combo actual, o null si hoy es solo Nodo. */
  currentNexoPlanId: string | null;
  currentExtra: number;
  interval: "month" | "year";
  seatsInUse: number;
}

// Cambio de plan de una suscripción activa (solo el dueño), en el mismo
// período de facturación. El precio y las validaciones las hace Nexo.
export function PlanChangeForm({ plans, nexoPlans, comboPct, currentPlanId, currentNexoPlanId, currentExtra, interval, seatsInUse }: Props) {
  const router = useRouter();
  const candidates = plans.filter((p) => (interval === "year" ? p.yearlyPrice !== null : p.monthlyPrice !== null));
  const [planId, setPlanId] = React.useState(currentPlanId);
  // Combo: plan de Nexo a sumar ("" = solo Nodo).
  const [withNexo, setWithNexo] = React.useState(currentNexoPlanId ?? "");
  const plan = candidates.find((p) => p.id === planId);
  const extraUnit = plan ? (interval === "year" ? plan.extraUserYearlyPrice : plan.extraUserMonthlyPrice) : null;
  const [extra, setExtra] = React.useState(currentExtra);
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  const effectiveExtra = extraUnit ? extra : 0;
  const unchanged = planId === currentPlanId && withNexo === (currentNexoPlanId ?? "") && effectiveExtra === currentExtra;
  // Perdés Nexo si hoy lo tenés (combo o pack) y el plan elegido no lo incluye.
  const hasNexoNow = !!currentNexoPlanId || (plans.find((p) => p.id === currentPlanId)?.includesNexo ?? false);
  const losesNexo = hasNexoNow && !withNexo && !(plan?.includesNexo ?? false);

  React.useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    setQuote(null);
    setQuoteError(null);
    fetch("/api/billing/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, interval, extraUsers: effectiveExtra, ...(withNexo ? { withNexoPlanId: withNexo } : {}) }),
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
  }, [plan, interval, effectiveExtra, withNexo]);

  if (!candidates.length || !plan) return null;
  const totalUsers = plan.users + effectiveExtra;

  async function confirm() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, extraUsers: effectiveExtra, ...(withNexo ? { withNexoPlanId: withNexo } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; planName?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.message ?? "No pudimos cambiar el plan. No se hizo ningún cambio." });
        return;
      }
      setMessage({ ok: true, text: `Listo: tu plan ahora es ${data.planName ?? plan?.name}.` });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "No pudimos cambiar el plan. Probá de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Plan
          <select className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.users} usuario{p.users === 1 ? "" : "s"}
                {p.id === currentPlanId ? " (actual)" : ""}
              </option>
            ))}
          </select>
        </label>
        {nexoPlans.length > 0 && (
          <label className="text-xs text-slate-600">
            Nexo{comboPct > 0 ? ` (combo −${comboPct}%)` : ""}
            <select className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm" value={withNexo} onChange={(e) => setWithNexo(e.target.value)}>
              <option value="">Sin Nexo</option>
              {nexoPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {extraUnit ? (
          <label className="text-xs text-slate-600">
            Usuarios extra
            <input
              type="number"
              min={0}
              max={500}
              value={extra}
              onChange={(e) => setExtra(Math.max(0, Math.min(500, Math.trunc(Number(e.target.value) || 0))))}
              className="mt-1 block w-28 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={unchanged || saving || !quote || totalUsers < seatsInUse}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? "Guardando…" : "Confirmar cambio de plan"}
        </button>
      </div>

      {quote && (
        <p className="text-sm text-slate-700">
          {plan.name} con {totalUsers} usuarios: <strong>{ars.format(quote.arsAmount)}</strong> {interval === "year" ? "por año" : "por mes"}
          {quote.converted ? " (al dólar oficial de hoy)" : ""}.
        </p>
      )}
      {quote?.combo && (
        <p className="text-sm text-emerald-700">
          Combo Nexo + Nodo: {quote.combo.discountPct}% de descuento sobre {ars.format(quote.combo.subtotalArs)}, ahorrás {ars.format(quote.combo.discountArs)}.
        </p>
      )}
      {quoteError && <p className="text-sm text-red-700">{quoteError}</p>}
      {totalUsers < seatsInUse && (
        <p className="text-sm text-amber-700">Hoy usás {seatsInUse} usuarios: ese plan no alcanza. Sumá usuarios extra o quitá personas primero.</p>
      )}
      {losesNexo && <p className="text-sm text-amber-700">Ojo: ese plan no incluye Nexo, así que perderías el acceso a Nexo.</p>}
      <p className="text-xs text-slate-500">El plan nuevo rige al instante; el nuevo monto se cobra desde el próximo débito, sin prorrateo. El período (mensual/anual) no cambia.</p>
      {message && <p className={message.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message.text}</p>}
    </div>
  );
}
