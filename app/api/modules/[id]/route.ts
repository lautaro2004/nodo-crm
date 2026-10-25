import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, notFound } from "@/lib/api-guard";
import { customModuleUpdateSchema } from "@/lib/schemas";
import { deleteModule, getModuleById, updateModule } from "@/modules/custom-modules/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "fields" });
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, customModuleUpdateSchema);
  if (!data) return badRequest;
  try {
    const mod = await updateModule(ctx.businessId, id, data);
    return mod ? NextResponse.json(mod) : notFound();
  } catch (err) {
    return domainErrorResponse(err);
  }
}

// Borrado definitivo (con todos sus registros): solo admin y solo si el
// módulo ya está archivado — dos pasos explícitos para algo irreversible.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "fields" });
  if (!ctx) return response;
  const { id } = await params;
  const mod = await getModuleById(ctx.businessId, id);
  if (!mod) return notFound();
  if (!mod.archivedAt) return NextResponse.json({ error: "archive_first" }, { status: 409 });
  await deleteModule(ctx.businessId, id);
  return NextResponse.json({ ok: true });
}
