import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

// ÚNICO punto de verdad de todo el backend del CRM: sesión -> Membership ->
// Business -> Workspace. Ninguna API route ni página server debe resolver
// esto de otra forma, y NUNCA se confía en un businessId/workspaceId
// enviado por el cliente — ver docs/architecture/crm-fase3-core.md,
// "Modelo multi-tenant".
export type WorkspaceContext =
  | { status: "unauthenticated" }
  | { status: "no_business"; userId: string }
  | { status: "no_workspace"; userId: string; businessId: string }
  | { status: "ok"; userId: string; businessId: string; role: string };

export async function resolveWorkspaceContext(): Promise<WorkspaceContext> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: "unauthenticated" };

  const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return { status: "no_business", userId: session.user.id };

  const workspace = await prisma.workspace.findUnique({ where: { businessId: membership.businessId } });
  if (!workspace) return { status: "no_workspace", userId: session.user.id, businessId: membership.businessId };

  return { status: "ok", userId: session.user.id, businessId: membership.businessId, role: membership.role };
}

// Para páginas de servidor que exigen un workspace ya creado — usar en
// app/dashboard/layout.tsx y no repetir la redirección en cada page.tsx.
export type OkWorkspaceContext = Extract<WorkspaceContext, { status: "ok" }>;
