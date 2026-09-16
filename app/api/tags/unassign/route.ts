import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { tagAssignSchema } from "@/lib/schemas";
import { unassignTag } from "@/modules/tags/service";

const bodySchema = tagAssignSchema.extend({ tagId: z.string().trim().min(1) });

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, bodySchema);
  if (!data) return badRequest;

  const ok = await unassignTag(ctx.businessId, data.tagId, data.entityType, data.entityId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
