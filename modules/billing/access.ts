import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { resolveProductAccess, type ProductAccess } from "@/lib/billing-access";

// ── Acceso a Nodo según la suscripción (facturada desde Nexo) ─────────────
// Nodo NO cobra ni crea suscripciones: solo LEE nexo.Subscription/Plan (los
// escribe Nexo: checkout, webhooks, conciliación y superadmin) y aplica la
// misma regla pura que Nexo (lib/billing-access.ts, copia con los mismos
// tests). El acceso efectivo se calcula en cada request; bloquear nunca
// borra ni modifica datos del CRM.
//
// NODO_BILLING_ENFORCEMENT (decisión explícita de activación comercial):
//   off    (default) → nadie se bloquea; solo se calcula el estado.
//   report → igual que off, pero se avisa a owner/admin qué pasaría.
//   on     → el bloqueo rige (páginas y API).
// Antes de pasar a "on" hay que dar plan o bonificación con Nodo a los
// negocios existentes (ver docs/facturacion-nodo.md): si no, quedarían
// bloqueados.

export type BillingEnforcement = "off" | "report" | "on";

export function billingEnforcement(): BillingEnforcement {
  const value = process.env.NODO_BILLING_ENFORCEMENT?.trim().toLowerCase();
  return value === "on" || value === "report" ? value : "off";
}

export interface CrmBillingState {
  mode: BillingEnforcement;
  access: ProductAccess;
  planName: string | null;
  subscriptionStatus: string | null;
  billingInterval: string | null;
  // Usuarios de Nodo: incluidos + extra. null = sin límite definido.
  seatLimit: number | null;
}

export async function computeCrmBillingState(businessId: string, now: Date = new Date()): Promise<CrmBillingState> {
  const sub = await prisma.nexoSubscription.findUnique({ where: { businessId }, include: { plan: true } });
  const access = resolveProductAccess(
    sub
      ? {
          status: sub.status,
          provider: sub.provider,
          currentPeriodEnd: sub.currentPeriodEnd,
          pastDueSince: sub.pastDueSince,
          mercadoPagoLastSyncedAt: sub.mercadoPagoLastSyncedAt,
          plan: { products: sub.plan.products },
        }
      : null,
    "crm",
    now
  );
  return {
    mode: billingEnforcement(),
    access,
    planName: sub?.plan.name ?? null,
    subscriptionStatus: sub?.status ?? null,
    billingInterval: sub?.billingInterval ?? null,
    seatLimit: sub?.plan.products.includes("crm") && sub.plan.crmMaxUsers ? sub.plan.crmMaxUsers + (sub.extraUsers ?? 0) : null,
  };
}

// Una consulta por request (layout + página comparten el resultado).
export const loadCrmBillingState = cache((businessId: string) => computeCrmBillingState(businessId));

/** ¿Hay que impedir el uso funcional de Nodo? Solo con enforcement "on". */
export function isCrmBlocked(state: CrmBillingState): boolean {
  return state.mode === "on" && state.access.access === "blocked";
}

export const BLOCK_REASON_MESSAGES: Record<string, string> = {
  no_subscription: "Tu negocio todavía no tiene un plan con Nodo.",
  not_in_plan: "El plan actual de tu negocio no incluye Nodo.",
  trial_expired: "Terminó tu período de prueba de Nodo.",
  past_due_expired: "Tu pago está atrasado y venció el período de gracia de 7 días.",
  canceled: "Tu suscripción fue cancelada y terminó el período pago.",
  expired: "Tu suscripción venció.",
};
