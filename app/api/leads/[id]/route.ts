import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { leadUpdateSchema } from "@/lib/schemas";
import { getLead, updateLead, deleteLead } from "@/modules/leads/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const lead = await getLead(ctx.businessId, id);
  if (!lead) return notFound();
  return NextResponse.json(lead);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, leadUpdateSchema);
  if (!data) return badRequest;

  try {
    const lead = await updateLead(ctx.businessId, id, data);
    if (!lead) return notFound();
    return NextResponse.json(lead);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid_input" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteLead(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
