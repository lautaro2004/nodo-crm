import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { customFieldReorderSchema } from "@/lib/schemas";
import { reorderCustomFieldDefinitions, type CustomFieldEntityType } from "@/modules/custom-fields/service";

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, customFieldReorderSchema);
  if (!data) return badRequest;
  await reorderCustomFieldDefinitions(ctx.businessId, data.entityType as CustomFieldEntityType, data.ids);
  return NextResponse.json({ ok: true });
}
