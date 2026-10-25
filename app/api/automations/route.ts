import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { automationRuleCreateSchema } from "@/modules/automations/config";
import { WorkflowConfigError, createRule, listRecentRuns, listRules, runStatsByRule } from "@/modules/automations/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace({ admin: "automations" });
  if (!ctx) return response;
  const [rules, runs, stats] = await Promise.all([listRules(ctx.businessId), listRecentRuns(ctx.businessId), runStatsByRule(ctx.businessId)]);
  return NextResponse.json({ rules, runs, stats });
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ admin: "automations" });
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, automationRuleCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createRule(ctx.businessId, ctx, data as never), { status: 201 });
  } catch (err) {
    if (err instanceof WorkflowConfigError) return NextResponse.json({ error: "invalid_config", message: err.detail }, { status: 400 });
    return domainErrorResponse(err);
  }
}
