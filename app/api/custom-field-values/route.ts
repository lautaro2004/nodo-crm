import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { customFieldValueSetSchema } from "@/lib/schemas";
import { setCustomFieldValue } from "@/modules/custom-fields/service";

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, customFieldValueSetSchema);
  if (!data) return badRequest;

  const value = await setCustomFieldValue(ctx.businessId, data.definitionId, data.entityId, data.value ?? null);
  if (!value) return notFound();
  return NextResponse.json(value);
}
