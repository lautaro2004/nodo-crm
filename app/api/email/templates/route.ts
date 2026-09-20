import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { emailTemplateCreateSchema } from "@/lib/schemas";
import { emailErrorResponse } from "@/modules/email/errors";
import { createTemplate, listTemplates } from "@/modules/email/templates";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listTemplates(ctx.businessId));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, emailTemplateCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createTemplate(ctx.businessId, data), { status: 201 });
  } catch (err) {
    return emailErrorResponse(err);
  }
}
