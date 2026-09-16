import { NextResponse } from "next/server";

import { requireWorkspace, notFound } from "@/lib/api-guard";
import { deleteTag } from "@/modules/tags/service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteTag(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
