import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { markAllRead } from "@/modules/notifications/service";

export async function POST() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  await markAllRead(ctx.businessId, ctx.userId);
  return NextResponse.json({ ok: true });
}
