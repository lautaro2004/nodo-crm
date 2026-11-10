import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { callNexoBilling } from "@/lib/nexo-billing";
import { resolveWorkspaceContext } from "@/lib/workspace";

const bodySchema = z.object({
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Contanos un poco más (mínimo 10 caracteres).").max(2000, "El mensaje es demasiado largo."),
  pagePath: z.string().max(300).optional(),
});

// Pedido de ayuda (cualquier persona con acceso al espacio, también con Nodo
// pausado). userId sale de la sesión; Nexo guarda el pedido y lo muestra en
// Superadmin.
export async function POST(request: Request) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status === "unauthenticated") return NextResponse.json({ error: "unauthenticated", message: "Iniciá sesión de nuevo." }, { status: 401 });
  if (ctx.status !== "ok" && ctx.status !== "billing_blocked" && ctx.status !== "no_access") {
    return NextResponse.json({ error: ctx.status, message: "No pudimos identificar tu negocio." }, { status: 409 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "unauthenticated", message: "Iniciá sesión de nuevo." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300);
  const { status, data } = await callNexoBilling("support", { userId: session.user.id, ...parsed.data, ...(userAgent ? { userAgent } : {}) });
  return NextResponse.json(data, { status });
}
