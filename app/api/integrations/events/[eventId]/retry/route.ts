import { NextResponse } from "next/server";

import { requireWorkspace, domainErrorResponse } from "@/lib/api-guard";
import { retryEvent } from "@/modules/integrations/service";

export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { eventId } = await params;
  try {
    return NextResponse.json(await retryEvent(ctx.businessId, eventId));
  } catch (err) {
    return domainErrorResponse(err);
  }
}
