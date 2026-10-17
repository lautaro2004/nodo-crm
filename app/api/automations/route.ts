import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { automationRuleCreateSchema } from "@/modules/automations/config";
import { createRule, listRecentRuns, listRules } from "@/modules/automations/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const [rules, runs] = await Promise.all([listRules(ctx.businessId), listRecentRuns(ctx.businessId)]);
  return NextResponse.json({ rules, runs });
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, automationRuleCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createRule(ctx.businessId, ctx, data as never), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
