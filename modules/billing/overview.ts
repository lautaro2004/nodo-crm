import { prisma } from "@/lib/prisma";
import { loadCrmBillingState, type CrmBillingState } from "@/modules/billing/access";
import { crmSeatUsage } from "@/modules/billing/seats";

// Resumen de la suscripción para la pantalla del dueño/administrador. Solo
// lectura: lo escribe Nexo (checkout, webhooks, superadmin).
export interface SubscriptionOverview {
  state: CrmBillingState;
  status: string | null;
  provider: string | null;
  planId: string | null;
  /** Si el plan actual es un combo: el plan de Nodo y el de Nexo que lo componen. */
  crmPlanId: string | null;
  nexoPlanId: string | null;
  isCombo: boolean;
  planName: string | null;
  /** Precio de lista de un usuario extra para el período contratado. */
  extraUnitPrice: number | null;
  listCurrency: string | null;
  interval: string | null;
  periodEnd: Date | null;
  includedUsers: number | null;
  extraUsers: number;
  seatLimit: number | null;
  seatsUsed: number;
  seatsPending: number;
  /** Hay una suscripción paga activa en Mercado Pago: contratar de nuevo la duplicaría. */
  hasPaidSubscription: boolean;
}

export async function getSubscriptionOverview(businessId: string): Promise<SubscriptionOverview> {
  const [state, sub, seats] = await Promise.all([
    loadCrmBillingState(businessId),
    prisma.nexoSubscription.findUnique({ where: { businessId }, include: { plan: true } }),
    crmSeatUsage(businessId),
  ]);
  const hasPaidSubscription = !!sub && sub.provider === "mercadopago" && sub.status !== "canceled" && sub.status !== "expired";
  return {
    state,
    status: sub?.status ?? null,
    provider: sub?.provider ?? null,
    planId: sub?.plan.id ?? null,
    crmPlanId: sub ? (sub.plan.comboDiscountPct !== null ? sub.plan.packCrmPlanId : sub.plan.id) : null,
    nexoPlanId: sub && sub.plan.comboDiscountPct !== null ? sub.plan.packNexoPlanId : null,
    isCombo: !!sub && sub.plan.comboDiscountPct !== null,
    planName: sub?.plan.name ?? null,
    extraUnitPrice: sub ? (sub.billingInterval === "year" ? sub.plan.extraUserYearlyPrice : sub.plan.extraUserMonthlyPrice) : null,
    listCurrency: sub?.plan.currency ?? null,
    interval: sub?.billingInterval ?? null,
    periodEnd: sub?.currentPeriodEnd ?? null,
    includedUsers: sub?.plan.products.includes("crm") ? (sub.plan.crmMaxUsers ?? null) : null,
    extraUsers: sub?.extraUsers ?? 0,
    seatLimit: state.seatLimit,
    seatsUsed: seats.members,
    seatsPending: seats.pending,
    hasPaidSubscription,
  };
}

export const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "brand" }> = {
  active: { label: "Activa", variant: "success" },
  trialing: { label: "En prueba", variant: "brand" },
  past_due: { label: "Pago atrasado", variant: "warning" },
  canceled: { label: "Cancelada", variant: "danger" },
  expired: { label: "Vencida", variant: "danger" },
};
