import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { customFieldDefinitionCreateSchema } from "@/lib/schemas";
import { createCustomFieldDefinition, listCustomFieldDefinitions, type CreateCustomFieldDefinitionInput } from "@/modules/custom-fields/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const definitions = await listCustomFieldDefinitions(ctx.businessId, entityType as never);
  return NextResponse.json(definitions);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, customFieldDefinitionCreateSchema);
  if (!data) return badRequest;

  try {
    const definition = await createCustomFieldDefinition(ctx.businessId, data as CreateCustomFieldDefinitionInput);
    // 200 si ya existía (mismo nombre y tipo): el cliente lo reutiliza.
    return NextResponse.json(definition, { status: definition.existing ? 200 : 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
