import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import { normalizeRole, type Role } from "@/lib/permissions";

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

  const workspace = await prisma.workspace.findUnique({ where: { businessId: membership.businessId } });
  if (!workspace) return { status: "no_workspace", userId: session.user.id, businessId: membership.businessId, role: normalizeRole(membership.role) };

  return { status: "ok", userId: session.user.id, businessId: membership.businessId, role: normalizeRole(membership.role) };
}

// Para páginas de servidor que exigen un workspace ya creado — usar en
// app/dashboard/layout.tsx y no repetir la redirección en cada page.tsx.
export type OkWorkspaceContext = Extract<WorkspaceContext, { status: "ok" }>;
