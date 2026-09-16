import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { opportunityUpdateSchema } from "@/lib/schemas";
import { getOpportunity, updateOpportunity, deleteOpportunity } from "@/modules/opportunities/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const opportunity = await getOpportunity(ctx.businessId, id);
  if (!opportunity) return notFound();
  return NextResponse.json(opportunity);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, opportunityUpdateSchema);
  if (!data) return badRequest;

  try {
    const opportunity = await updateOpportunity(ctx.businessId, id, data);
    if (!opportunity) return notFound();
    return NextResponse.json(opportunity);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid_input" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteOpportunity(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
