import { BLOCK_REASON_MESSAGES } from "@/modules/billing/access";
import type { CrmPlanOption } from "@/modules/billing/plans";

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
    <main className="app-backdrop flex min-h-dvh items-start justify-center px-3 py-6 sm:items-center sm:px-4 sm:py-10">
      <div className="glass w-full max-w-3xl rounded-[var(--radius-glass)] p-5 sm:p-8">
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
            {checkout}
          </>
        )}
      </div>
    </main>
  );
}
