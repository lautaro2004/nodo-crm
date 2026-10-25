import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { setMemberAccess } from "@/modules/access/service";

const schema = z.object({
  // null = volver al rol por defecto según su rol de equipo.
  roleKey: z.string().trim().min(1).max(60).nullable().optional(),
  // Excepciones sobre el rol (se normalizan en el servidor).
  overrides: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { userId } = await params;
  const { data, response: badRequest } = await parseBody(request, schema);
  if (!data) return badRequest;
  try {
    await setMemberAccess(ctx.businessId, ctx, userId, { roleKey: data.roleKey, overrides: data.overrides as never });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
