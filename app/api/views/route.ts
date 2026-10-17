import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { savedViewCreateSchema } from "@/lib/schemas";
import { createView, listViews } from "@/modules/views/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const entityType = new URL(request.url).searchParams.get("entityType") === "opportunity" ? "opportunity" : "lead";
  return NextResponse.json(await listViews(ctx.businessId, entityType, ctx));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, savedViewCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createView(ctx.businessId, ctx, data), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
