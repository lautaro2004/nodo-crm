import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { dashboardCreateSchema } from "@/modules/reports/dashboard-config";
import { createDashboard, listDashboards } from "@/modules/reports/dashboards";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listDashboards(ctx.businessId, ctx));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, dashboardCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createDashboard(ctx.businessId, ctx, data), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
