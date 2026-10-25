import { NextResponse } from "next/server";

import { requireWorkspace, domainErrorResponse } from "@/lib/api-guard";
import { listEvents } from "@/modules/integrations/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "settings" });
  if (!ctx) return response;
  const { id } = await params;
  try {
    return NextResponse.json({ events: await listEvents(ctx.businessId, id) });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
