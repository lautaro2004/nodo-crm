import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { savedViewCreateSchema } from "@/lib/schemas";
import { createView, listViews, type ViewEntityType } from "@/modules/views/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const raw = new URL(request.url).searchParams.get("entityType") ?? "";
  const entityType: ViewEntityType = ["opportunity", "contact", "company", "task"].includes(raw) || /^cm:[a-z0-9]{10,40}$/.test(raw) ? (raw as ViewEntityType) : "lead";
  return NextResponse.json(await listViews(ctx.businessId, entityType, ctx));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, savedViewCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createView(ctx.businessId, ctx, data as typeof data & { entityType: ViewEntityType }), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
