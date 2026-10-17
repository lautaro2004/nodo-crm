import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse } from "@/lib/api-guard";
import { automationRuleUpdateSchema } from "@/modules/automations/config";
import { deleteRule, updateRule } from "@/modules/automations/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, automationRuleUpdateSchema);
  if (!data) return badRequest;
  try {
    const rule = await updateRule(ctx.businessId, id, ctx, data);
    if (!rule) return notFound();
    return NextResponse.json(rule);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  try {
    const ok = await deleteRule(ctx.businessId, id, ctx);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
