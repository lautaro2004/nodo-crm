import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { statusDefinitionCreateSchema, statusDefinitionReorderSchema } from "@/lib/schemas";
import { createStatusDefinition, listStatusDefinitions, reorderStatusDefinitions } from "@/modules/status-definitions/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  return NextResponse.json(await listStatusDefinitions(ctx.businessId, entityType as never));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, statusDefinitionCreateSchema);
  if (!data) return badRequest;

  try {
    const status = await createStatusDefinition(ctx.businessId, data);
    return NextResponse.json(status, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}

// Reordenar: PATCH con { entityType, ids: [...] } en el orden final.
export async function PATCH(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, statusDefinitionReorderSchema);
  if (!data) return badRequest;

  await reorderStatusDefinitions(ctx.businessId, data.entityType, data.ids);
  return NextResponse.json({ ok: true });
}
