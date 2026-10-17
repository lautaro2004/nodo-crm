import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { leadCreateSchema } from "@/lib/schemas";
import { createLead, listLeads } from "@/modules/leads/service";
import { parseLeadFilters } from "@/modules/leads/filters";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  // Mismos filtros que la lista de la UI (modules/leads/filters.ts).
  const leads = await listLeads(ctx.businessId, parseLeadFilters(searchParams, ctx.userId));
  return NextResponse.json(leads);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, leadCreateSchema);
  if (!data) return badRequest;

  try {
    const lead = await createLead(ctx.businessId, data);
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
