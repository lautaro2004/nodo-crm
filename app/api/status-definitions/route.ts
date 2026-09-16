import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { statusDefinitionCreateSchema } from "@/lib/schemas";
import { createStatusDefinition, listStatusDefinitions } from "@/modules/status-definitions/service";

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

  const status = await createStatusDefinition(ctx.businessId, data);
  return NextResponse.json(status, { status: 201 });
}
