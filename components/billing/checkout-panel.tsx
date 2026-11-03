"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

import type { CrmPlanOption, NexoPlanOption } from "@/modules/billing/plans";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

let mpInitialized = false;
function ensureMp() {
  if (mpInitialized || !PUBLIC_KEY) return;
  initMercadoPago(PUBLIC_KEY, { locale: "es-AR" });
  mpInitialized = true;
}

interface Quote {
  combo?: { discountPct: number; subtotalArs: number; discountArs: number };
  arsAmount: number;
  converted: boolean;
  listAmount: number;
  listCurrency: string;
  rate?: number;
}
interface CheckoutError {
  error?: string;
  message?: string;
  detail?: string;
}

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const listMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

// Contratación de Nodo (solo el dueño). El cobro lo hace Nexo: acá se arma el
// token de tarjeta con Mercado Pago y se manda a /api/billing/checkout.
export function CheckoutPanel({ plans, nexoPlans = [], comboPct = 0 }: { plans: CrmPlanOption[]; nexoPlans?: NexoPlanOption[]; comboPct?: number }) {
  const router = useRouter();
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const [interval, setInterval] = React.useState<"month" | "year">(plan?.monthlyPrice !== null ? "month" : "year");
  const [extraUsers, setExtraUsers] = React.useState(0);
  // Combo: plan de Nexo a sumar ("" = solo Nodo).
  const [withNexo, setWithNexo] = React.useState("");
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<CheckoutError | null>(null);
  const [done, setDone] = React.useState(false);

  const extraUnit = plan ? (interval === "year" ? plan.extraUserYearlyPrice : plan.extraUserMonthlyPrice) : null;
  const canMonth = plan?.monthlyPrice !== null && plan?.monthlyPrice !== undefined;
  const canYear = plan?.yearlyPrice !== null && plan?.yearlyPrice !== undefined;

  // Si el plan elegido no ofrece el período/extra actual, se corrige.
  React.useEffect(() => {
    if (!plan) return;
    if (interval === "month" && !canMonth && canYear) setInterval("year");
    if (interval === "year" && !canYear && canMonth) setInterval("month");
    if (!extraUnit && extraUsers !== 0) setExtraUsers(0);
  }, [plan, interval, canMonth, canYear, extraUnit, extraUsers]);

  React.useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    setQuote(null);
    setQuoteError(null);
    fetch("/api/billing/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, interval, extraUsers, ...(withNexo ? { withNexoPlanId: withNexo } : {}) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setQuoteError((data as { error?: string; message?: string }).message ?? (data as { error?: string }).error ?? "No pudimos calcular el monto.");
        else setQuote(data as Quote);
      })
      .catch(() => !cancelled && setQuoteError("No pudimos calcular el monto."));
    return () => {
      cancelled = true;
    };
  }, [plan, interval, extraUsers, withNexo]);

  // El Brick se monta con el monto en pesos ya resuelto; su initialization
  // no debe cambiar mientras el formulario está visible (ver el checkout de Nexo).
  const initialization = React.useMemo(() => ({ amount: quote?.arsAmount ?? 0 }), [quote?.arsAmount]);
  const customization = React.useMemo(() => ({ visual: { hideFormTitle: true } }), []);

  const handleSubmit = React.useCallback(
    async (formData: { token: string }) => {
      if (!plan) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: plan.id, cardTokenId: formData.token, interval, extraUsers, ...(withNexo ? { withNexoPlanId: withNexo } : {}) }),
        });
        const data = (await res.json().catch(() => ({}))) as CheckoutError;
        if (!res.ok) {
          setError(data);
          return;
        }
        setDone(true);
        setTimeout(() => router.refresh(), 1500);
      } catch {
        setError({ message: "No pudimos completar la contratación. Probá de nuevo." });
      } finally {
        setSubmitting(false);
      }
    },
    [plan, interval, extraUsers, withNexo, router]
  );

  if (!plan) return null;
  if (done) {
    return <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">¡Listo! Tu suscripción quedó activa. Te llevamos a Nodo…</p>;
  }
  if (!PUBLIC_KEY) {
    return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">La contratación online todavía no está configurada. Escribinos y activamos tu plan.</p>;
  }
  ensureMp();

  // Ahorro del plan anual frente a pagar 12 meses (solo si hay ambos precios y conviene).
  const yearlySaving =
    plan && plan.monthlyPrice !== null && plan.yearlyPrice !== null && plan.monthlyPrice * 12 > plan.yearlyPrice
      ? plan.monthlyPrice * 12 - plan.yearlyPrice
      : 0;

  return (
    <div className="mt-6 space-y-5 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Elegí tu plan</h2>
          <p className="text-sm text-slate-500">Tocá el plan que quieras contratar.</p>
        </div>
        {canMonth && canYear && (
          <div className="inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Período de facturación">
            {(["month", "year"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={interval === value}
                onClick={() => setInterval(value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  interval === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {value === "month" ? "Mensual" : "Anual"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Planes de Nodo">
        {plans.map((p) => {
          const selected = p.id === plan.id;
          const price = interval === "year" ? (p.yearlyPrice ?? p.monthlyPrice) : (p.monthlyPrice ?? p.yearlyPrice);
          const shownInterval = interval === "year" ? (p.yearlyPrice !== null ? "año" : "mes") : p.monthlyPrice !== null ? "mes" : "año";
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlanId(p.id)}
              className={`relative flex flex-col rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                selected ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-300" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <span
                aria-hidden
                className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                  selected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="pr-7 text-base font-semibold text-slate-900">{p.name}</span>
              <span className="mt-0.5 text-sm text-slate-500">
                {p.users} usuario{p.users === 1 ? "" : "s"} incluido{p.users === 1 ? "" : "s"}
              </span>
              {price !== null && (
                <span className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {listMoney(price, p.currency)}
                  <span className="text-sm font-normal text-slate-500"> / {shownInterval}</span>
                </span>
              )}
              <span className="mt-2 flex flex-wrap gap-1.5">
                {p.includesNexo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">Incluye Nexo</span>}
                {p.trialDays ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{p.trialDays} días de prueba</span> : null}
                {(interval === "year" ? p.extraUserYearlyPrice : p.extraUserMonthlyPrice) !== null && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    Usuario extra {listMoney((interval === "year" ? p.extraUserYearlyPrice : p.extraUserMonthlyPrice) as number, p.currency)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {interval === "year" && yearlySaving > 0 && (
        <p className="text-sm text-emerald-700">Con el plan anual ahorrás {listMoney(yearlySaving, plan.currency)} respecto de pagar 12 meses.</p>
      )}
      {plan.currency !== "ARS" && (
        <p className="text-xs text-slate-500">Los precios en dólares se cobran en pesos al dólar oficial (BNA venta) del día de la contratación.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {extraUnit ? (
          <div className="text-sm text-slate-600 sm:text-xs">
            <span id="extra-users-label">Usuarios extra (+{listMoney(extraUnit, plan.currency)} c/u)</span>
            <div className="mt-1 flex items-center gap-2" role="group" aria-labelledby="extra-users-label">
              <button
                type="button"
                aria-label="Quitar un usuario extra"
                className="h-11 w-11 rounded-lg border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:h-9 sm:w-9"
                disabled={extraUsers <= 0}
                onClick={() => setExtraUsers((n) => Math.max(0, n - 1))}
              >
                −
              </button>
              <span className="w-10 text-center text-base font-medium text-slate-900" aria-live="polite">
                {extraUsers}
              </span>
              <button
                type="button"
                aria-label="Sumar un usuario extra"
                className="h-11 w-11 rounded-lg border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:h-9 sm:w-9"
                disabled={extraUsers >= 500}
                onClick={() => setExtraUsers((n) => Math.min(500, n + 1))}
              >
                +
              </button>
            </div>
          </div>
        ) : null}

        {nexoPlans.length > 0 && (
          <label className="block text-sm text-slate-600 sm:text-xs">
            Sumar Nexo{comboPct > 0 ? ` (${comboPct}% de descuento sobre la suma de ambos planes)` : ""}
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base sm:px-2 sm:py-2 sm:text-sm"
              value={withNexo}
              onChange={(e) => setWithNexo(e.target.value)}
            >
              <option value="">No, solo Nodo</option>
              {nexoPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {quote && (
        <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm">
          <p className="font-medium text-slate-900">
            Se cobrará {ars.format(quote.arsAmount)} {interval === "year" ? "por año" : "por mes"}
          </p>
          {quote.combo ? (
            <p className="mt-0.5 text-emerald-700">
              Combo Nexo + Nodo: {quote.combo.discountPct}% de descuento sobre {ars.format(quote.combo.subtotalArs)}, ahorrás {ars.format(quote.combo.discountArs)}.
            </p>
          ) : null}
          {quote.converted && quote.rate ? (
            <p className="mt-0.5 text-slate-600">
              {listMoney(quote.listAmount, quote.listCurrency)} al dólar oficial (BNA venta) de hoy: {ars.format(quote.rate)}. El monto en pesos se reajusta en cada
              renovación según la cotización.
            </p>
          ) : null}
          <p className="mt-0.5 text-slate-600">
            Total de usuarios: {plan.users + extraUsers}
            {plan.trialDays ? ` · ${plan.trialDays} días de prueba sin cargo` : ""}
          </p>
        </div>
      )}
      {quoteError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{quoteError}</p>}
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">{error.message ?? "No pudimos completar la contratación."}</p>
          {error.detail && <p>{error.detail}</p>}
        </div>
      )}

      {quote && (
        <div className="relative">
          <CardPayment
            key={quote.arsAmount}
            initialization={initialization}
            customization={customization}
            onSubmit={handleSubmit}
            onError={(e: unknown) => console.error("[billing] Card Payment Brick error:", e)}
          />
          {submitting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80 text-sm text-slate-600">Procesando el pago…</div>
          )}
        </div>
      )}
    </div>
  );
}
