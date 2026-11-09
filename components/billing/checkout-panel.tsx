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

// ── Contrato con el backend (sin cambios) ─────────────────────────────────
// POST /api/billing/quote    { planId, interval, extraUsers, withNexoPlanId? }
// POST /api/billing/checkout { planId, cardTokenId, interval, extraUsers, withNexoPlanId? }
// Los importes salen SIEMPRE de la cotización del backend; acá no se
// recalcula ningún precio comercial.
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
type Interval = "month" | "year";
type Step = 1 | 2 | 3;

const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const listMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};
const longDate = (date: Date) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(date);
const clock = (date: Date) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(date);

// Apariencia del Brick: solo variables de estilo que el SDK instalado permite.
// Los campos de tarjeta siguen siendo de Mercado Pago (no se reemplazan).
// Constante a nivel módulo: el Brick se remonta si su configuración cambia
// de identidad entre renders.
const BRICK_CUSTOMIZATION = {
  visual: {
    hideFormTitle: true,
    style: {
      theme: "flat",
      customVariables: {
        baseColor: "#fb6e1a",
        buttonTextColor: "#202124",
        textPrimaryColor: "#202124",
        textSecondaryColor: "#5f6368",
        formBackgroundColor: "#ffffff",
        inputBackgroundColor: "#ffffff",
        outlinePrimaryColor: "#fb6e1a",
        borderRadiusSmall: "8px",
        borderRadiusMedium: "10px",
        borderRadiusLarge: "14px",
        fontSizeMedium: "16px",
        formPadding: "0px",
      },
    },
  },
  // Es una suscripción: no tiene sentido ofrecer cuotas.
  paymentMethods: { maxInstallments: 1 },
};

// Traduce la respuesta del backend a un mensaje para la persona. Nunca se
// muestran códigos técnicos (technicalCode) ni textos internos.
type ErrorKind = "already" | "rejected" | "communication" | "activation" | "generic";
function describeError(status: number | null, data: CheckoutError | null): { kind: ErrorKind; title: string; body: string } {
  const code = data?.error;
  if (code === "ALREADY_SUBSCRIBED") {
    return {
      kind: "already",
      title: "Ya tenés una suscripción",
      body: "Tu negocio ya tiene una suscripción paga en curso, así que no hace falta contratar de nuevo. Actualizá la página para ver su estado.",
    };
  }
  if (code === "MERCADOPAGO_CHECKOUT_ERROR") {
    return {
      kind: "rejected",
      title: "Mercado Pago no aprobó la tarjeta",
      body: data?.detail ?? "Revisá los datos o probá con otra tarjeta.",
    };
  }
  if (code === "NEXO_ACTIVATION_ERROR") {
    return {
      kind: "activation",
      title: "Tu pago fue autorizado, pero falta activar el plan",
      body: "No lo repitas: escribinos y lo regularizamos enseguida.",
    };
  }
  if (status === null || status >= 500 || code === "NEXO_UNREACHABLE" || code === "NOT_CONFIGURED") {
    return {
      kind: "communication",
      title: "No pudimos confirmar la contratación",
      body: "Hubo un problema de comunicación. Antes de reintentar, actualizá la página: si la suscripción ya figura activa, no hace falta pagar de nuevo.",
    };
  }
  return {
    kind: "generic",
    title: "No pudimos completar la contratación",
    body: data?.message ?? "Probá de nuevo en unos minutos.",
  };
}

const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Plan" },
  { id: 2, label: "Contratación" },
  { id: 3, label: "Pago" },
];

// Contratación de Nodo (solo el dueño). El cobro lo hace Nexo: acá se arma el
// token de tarjeta con Mercado Pago y se manda a /api/billing/checkout.
export function CheckoutPanel({ plans, nexoPlans = [], comboPct = 0 }: { plans: CrmPlanOption[]; nexoPlans?: NexoPlanOption[]; comboPct?: number }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const [interval, setInterval] = React.useState<Interval>(plan?.monthlyPrice !== null ? "month" : "year");
  const [extraUsers, setExtraUsers] = React.useState(0);
  // Combo: plan de Nexo a sumar ("" = solo Nodo).
  const [withNexo, setWithNexo] = React.useState("");
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [quoteAt, setQuoteAt] = React.useState<Date | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoteNonce, setQuoteNonce] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<{ status: number | null; data: CheckoutError | null } | null>(null);
  const [done, setDone] = React.useState(false);

  const extraUnit = plan ? (interval === "year" ? plan.extraUserYearlyPrice : plan.extraUserMonthlyPrice) : null;
  const canMonth = plan?.monthlyPrice !== null && plan?.monthlyPrice !== undefined;
  const canYear = plan?.yearlyPrice !== null && plan?.yearlyPrice !== undefined;
  const needsQuote = step >= 2;

  // Si el plan elegido no ofrece el período/extra actual, se corrige.
  React.useEffect(() => {
    if (!plan) return;
    if (interval === "month" && !canMonth && canYear) setInterval("year");
    if (interval === "year" && !canYear && canMonth) setInterval("month");
    if (!extraUnit && extraUsers !== 0) setExtraUsers(0);
  }, [plan, interval, canMonth, canYear, extraUnit, extraUsers]);

  // Cotización: viene del backend (precio, descuento y dólar oficial).
  React.useEffect(() => {
    if (!plan || !needsQuote) return;
    let cancelled = false;
    setQuote(null);
    setQuoteAt(null);
    setQuoteError(null);
    fetch("/api/billing/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, interval, extraUsers, ...(withNexo ? { withNexoPlanId: withNexo } : {}) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setQuoteError((data as { message?: string }).message ?? "No pudimos calcular el monto.");
        else {
          setQuote(data as Quote);
          setQuoteAt(new Date());
        }
      })
      .catch(() => !cancelled && setQuoteError("No pudimos calcular el monto."));
    return () => {
      cancelled = true;
    };
  }, [plan, interval, extraUsers, withNexo, needsQuote, quoteNonce]);

  // El Brick se monta con el monto en pesos ya resuelto; su initialization
  // no debe cambiar mientras el formulario está visible.
  const initialization = React.useMemo(() => ({ amount: quote?.arsAmount ?? 0 }), [quote?.arsAmount]);
  const handleBrickError = React.useCallback((e: unknown) => console.error("[billing] Card Payment Brick error:", e), []);

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
          setError({ status: res.status, data });
          // Re-lanzar: el Brick usa el rechazo para volver a habilitar el formulario.
          throw new Error("checkout_failed");
        }
        // Solo se llega acá si el backend confirmó la contratación.
        setDone(true);
        setTimeout(() => router.refresh(), 2500);
      } catch (e) {
        if (!(e instanceof Error && e.message === "checkout_failed")) {
          setError({ status: null, data: null });
        }
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [plan, interval, extraUsers, withNexo, router]
  );

  if (!plan) return null;
  if (!PUBLIC_KEY) {
    return <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">La contratación online todavía no está configurada. Escribinos y activamos tu plan.</p>;
  }
  ensureMp();

  const nexoPlan = nexoPlans.find((p) => p.id === withNexo) ?? null;
  const trialDays = plan.trialDays && plan.trialDays > 0 ? plan.trialDays : 0;
  const firstCharge = trialDays ? new Date(Date.now() + trialDays * 86_400_000) : null;
  const intervalLabel = interval === "year" ? "Anual" : "Mensual";
  const perLabel = interval === "year" ? "año" : "mes";

  // Ahorro del plan anual frente a pagar 12 meses (informativo, a precio de lista).
  const yearlySaving =
    plan.monthlyPrice !== null && plan.yearlyPrice !== null && plan.monthlyPrice * 12 > plan.yearlyPrice ? plan.monthlyPrice * 12 - plan.yearlyPrice : 0;

  // ── Éxito (confirmado por el backend) ───────────────────────────────────
  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center" role="status">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-lg text-white" aria-hidden>
          ✓
        </div>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">{trialDays ? "Prueba gratuita activada" : "Pago autorizado"}</h2>
        <p className="mt-1 text-sm text-slate-700">
          Mercado Pago confirmó tu suscripción a {plan.name}.
          {firstCharge ? ` El primer cobro de ${quote ? ars.format(quote.arsAmount) : "tu plan"} será el ${longDate(firstCharge)}.` : ""}
        </p>
        <p className="mt-1 text-sm text-slate-600">Te llevamos a Nodo…</p>
      </div>
    );
  }

  const failure = error ? describeError(error.status, error.data) : null;

  // ── Resumen de contratación ─────────────────────────────────────────────
  const summary = (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--shadow-card)]" aria-label="Resumen de contratación">
      <h3 className="text-sm font-semibold text-slate-900">Resumen</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <Row label="Plan" value={plan.name} />
        <Row label="Usuarios incluidos" value={String(plan.users)} />
        {extraUsers > 0 && <Row label="Usuarios adicionales" value={`${extraUsers}${extraUnit ? ` × ${listMoney(extraUnit, plan.currency)}` : ""}`} />}
        {nexoPlan && <Row label="Nexo" value={nexoPlan.name} />}
        <Row label="Facturación" value={intervalLabel} />
      </dl>
      <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
        {quote ? (
          <dl className="space-y-2">
            {quote.combo && (
              <>
                <Row label="Subtotal" value={ars.format(quote.combo.subtotalArs)} />
                <Row label={`Descuento combo (${quote.combo.discountPct}%)`} value={`− ${ars.format(quote.combo.discountArs)}`} tone="good" />
              </>
            )}
            {quote.converted && quote.listCurrency !== "ARS" && <Row label="Referencia en dólares" value={listMoney(quote.listAmount, quote.listCurrency)} />}
            {quote.converted && quote.rate ? <Row label="Dólar oficial BNA (venta)" value={ars.format(quote.rate)} /> : null}
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <dt className="font-medium text-slate-900">Total en pesos</dt>
              <dd className="text-right text-xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {ars.format(quote.arsAmount)}
                <span className="text-sm font-normal text-slate-500"> / {perLabel}</span>
              </dd>
            </div>
          </dl>
        ) : quoteError ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700">{quoteError}</p>
            <button type="button" onClick={() => setQuoteNonce((n) => n + 1)} className="text-sm font-medium text-brand-700 underline underline-offset-2">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando cotización">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-6 w-full animate-pulse rounded bg-slate-100" />
            <p className="text-xs text-slate-500">Calculando el importe con el dólar de hoy…</p>
          </div>
        )}
      </div>

      {quote && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          {firstCharge ? (
            <p>
              <strong className="text-slate-900">{trialDays} días de prueba sin cargo.</strong> Primer cobro el {longDate(firstCharge)}: {ars.format(quote.arsAmount)}.
            </p>
          ) : (
            <p>
              <strong className="text-slate-900">Primer cobro hoy:</strong> {ars.format(quote.arsAmount)}.
            </p>
          )}
          <p>
            Se renueva solo cada {interval === "year" ? "año" : "mes"}.
            {quote.converted ? " El monto en pesos se reajusta en cada renovación según la cotización." : ""} Cancelás cuando quieras.
          </p>
          {quoteAt && (
            <p className="flex items-center gap-1.5 text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Cotización actualizada a las {clock(quoteAt)}
            </p>
          )}
        </div>
      )}
    </aside>
  );

  return (
    <div className="mt-6 space-y-6">
      <style>{`@keyframes nodo-step-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.nodo-step{animation:nodo-step-in .22s ease-out}@media (prefers-reduced-motion:reduce){.nodo-step{animation:none}}`}</style>

      {/* Indicador de etapas */}
      <ol className="flex items-center gap-2 text-xs" aria-label="Etapas de la contratación">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const reachable = s.id < step && !submitting;
          return (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(s.id)}
                aria-current={active ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full py-1 pr-2 transition-colors ${reachable ? "cursor-pointer hover:text-slate-900" : "cursor-default"} ${
                  active ? "text-slate-900" : s.id < step ? "text-slate-700" : "text-slate-400"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                    active ? "border-brand-500 bg-brand-500 text-slate-900" : s.id < step ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {s.id < step ? "✓" : s.id}
                </span>
                <span className="font-medium">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
            </li>
          );
        })}
      </ol>

      {/* ETAPA 1 — Elegir plan */}
      {step === 1 && (
        <section key="step-1" className="nodo-step space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">Elegí cómo crecer con Nodo.</h2>
              <p className="mt-1 text-sm text-slate-500">Un plan que acompaña el tamaño de tu equipo.</p>
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

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2" role="radiogroup" aria-label="Planes de Nodo">
            {plans.map((p) => {
              const selected = p.id === plan.id;
              const price = interval === "year" ? (p.yearlyPrice ?? p.monthlyPrice) : (p.monthlyPrice ?? p.yearlyPrice);
              const shownInterval = interval === "year" ? (p.yearlyPrice !== null ? "año" : "mes") : p.monthlyPrice !== null ? "mes" : "año";
              const pExtra = interval === "year" ? p.extraUserYearlyPrice : p.extraUserMonthlyPrice;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlanId(p.id)}
                  className={`relative flex min-h-[132px] flex-col rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                    selected
                      ? "border-brand-500 bg-white shadow-[var(--shadow-card)] ring-2 ring-brand-200"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[var(--shadow-card)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-colors ${
                      selected ? "border-brand-500 bg-brand-500 text-slate-900" : "border-slate-300 bg-white text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="pr-7 text-sm font-semibold text-slate-900">{p.name}</span>
                  <span className="mt-0.5 text-xs text-slate-500">
                    {p.users} usuario{p.users === 1 ? "" : "s"} incluido{p.users === 1 ? "" : "s"}
                  </span>
                  {price !== null && (
                    <span className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {listMoney(price, p.currency)}
                      <span className="text-sm font-normal text-slate-500"> / {shownInterval}</span>
                    </span>
                  )}
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {p.trialDays ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{p.trialDays} días de prueba</span>
                    ) : null}
                    {p.includesNexo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">Incluye Nexo</span>}
                    {pExtra !== null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Usuario extra {listMoney(pExtra, p.currency)}</span>}
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

          <button
            type="button"
            onClick={() => setStep(2)}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 sm:w-auto"
          >
            Continuar con {plan.name}
          </button>
        </section>
      )}

      {/* ETAPA 2 — Configurar contratación */}
      {step === 2 && (
        <section key="step-2" className="nodo-step space-y-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Armá tu contratación.</h2>
            <p className="mt-1 text-sm text-slate-500">Sumá usuarios o Nexo y revisá el resumen antes de pagar.</p>
          </div>

          <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <div className="space-y-5">
              {extraUnit ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p id="extra-users-label" className="text-sm font-semibold text-slate-900">
                        Usuarios adicionales
                      </p>
                      <p className="text-xs text-slate-500">
                        {listMoney(extraUnit, plan.currency)} por usuario, por {perLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-labelledby="extra-users-label">
                      <button
                        type="button"
                        aria-label="Quitar un usuario extra"
                        className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-lg text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        disabled={extraUsers <= 0}
                        onClick={() => setExtraUsers((n) => Math.max(0, n - 1))}
                      >
                        −
                      </button>
                      <span className="w-10 text-center text-base font-semibold text-slate-900 tabular-nums" aria-live="polite">
                        {extraUsers}
                      </span>
                      <button
                        type="button"
                        aria-label="Sumar un usuario extra"
                        className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-lg text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        disabled={extraUsers >= 500}
                        onClick={() => setExtraUsers((n) => Math.min(500, n + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Total de usuarios: {plan.users + extraUsers}</p>
                </div>
              ) : null}

              {nexoPlans.length > 0 && (
                <fieldset className="rounded-2xl border border-slate-200 bg-white p-4">
                  <legend className="sr-only">Sumar Nexo</legend>
                  <p className="text-sm font-semibold text-slate-900">Sumar Nexo</p>
                  <p className="text-xs text-slate-500">
                    {comboPct > 0 ? `Contratá los dos juntos y obtené ${comboPct}% de descuento sobre la suma de ambos planes.` : "Contratá Nodo junto con Nexo."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Plan de Nexo">
                    {[{ id: "", name: "Solo Nodo" }, ...nexoPlans.map((p) => ({ id: p.id, name: p.name }))].map((opt) => {
                      const selected = withNexo === opt.id;
                      return (
                        <button
                          key={opt.id || "none"}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setWithNexo(opt.id)}
                          className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                            selected ? "border-brand-500 bg-brand-50 text-slate-900 ring-1 ring-brand-300" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {opt.id ? `+ ${opt.name}` : opt.name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>

            {summary}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cambiar plan
            </button>
            <button
              type="button"
              disabled={!quote}
              onClick={() => {
                setError(null);
                setStep(3);
              }}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-brand-500 px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {quote ? `Continuar al pago · ${ars.format(quote.arsAmount)}` : "Calculando importe…"}
            </button>
          </div>
        </section>
      )}

      {/* ETAPA 3 — Pago seguro */}
      {step === 3 && quote && (
        <section key="step-3" className="nodo-step space-y-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Completá tu contratación.</h2>
            <p className="mt-1 text-sm text-slate-500">Tu pago se procesa de forma segura mediante Mercado Pago.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-700">
              <strong className="text-slate-900">{plan.name}</strong>
              {extraUsers > 0 ? ` + ${extraUsers} usuario${extraUsers === 1 ? "" : "s"}` : ""}
              {nexoPlan ? ` + ${nexoPlan.name}` : ""} · {intervalLabel.toLowerCase()}
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {ars.format(quote.arsAmount)} / {perLabel}
            </span>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(2)}
              className="text-xs font-medium text-brand-700 underline underline-offset-2 disabled:opacity-50"
            >
              Editar
            </button>
          </div>

          {firstCharge ? (
            <p className="text-sm text-slate-600">
              Hoy no se cobra nada: tenés {trialDays} días de prueba. El primer cobro será el {longDate(firstCharge)}.
            </p>
          ) : (
            <p className="text-sm text-slate-600">Se cobra hoy {ars.format(quote.arsAmount)} y después se renueva automáticamente.</p>
          )}

          {failure && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              <p className="font-semibold">{failure.title}</p>
              <p className="mt-0.5">{failure.body}</p>
              {(failure.kind === "already" || failure.kind === "communication") && (
                <button type="button" onClick={() => router.refresh()} className="mt-2 font-medium underline underline-offset-2">
                  Actualizar estado
                </button>
              )}
            </div>
          )}

          <div className="relative rounded-2xl border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)] sm:p-5">
            <CardPayment
              key={quote.arsAmount}
              initialization={initialization}
              customization={BRICK_CUSTOMIZATION}
              onSubmit={handleSubmit}
              onError={handleBrickError}
            />
            {submitting && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/85 text-sm text-slate-700" role="status">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" aria-hidden />
                Procesando el pago…
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <span aria-hidden className="mt-0.5 text-base">🔒</span>
            <p>
              Los datos de tu tarjeta los recibe y procesa Mercado Pago directamente: Nodo nunca los ve ni los guarda. Podés cancelar la suscripción cuando quieras.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium tabular-nums ${tone === "good" ? "text-emerald-700" : "text-slate-900"}`}>{value}</dd>
    </div>
  );
}
