import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse } from "@/lib/api-guard";
import { memberUpdateSchema } from "@/lib/schemas";
import { removeMember, updateMember } from "@/modules/team/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, memberUpdateSchema);
  if (!data) return badRequest;
  try {
    const member = await updateMember(ctx.businessId, ctx, id, data);
    if (!member) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  try {
    const ok = await removeMember(ctx.businessId, ctx, id);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
