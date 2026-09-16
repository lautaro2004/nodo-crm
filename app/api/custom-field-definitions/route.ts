import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { customFieldDefinitionCreateSchema } from "@/lib/schemas";
import { createCustomFieldDefinition, listCustomFieldDefinitions } from "@/modules/custom-fields/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const definitions = await listCustomFieldDefinitions(ctx.businessId, entityType as never);
  return NextResponse.json(definitions);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, customFieldDefinitionCreateSchema);
  if (!data) return badRequest;

  const definition = await createCustomFieldDefinition(ctx.businessId, data);
  return NextResponse.json(definition, { status: 201 });
}
