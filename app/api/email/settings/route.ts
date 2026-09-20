import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { emailSettingsSchema } from "@/lib/schemas";
import { getEmailSettings, upsertEmailSettings } from "@/modules/email/settings";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await getEmailSettings(ctx.businessId));
}

export async function PUT(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, emailSettingsSchema);
  if (!data) return badRequest;
  return NextResponse.json(await upsertEmailSettings(ctx.businessId, data));
}
