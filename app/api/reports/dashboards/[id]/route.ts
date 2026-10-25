import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, notFound } from "@/lib/api-guard";
import { dashboardUpdateSchema } from "@/modules/reports/dashboard-config";
import { deleteDashboard, updateDashboard } from "@/modules/reports/dashboards";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, dashboardUpdateSchema);
  if (!data) return badRequest;
  try {
    const d = await updateDashboard(ctx.businessId, id, ctx, data);
    return d ? NextResponse.json(d) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  try {
    return (await deleteDashboard(ctx.businessId, id, ctx)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}
