import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { companyUpdateSchema } from "@/lib/schemas";
import { getCompany, updateCompany, deleteCompany } from "@/modules/companies/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "company", id, "view");
  if (denied) return denied;
  const record = await getCompany(ctx.businessId, id);
  if (!record) return notFound();
  return NextResponse.json(record);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "company", id, "edit");
  if (denied) return denied;
  const { data, response: badRequest } = await parseBody(request, companyUpdateSchema);
  if (!data) return badRequest;

  try {
    const record = await updateCompany(ctx.businessId, id, data, ctx.userId);
    if (!record) return notFound();
    return NextResponse.json(record);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "company", id, "delete");
  if (denied) return denied;
  const ok = await deleteCompany(ctx.businessId, id, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
