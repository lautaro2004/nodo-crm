import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { syncLeadsFromNexo } from "@/modules/nexo/sync-leads";

// Disparador manual: revisa TODO el historial del negocio (sin ventana). La
// sincronización automática corre aparte, por cron, sobre los últimos días
// (ver app/api/cron/sync-nexo-leads y docs/architecture/crm-fase4-nexo-leads.md).
// businessId SIEMPRE resuelto de la sesión, nunca del body — no hay body.
export async function POST() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const result = await syncLeadsFromNexo(ctx.businessId);
  return NextResponse.json(result);
}
