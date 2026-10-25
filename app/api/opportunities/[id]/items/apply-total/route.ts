import { NextResponse } from "next/server";

import { requireWorkspace, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { applyItemsTotal } from "@/modules/opportunity-items/service";

// "Usar total de productos": acción explícita del usuario (nunca automática).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "opportunity", id, "edit");
  if (denied) return denied;
  try {
    return NextResponse.json({ amount: await applyItemsTotal(ctx.businessId, id) });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
