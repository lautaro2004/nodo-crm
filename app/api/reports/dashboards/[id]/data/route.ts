import { NextResponse } from "next/server";

import { requireWorkspace, notFound } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { computeWidgets, parseWidgets } from "@/modules/reports/dashboards";

// Datos calculados de un panel, siempre con el alcance de quien mira.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const d = await prisma.reportDashboard.findFirst({ where: { id, businessId: ctx.businessId, OR: [{ shared: true }, { createdBy: ctx.userId }] } });
  if (!d) return notFound();
  return NextResponse.json(await computeWidgets(ctx.businessId, ctx.access, parseWidgets(d.widgets)));
}
