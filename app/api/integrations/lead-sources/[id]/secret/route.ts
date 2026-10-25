import { NextResponse } from "next/server";

import { requireWorkspace, domainErrorResponse } from "@/lib/api-guard";
import { rotateSheetsSecret } from "@/modules/integrations/service";

// Genera un secreto nuevo (el anterior deja de valer). Se devuelve una vez.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "settings" });
  if (!ctx) return response;
  const { id } = await params;
  try {
    return NextResponse.json(await rotateSheetsSecret(ctx.businessId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
