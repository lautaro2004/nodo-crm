import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { resolveWorkspaceContext, type OkWorkspaceContext } from "@/lib/workspace";

const STATUS_BY_ERROR = {
  unauthenticated: 401,
  no_business: 409,
  no_workspace: 409,
} as const;

// Envoltorio delgado para Route Handlers: resuelve el Workspace UNA vez,
// nunca deja que la route reciba un businessId del cliente. Toda mutación
// que necesite el negocio actual pasa por acá.
export async function requireWorkspace(): Promise<
  { ctx: OkWorkspaceContext; response: null } | { ctx: null; response: NextResponse }
> {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") {
    return {
      ctx: null,
      response: NextResponse.json({ error: ctx.status }, { status: STATUS_BY_ERROR[ctx.status] }),
    };
  }
  return { ctx, response: null };
}

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ data: T; response: null } | { data: null; response: NextResponse }> {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      data: null,
      response: NextResponse.json(
        { error: "invalid_input", details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { data: parsed.data, response: null };
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: "not_found" }, { status: 404 });
}
