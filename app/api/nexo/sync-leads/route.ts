import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { syncLeadsFromNexo } from "@/modules/nexo/sync-leads";

// Disparador manual (MVP) — sin cron/webhook todavía, ver
// docs/architecture/crm-fase4-nexo-leads.md, "Método de sincronización".
// businessId SIEMPRE resuelto de la sesión, nunca del body — no hay body.
export async function POST() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const result = await syncLeadsFromNexo(ctx.businessId);
  return NextResponse.json(result);
}
