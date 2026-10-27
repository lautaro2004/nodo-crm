import { prisma } from "@/lib/prisma";
import { loadCrmBillingState } from "@/modules/billing/access";

// Límite de usuarios de Nodo (incluidos en el plan + extras contratados).
// Cuentan: miembros con acceso a Nodo + invitaciones pendientes a Nodo (una
// invitación reserva su lugar). Una persona con acceso a Nexo y Nodo cuenta
// UNA vez (es una sola Membership). No elimina ni desactiva a nadie: solo
// impide NUEVAS altas cuando no queda lugar. Solo rige con
// NODO_BILLING_ENFORCEMENT=on (ver modules/billing/access.ts).

export async function crmSeatUsage(businessId: string, ignoreInvitationId?: string) {
  const [members, pending] = await Promise.all([
    prisma.membership.count({ where: { businessId, products: { has: "crm" } } }),
    prisma.invitation.count({
      where: {
        businessId,
        products: { has: "crm" },
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(ignoreInvitationId ? { id: { not: ignoreInvitationId } } : {}),
      },
    }),
  ]);
  return { members, pending, used: members + pending };
}

/** Lanza "seat_limit_reached" si sumar UN usuario de Nodo pasaría el límite. */
export async function assertCrmSeatAvailable(businessId: string, ignoreInvitationId?: string): Promise<void> {
  const state = await loadCrmBillingState(businessId);
  if (state.mode !== "on" || state.seatLimit === null) return;
  const { used } = await crmSeatUsage(businessId, ignoreInvitationId);
  if (used + 1 > state.seatLimit) throw new Error("seat_limit_reached");
}
