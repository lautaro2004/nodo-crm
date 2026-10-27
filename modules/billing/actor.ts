import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/lib/workspace";

// Quién puede contratar: el DUEÑO del negocio, incluso con Nodo bloqueado
// (justamente cuando más lo necesita). El userId sale siempre de la sesión.
export type BillingActor =
  | { ok: true; userId: string; email: string; businessId: string }
  | { ok: false; status: number; error: string };

export async function resolveBillingActor(): Promise<BillingActor> {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status === "unauthenticated") return { ok: false, status: 401, error: "unauthenticated" };
  if (ctx.status !== "ok" && ctx.status !== "billing_blocked") return { ok: false, status: 409, error: ctx.status };
  if (ctx.role !== "owner") return { ok: false, status: 403, error: "forbidden" };
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { ok: false, status: 401, error: "unauthenticated" };
  return { ok: true, userId: ctx.userId, email: session.user.email, businessId: ctx.businessId };
}
