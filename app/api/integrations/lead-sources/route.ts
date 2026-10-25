import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { createSheetsIntegration, integrationsEnvironment, listIntegrations } from "@/modules/integrations/service";

// Integraciones de captura de leads del negocio actual. Solo owner/admin:
// la configuración de integraciones es parte de "configurar Nodo".
export async function GET() {
  const { ctx, response } = await requireWorkspace({ admin: "settings" });
  if (!ctx) return response;
  return NextResponse.json({ integrations: await listIntegrations(ctx.businessId), environment: integrationsEnvironment() });
}

const createSchema = z.object({ type: z.literal("google_sheets"), name: z.string().trim().min(1).max(80) });

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ admin: "settings" });
  if (!ctx) return response;
  const { data, response: bad } = await parseBody(request, createSchema);
  if (!data) return bad;
  try {
    // El secreto se devuelve UNA sola vez; Nodo solo guarda su versión cifrada.
    const created = await createSheetsIntegration(ctx.businessId, ctx.userId, data.name);
    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
