import { NextResponse } from "next/server";

import { requireWorkspace, notFound, requireRecordAccess } from "@/lib/api-guard";
import { updateCompany } from "@/modules/companies/service";

// Archivar = status "archived", vía updateCompany (mismos eventos y
// automatizaciones que cualquier cambio de estado).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "company", id, "edit");
  if (denied) return denied;
  const ok = await updateCompany(ctx.businessId, id, { status: "archived" }, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
