import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { getPreference, setPreference } from "@/modules/preferences/service";

const schema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.union([z.string().max(2000), z.null()]),
});

// Preferencias del usuario actual (nunca de otro: userId sale de la sesión).
export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  return NextResponse.json({ value: await getPreference(ctx.businessId, ctx.userId, key) });
}

export async function PUT(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, schema);
  if (!data) return badRequest;
  try {
    await setPreference(ctx.businessId, ctx.userId, data.key, data.value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
