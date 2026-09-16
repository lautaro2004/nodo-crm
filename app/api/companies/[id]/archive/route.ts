import { NextResponse } from "next/server";

import { requireWorkspace, notFound } from "@/lib/api-guard";
import { archiveCompany } from "@/modules/companies/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await archiveCompany(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
