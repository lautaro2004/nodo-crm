import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { parseSheetsConfig, sheetsConfigPatchSchema } from "@/modules/integrations/config";
import { leadCustomFields } from "@/modules/integrations/sheets";
import { mapRow, type MappingTarget } from "@/modules/integrations/normalize";

// Prueba de mapeo SIN efectos: aplica el mapeo (guardado o el que se está
// editando) a una fila de ejemplo y devuelve el lead resultante o los
// errores. No crea leads ni eventos.
const schema = z.object({
  values: z.record(z.string().max(120), z.string().max(2000)),
  config: sheetsConfigPatchSchema.optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "settings" });
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: bad } = await parseBody(request, schema);
  if (!data) return bad;
  const integration = await prisma.leadIntegration.findFirst({ where: { id, businessId: ctx.businessId, type: "google_sheets" } });
  if (!integration) return NextResponse.json({ error: "integration_not_found" }, { status: 404 });
  const config = { ...parseSheetsConfig(integration.config), ...(data.config ?? {}) };
  const result = mapRow(data.values, config.mapping as Record<string, MappingTarget>, config.required, await leadCustomFields(ctx.businessId));
  return NextResponse.json(result);
}
