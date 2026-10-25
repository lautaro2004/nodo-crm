import { NextResponse } from "next/server";

import { requireWorkspace, notFound } from "@/lib/api-guard";
import { getOptionUsage } from "@/modules/custom-fields/service";

// Cuántos registros usan cada opción de un campo de lista: el editor lo
// muestra antes de quitar o renombrar opciones.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "fields" });
  if (!ctx) return response;
  const { id } = await params;
  const usage = await getOptionUsage(ctx.businessId, id);
  if (!usage) return notFound();
  return NextResponse.json(usage);
}
