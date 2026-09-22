import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { countUnread, listNotifications } from "@/modules/notifications/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const [notifications, unread] = await Promise.all([
    listNotifications(ctx.businessId, ctx.userId),
    countUnread(ctx.businessId, ctx.userId),
  ]);
  return NextResponse.json({ notifications, unread });
}
