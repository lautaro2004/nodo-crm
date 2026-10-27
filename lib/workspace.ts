import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { normalizeRole, type Role } from "@/lib/permissions";
import { isCrmBlocked, loadCrmBillingState } from "@/modules/billing/access";

// ÚNICO punto de verdad de todo el backend del CRM: sesión -> Membership ->
// Business -> Workspace. Ninguna API route ni página server debe resolver
// esto de otra forma, y NUNCA se confía en un businessId/workspaceId
// enviado por el cliente — ver docs/architecture/crm-fase3-core.md,
// "Modelo multi-tenant".
export type WorkspaceContext =
  | { status: "unauthenticated" }
  | { status: "no_business"; userId: string }
  | { status: "no_workspace"; userId: string; businessId: string; role: Role }
  // Es miembro de un negocio pero el dueño no le habilitó Nodo
  // (Membership.products sin "crm"). Nunca se lo manda al onboarding: eso
  // crearía/alteraría el Workspace del negocio ajeno.
  | { status: "no_access"; userId: string; businessId: string; businessName: string }
  // Tiene acceso a Nodo pero la suscripción del negocio no lo permite hoy
  // (sin plan con Nodo, prueba vencida, pago atrasado más de 7 días,
  // cancelada y vencida) y NODO_BILLING_ENFORCEMENT=on. Los datos siguen
  // intactos; se muestra la pantalla de planes/regularización.
  | { status: "billing_blocked"; userId: string; businessId: string; businessName: string; role: Role; reason: string }
  | { status: "ok"; userId: string; businessId: string; role: Role };

export async function resolveWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "unauthenticated" };

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { business: { select: { name: true } } },
    // Un usuario pertenece a un solo negocio (las invitaciones lo
    // garantizan); el orden solo hace determinístico el caso legacy.
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return { status: "no_business", userId: session.user.id };
  if (!membership.products.includes("crm")) {
    return { status: "no_access", userId: session.user.id, businessId: membership.businessId, businessName: membership.business.name };
  }

  // Acceso por suscripción: ÚNICO punto que lo aplica a páginas y API.
  const billing = await loadCrmBillingState(membership.businessId);
  if (isCrmBlocked(billing) && billing.access.access === "blocked") {
    return {
      status: "billing_blocked",
      userId: session.user.id,
      businessId: membership.businessId,
      businessName: membership.business.name,
      role: normalizeRole(membership.role),
      reason: billing.access.reason,
    };
  }

  const workspace = await prisma.workspace.findUnique({ where: { businessId: membership.businessId } });
  if (!workspace) return { status: "no_workspace", userId: session.user.id, businessId: membership.businessId, role: normalizeRole(membership.role) };

  return { status: "ok", userId: session.user.id, businessId: membership.businessId, role: normalizeRole(membership.role) };
}

// Para páginas de servidor que exigen un workspace ya creado — usar en
// app/dashboard/layout.tsx y no repetir la redirección en cada page.tsx.
export type OkWorkspaceContext = Extract<WorkspaceContext, { status: "ok" }>;
