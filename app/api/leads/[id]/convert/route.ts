import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { convertLeadSchema } from "@/lib/schemas";
import { convertLead, ConversionError, AlreadyConvertedError } from "@/modules/leads/conversion";

const STATUS_BY_ERROR: Record<string, number> = {
  lead_not_found: 404,
  contact_not_found: 400,
  pipeline_not_found: 400,
  stage_not_found: 400,
  user_not_in_business: 400,
  opportunity_data_missing: 400,
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, convertLeadSchema);
  if (!data) return badRequest;
  if (data.createOpportunity && !data.opportunity) {
    return NextResponse.json({ error: "opportunity_data_missing" }, { status: 400 });
  }

  try {
    const lead = await convertLead(ctx.businessId, id, data, ctx.userId);
    return NextResponse.json(lead, { status: 201 });
  } catch (err) {
    if (err instanceof AlreadyConvertedError) {
      return NextResponse.json({ error: "lead_already_converted", lead: err.lead }, { status: 409 });
    }
    if (err instanceof ConversionError) {
      return NextResponse.json({ error: err.message }, { status: STATUS_BY_ERROR[err.message] ?? 400 });
    }
    console.error("[api/leads/[id]/convert] Error inesperado:", err);
    return NextResponse.json({ error: "conversion_failed" }, { status: 500 });
  }
}
