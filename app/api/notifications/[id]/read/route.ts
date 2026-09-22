import { NextResponse } from "next/server";

import { requireWorkspace, notFound } from "@/lib/api-guard";
import { markRead } from "@/modules/notifications/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const ok = await markRead(ctx.businessId, ctx.userId, id);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
