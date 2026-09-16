import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { leadCreateSchema } from "@/lib/schemas";
import { createLead, listLeads } from "@/modules/leads/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const leads = await listLeads(ctx.businessId, {
    search: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });
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
  } catch {
    return NextResponse.json({ error: "company_not_found" }, { status: 400 });
  }
}
