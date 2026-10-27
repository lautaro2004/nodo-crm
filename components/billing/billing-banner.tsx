import { billingEnforcement, BLOCK_REASON_MESSAGES, type CrmBillingState } from "@/modules/billing/access";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long" });

// Avisos de facturación dentro del dashboard: pago atrasado en período de
// gracia (acceso normal) y, solo para owner/admin y con el cobro en modo
// "report", qué pasaría si se activara el bloqueo.
export function BillingBanner({ state, canManage }: { state: CrmBillingState; canManage: boolean }) {
  if (state.access.access === "grace") {
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        <strong>Tenés un pago pendiente.</strong> Podés seguir usando Nodo con normalidad hasta el{" "}
        <strong>{dateFormatter.format(state.access.graceEndsAt)}</strong>. Después de esa fecha el acceso se bloquea (tus datos no se borran) hasta que
        regularices el pago{canManage ? "." : "; avisale al dueño del negocio."}
      </div>
    );
  }
  if (billingEnforcement() === "report" && canManage && state.access.access === "blocked") {
    return (
      <div className="border-b border-sky-300 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
        <strong>Modo de prueba del cobro.</strong> {BLOCK_REASON_MESSAGES[state.access.reason] ?? "Tu negocio no tiene un plan con Nodo."} Cuando
        el cobro se active vas a necesitar un plan para seguir usando Nodo.
      </div>
    );
  }
  return null;
}
