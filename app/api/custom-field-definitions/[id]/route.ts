import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { customFieldDefinitionUpdateSchema } from "@/lib/schemas";
import { updateCustomFieldDefinition, deleteCustomFieldDefinition } from "@/modules/custom-fields/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, customFieldDefinitionUpdateSchema);
  if (!data) return badRequest;

  const ok = await updateCustomFieldDefinition(ctx.businessId, id, data);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteCustomFieldDefinition(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
