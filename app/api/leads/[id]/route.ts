import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { leadUpdateSchema } from "@/lib/schemas";
import { getLead, updateLead, deleteLead } from "@/modules/leads/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "lead", id, "view");
  if (denied) return denied;
  const lead = await getLead(ctx.businessId, id);
  if (!lead) return notFound();
  return NextResponse.json(lead);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "lead", id, "edit");
  if (denied) return denied;
  const { data, response: badRequest } = await parseBody(request, leadUpdateSchema);
  if (!data) return badRequest;

  try {
    const lead = await updateLead(ctx.businessId, id, data, ctx.userId);
    if (!lead) return notFound();
    return NextResponse.json(lead);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "lead", id, "delete");
  if (denied) return denied;
  const ok = await deleteLead(ctx.businessId, id, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
