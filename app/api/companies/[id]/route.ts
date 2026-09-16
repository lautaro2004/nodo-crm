import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { companyUpdateSchema } from "@/lib/schemas";
import { getCompany, updateCompany, deleteCompany } from "@/modules/companies/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const company = await getCompany(ctx.businessId, id);
  if (!company) return notFound();
  return NextResponse.json(company);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, companyUpdateSchema);
  if (!data) return badRequest;

  const company = await updateCompany(ctx.businessId, id, data);
  if (!company) return notFound();
  return NextResponse.json(company);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteCompany(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
