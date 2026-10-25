import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { companyCreateSchema } from "@/lib/schemas";
import { createCompany, listCompanies } from "@/modules/companies/service";
import { defaultOwnerFor, scopeWhere } from "@/modules/access/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace({ permission: { entity: "company", action: "view" } });
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const companies = await listCompanies(ctx.businessId, {
    search: searchParams.get("q") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    tagId: searchParams.get("tagId") ?? undefined,
    scope: scopeWhere(ctx.access, "company"),
  });
  return NextResponse.json(companies);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ permission: { entity: "company", action: "create" } });
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, companyCreateSchema);
  if (!data) return badRequest;

  try {
    const company = await createCompany(
      ctx.businessId,
      { ...data, ownerId: defaultOwnerFor(ctx.access, "company", data.ownerId) },
      { enforceRequired: data.customValues !== undefined, actorUserId: ctx.userId }
    );
    return NextResponse.json(company, { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
