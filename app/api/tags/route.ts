import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { tagCreateSchema } from "@/lib/schemas";
import { createTag, listTags } from "@/modules/tags/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listTags(ctx.businessId));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, tagCreateSchema);
  if (!data) return badRequest;

  const tag = await createTag(ctx.businessId, data);
  return NextResponse.json(tag, { status: 201 });
}
