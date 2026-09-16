import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { companyCreateSchema } from "@/lib/schemas";
import { createCompany, listCompanies } from "@/modules/companies/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const companies = await listCompanies(ctx.businessId, {
    search: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    tagId: searchParams.get("tagId") ?? undefined,
  });
  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, companyCreateSchema);
  if (!data) return badRequest;

  const company = await createCompany(ctx.businessId, data);
  return NextResponse.json(company, { status: 201 });
}
