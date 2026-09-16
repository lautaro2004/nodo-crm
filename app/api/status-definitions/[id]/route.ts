import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { statusDefinitionUpdateSchema } from "@/lib/schemas";
import { updateStatusDefinition, deleteStatusDefinition } from "@/modules/status-definitions/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, statusDefinitionUpdateSchema);
  if (!data) return badRequest;

  const ok = await updateStatusDefinition(ctx.businessId, id, data);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteStatusDefinition(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
