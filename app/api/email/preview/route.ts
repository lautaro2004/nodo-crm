import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { emailPreviewSchema } from "@/lib/schemas";
import { emailErrorResponse } from "@/modules/email/errors";
import { previewEntityEmail } from "@/modules/email/send";

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, emailPreviewSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await previewEntityEmail(ctx.businessId, data.entityType, data.entityId, { templateId: data.templateId }));
  } catch (err) {
    return emailErrorResponse(err);
  }
}
