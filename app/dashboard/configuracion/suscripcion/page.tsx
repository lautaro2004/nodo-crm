import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { comboDiscountPercent, listCrmPlans, listNexoPlansForCombo } from "@/modules/billing/plans";
import { getSubscriptionOverview, STATUS_LABEL } from "@/modules/billing/overview";
import { BLOCK_REASON_MESSAGES } from "@/modules/billing/access";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { CheckoutPanel } from "@/components/billing/checkout-panel";
import { ExtraUsersForm } from "@/components/billing/extra-users-form";
import { PlanChangeForm } from "@/components/billing/plan-change-form";

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}

// Suscripción de Nodo. Visible para dueño y administradores; solo el dueño
// puede contratar. El cobro, los precios y el estado los maneja Nexo: esta
// pantalla únicamente los muestra y le pide a Nexo el checkout.
export default async function SubscriptionPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  if (!hasRole(ctx.role, "admin")) {
    return (
      <div>
        <PageHeader title="Suscripción" backHref="/dashboard/configuracion" backLabel="Configuración" />
        <p className="text-sm text-slate-600">La suscripción la gestiona el dueño o un administrador del negocio.</p>
      </div>
    );
  }

  const [overview, plans, nexoPlans] = await Promise.all([getSubscriptionOverview(ctx.businessId), listCrmPlans(), listNexoPlansForCombo()]);
  const { state } = overview;
  const isOwner = ctx.role === "owner";
  const status = overview.status ? STATUS_LABEL[overview.status] : null;

  const periodLabel =
    overview.status === "trialing"
      ? "La prueba termina el"
      : overview.status === "canceled"
        ? "Acceso hasta el"
        : overview.status === "past_due"
          ? "Último período hasta el"
          : "Próxima renovación";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Suscripción" description="Tu plan de Nodo, los usuarios en uso y cómo contratar." backHref="/dashboard/configuracion" backLabel="Configuración" />

      <div className="space-y-6">
        {state.access.access === "grace" && (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Tenés un pago atrasado.</strong> Podés seguir usando Nodo hasta el {dateFmt.format(state.access.graceEndsAt)}. Después se bloquea el
            acceso (tus datos no se borran) hasta que regularices el pago.
          </p>
        )}
        {state.access.access === "blocked" && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {BLOCK_REASON_MESSAGES[state.access.reason] ?? "Tu negocio no tiene un plan con Nodo."}
            {state.mode !== "on" ? " Por ahora no se bloquea el uso, pero conviene regularizarlo." : ""}
          </p>
        )}

        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Tu plan</h2>
          <dl>
            <Row label="Plan">{overview.planName ?? "Sin plan"}</Row>
            <Row label="Estado">{status ? <Badge variant={status.variant}>{status.label}</Badge> : <Badge>Sin suscripción</Badge>}</Row>
            {overview.interval && <Row label="Facturación">{overview.interval === "year" ? "Anual" : "Mensual"}</Row>}
            {overview.periodEnd && <Row label={periodLabel}>{dateFmt.format(overview.periodEnd)}</Row>}
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Usuarios de Nodo</h2>
          <dl>
            <Row label="En uso">
              {overview.seatsUsed}
              {overview.seatsPending > 0 ? ` + ${overview.seatsPending} invitación${overview.seatsPending === 1 ? "" : "es"} pendiente${overview.seatsPending === 1 ? "" : "s"}` : ""}
            </Row>
            <Row label="Incluidos en el plan">{overview.includedUsers ?? "—"}</Row>
            <Row label="Usuarios extra contratados">{overview.extraUsers}</Row>
            <Row label="Límite total">{overview.seatLimit ?? "Sin límite definido"}</Row>
          </dl>
          {overview.seatLimit !== null && overview.seatsUsed + overview.seatsPending >= overview.seatLimit && (
            <p className="mt-2 text-xs text-amber-700">Llegaste al límite: para sumar personas necesitás más usuarios.</p>
          )}
        </Card>

        {plans.length > 0 && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Planes disponibles</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {plans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                  <span className="font-medium text-slate-900">
                    {p.name}
                    <span className="ml-2 font-normal text-slate-500">
                      {p.users} usuario{p.users === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="text-slate-600">
                    {p.monthlyPrice !== null ? `${money(p.monthlyPrice, p.currency)}/mes` : ""}
                    {p.monthlyPrice !== null && p.yearlyPrice !== null ? " · " : ""}
                    {p.yearlyPrice !== null ? `${money(p.yearlyPrice, p.currency)}/año` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Los precios de lista en dólares se cobran en pesos al dólar oficial (BNA venta) y se reajustan en cada renovación.</p>
          </Card>
        )}

        {isOwner && !overview.hasPaidSubscription && plans.length > 0 && (
          <Card className="p-4">
            <CheckoutPanel plans={plans} nexoPlans={nexoPlans} comboPct={comboDiscountPercent()} />
          </Card>
        )}
        {isOwner && overview.hasPaidSubscription && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Usuarios extra</h2>
            {overview.planId && overview.extraUnitPrice && overview.listCurrency && overview.includedUsers ? (
              <ExtraUsersForm
                planId={overview.planId}
                interval={overview.interval === "year" ? "year" : "month"}
                currentExtra={overview.extraUsers}
                includedUsers={overview.includedUsers}
                seatsInUse={overview.seatsUsed + overview.seatsPending}
                extraUnitPrice={overview.extraUnitPrice}
                currency={overview.listCurrency}
              />
            ) : (
              <p className="text-sm text-slate-600">Tu plan no admite usuarios extra. Para sumar personas, escribinos y vemos otro plan.</p>
            )}
            {overview.crmPlanId && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-900">Cambiar de plan{nexoPlans.length > 0 ? " o sumar Nexo" : ""}</h2>
                <PlanChangeForm
                  plans={plans}
                  nexoPlans={nexoPlans}
                  comboPct={comboDiscountPercent()}
                  currentPlanId={overview.crmPlanId}
                  currentNexoPlanId={overview.nexoPlanId}
                  currentExtra={overview.extraUsers}
                  interval={overview.interval === "year" ? "year" : "month"}
                  seatsInUse={overview.seatsUsed + overview.seatsPending}
                />
              </div>
            )}
          </Card>
        )}
        {!isOwner && (
          <p className="text-xs text-slate-500">Solo el dueño del negocio puede contratar o cambiar el plan.</p>
        )}
      </div>
    </div>
  );
}
