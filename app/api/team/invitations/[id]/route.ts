import { NextResponse } from "next/server";

import { requireWorkspace, notFound, domainErrorResponse } from "@/lib/api-guard";
import { revokeInvitation } from "@/modules/team/service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  try {
    const ok = await revokeInvitation(ctx.businessId, ctx, id);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
