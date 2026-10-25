import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { opportunityCreateSchema } from "@/lib/schemas";
import { createOpportunity, listOpportunities } from "@/modules/opportunities/service";
import { parseOpportunityFilters } from "@/modules/opportunities/filters";
import { defaultOwnerFor, scopeWhere } from "@/modules/access/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace({ permission: { entity: "opportunity", action: "view" } });
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const opportunities = await listOpportunities(ctx.businessId, { ...parseOpportunityFilters(searchParams, ctx.userId), scope: scopeWhere(ctx.access, "opportunity") });
  return NextResponse.json(opportunities);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ permission: { entity: "opportunity", action: "create" } });
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, opportunityCreateSchema);
  if (!data) return badRequest;

  try {
    const opportunity = await createOpportunity(
      ctx.businessId,
      { ...data, ownerId: defaultOwnerFor(ctx.access, "opportunity", data.ownerId) },
      { enforceRequired: data.customValues !== undefined, actorUserId: ctx.userId }
    );
    return NextResponse.json(opportunity, { status: 201 });
  } catch (err) {
    // Errores de dominio conocidos (etapa/pipeline inválidos, automatizaciones…).
    try {
      return domainErrorResponse(err);
    } catch {
      return NextResponse.json({ error: err instanceof Error ? err.message : "invalid_input" }, { status: 400 });
    }
  }
}
