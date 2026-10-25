import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, requireRecordAccess } from "@/lib/api-guard";
import { emailSendSchema } from "@/lib/schemas";
import { emailErrorResponse } from "@/modules/email/errors";
import { sendEntityEmail } from "@/modules/email/send";

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, emailSendSchema);
  if (!data) return badRequest;
  // Enviar un email desde un registro queda en su historial: requiere poder editarlo.
  const denied = await requireRecordAccess(ctx, data.entityType, data.entityId, "edit");
  if (denied) return denied;
  try {
    const result = await sendEntityEmail(ctx.businessId, ctx.userId, data.entityType, data.entityId, {
      subject: data.subject,
      bodyHtml: data.bodyHtml,
    });
    return NextResponse.json(result, { status: result.status === "failed" ? 502 : 200 });
  } catch (err) {
    return emailErrorResponse(err);
  }
}
