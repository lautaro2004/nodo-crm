import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { listRecentRuns } from "@/modules/automations/service";

// Historial de ejecuciones (filtrable por regla y estado).
export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace({ admin: "automations" });
  if (!ctx) return response;
  const sp = new URL(request.url).searchParams;
  const status = sp.get("status");
  const runs = await listRecentRuns(ctx.businessId, Number(sp.get("limit") ?? 50) || 50, {
    ruleId: sp.get("ruleId") || undefined,
    status: status && ["success", "skipped", "error", "blocked", "running"].includes(status) ? status : undefined,
  });
  return NextResponse.json(runs);
}
