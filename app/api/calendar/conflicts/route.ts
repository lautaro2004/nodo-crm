import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { calendarErrorResponse } from "@/modules/calendar/errors";
import { findConflicts } from "@/modules/calendar/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const sp = new URL(request.url).searchParams;
  try {
    const conflicts = await findConflicts(ctx.businessId, {
      ownerId: sp.get("ownerId"),
      startsAt: sp.get("startsAt") ?? "",
      endsAt: sp.get("endsAt") ?? "",
      excludeId: sp.get("excludeId") ?? undefined,
    });
    return NextResponse.json(conflicts);
  } catch (err) {
    return calendarErrorResponse(err);
  }
}
