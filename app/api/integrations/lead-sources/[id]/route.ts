import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { integrationPatchSchema } from "@/modules/integrations/config";
import { deleteIntegration, updateIntegration } from "@/modules/integrations/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: bad } = await parseBody(request, integrationPatchSchema);
  if (!data) return bad;
  try {
    await updateIntegration(ctx.businessId, id, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}

// Google Sheets: borra la conexión (y su historial). Instagram: desconecta
// (revoca la suscripción de webhooks y elimina el token de Nodo).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id } = await params;
  try {
    await deleteIntegration(ctx.businessId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
