import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { opportunityCreateSchema } from "@/lib/schemas";
import { createOpportunity, listOpportunities } from "@/modules/opportunities/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const opportunities = await listOpportunities(ctx.businessId, {
    search: searchParams.get("q") ?? undefined,
    pipelineId: searchParams.get("pipelineId") ?? undefined,
    stageId: searchParams.get("stageId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
  return NextResponse.json(opportunities);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, opportunityCreateSchema);
  if (!data) return badRequest;

  try {
    const opportunity = await createOpportunity(ctx.businessId, data);
    return NextResponse.json(opportunity, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "invalid_input" }, { status: 400 });
  }
}
