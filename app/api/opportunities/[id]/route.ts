import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { opportunityUpdateSchema } from "@/lib/schemas";
import { getOpportunity, updateOpportunity, deleteOpportunity } from "@/modules/opportunities/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "opportunity", id, "view");
  if (denied) return denied;
  const record = await getOpportunity(ctx.businessId, id);
  if (!record) return notFound();
  return NextResponse.json(record);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "opportunity", id, "edit");
  if (denied) return denied;
  const { data, response: badRequest } = await parseBody(request, opportunityUpdateSchema);
  if (!data) return badRequest;

  try {
    const record = await updateOpportunity(ctx.businessId, id, data, ctx.userId);
    if (!record) return notFound();
    return NextResponse.json(record);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "opportunity", id, "delete");
  if (denied) return denied;
  const ok = await deleteOpportunity(ctx.businessId, id, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
