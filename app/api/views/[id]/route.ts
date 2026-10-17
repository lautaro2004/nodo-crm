import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse } from "@/lib/api-guard";
import { savedViewUpdateSchema } from "@/lib/schemas";
import { deleteView, updateView } from "@/modules/views/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, savedViewUpdateSchema);
  if (!data) return badRequest;
  try {
    const view = await updateView(ctx.businessId, id, ctx, data);
    if (!view) return notFound();
    return NextResponse.json(view);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  try {
    const ok = await deleteView(ctx.businessId, id, ctx);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
