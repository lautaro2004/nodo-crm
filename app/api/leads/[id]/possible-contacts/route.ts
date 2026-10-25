import { NextResponse } from "next/server";

import { requireWorkspace, requireRecordAccess } from "@/lib/api-guard";
import { findPossibleDuplicateContacts } from "@/modules/leads/conversion";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "lead", id, "view");
  if (denied) return denied;
  const matches = await findPossibleDuplicateContacts(ctx.businessId, id);
  return NextResponse.json(matches);
}
