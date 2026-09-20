import { NextResponse } from "next/server";

import { requireWorkspace } from "@/lib/api-guard";
import { emailErrorResponse } from "@/modules/email/errors";
import { sendTestEmail } from "@/modules/email/send";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  try {
    return NextResponse.json(await sendTestEmail(ctx.businessId, ctx.userId, id));
  } catch (err) {
    return emailErrorResponse(err);
  }
}
