import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, notFound } from "@/lib/api-guard";
import { opportunityItemUpdateSchema } from "@/lib/schemas";
import { removeItem, updateItem } from "@/modules/opportunity-items/service";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, itemId } = await params;
  const { data, response: badRequest } = await parseBody(request, opportunityItemUpdateSchema);
  if (!data) return badRequest;
  try {
    return (await updateItem(ctx.businessId, id, itemId, data)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, itemId } = await params;
  try {
    return (await removeItem(ctx.businessId, id, itemId)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}
