import { BLOCK_REASON_MESSAGES } from "@/modules/billing/access";
import type { CrmPlanOption } from "@/modules/billing/plans";

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

// Pantalla que reemplaza al dashboard cuando la suscripción no permite usar
// Nodo. No borra nada: los datos, módulos, campos, automatizaciones e
// informes siguen intactos y vuelven al regularizar el pago.
export function BlockedScreen({
  businessName,
  reason,
  isOwner,
  plans,
  checkout,
}: {
  businessName: string;
  reason: string;
  isOwner: boolean;
  plans: CrmPlanOption[];
  // Contratación (solo el dueño). Se inyecta para mantener esta pantalla sin estado.
  checkout?: React.ReactNode;
}) {
  return (
    <main className="app-backdrop flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-3xl rounded-[var(--radius-glass)] p-6 sm:p-8">
        <h1 className="text-lg font-semibold text-slate-900">Nodo está pausado para {businessName}</h1>
        <p className="mt-2 text-sm text-slate-600">{BLOCK_REASON_MESSAGES[reason] ?? "La suscripción no permite usar Nodo en este momento."}</p>
        <p className="mt-1 text-sm text-slate-600">
          <strong>No se borró nada:</strong> tus registros, módulos, campos, automatizaciones e informes están guardados y vuelven apenas se regularice.
        </p>

        {!isOwner ? (
          <p className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            Pedile al dueño del negocio que regularice la suscripción para volver a usar Nodo.
          </p>
        ) : plans.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">Todavía no hay planes de Nodo disponibles. Escribinos y lo resolvemos.</p>
        ) : (
          <>
            <h2 className="mt-6 text-sm font-semibold text-slate-900">Planes disponibles</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-200 bg-white/70 p-4">
                  <p className="font-medium text-slate-900">{plan.name}</p>
                  <p className="text-xs text-slate-500">
                    {plan.users} usuario{plan.users === 1 ? "" : "s"} incluido{plan.users === 1 ? "" : "s"}
                    {plan.includesNexo ? " · incluye Nexo" : ""}
                  </p>
                  {plan.monthlyPrice !== null && <p className="mt-2 text-sm text-slate-800">{money(plan.monthlyPrice, plan.currency)} / mes</p>}
                  {plan.yearlyPrice !== null && <p className="text-sm text-slate-800">{money(plan.yearlyPrice, plan.currency)} / año</p>}
                  {plan.extraUserMonthlyPrice !== null && (
                    <p className="text-xs text-slate-500">Usuario extra: {money(plan.extraUserMonthlyPrice, plan.currency)} / mes</p>
                  )}
                  {plan.currency !== "ARS" && (
                    <p className="mt-1 text-[11px] text-slate-500">Se cobra en pesos al dólar oficial (BNA venta) del día de la contratación.</p>
                  )}
                </div>
              ))}
            </div>
            {checkout}
          </>
        )}
      </div>
    </main>
  );
}
