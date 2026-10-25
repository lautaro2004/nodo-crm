import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse } from "@/lib/api-guard";
import { customFieldDefinitionUpdateSchema } from "@/lib/schemas";
import { OptionInUseError, updateCustomFieldDefinition, deleteCustomFieldDefinition } from "@/modules/custom-fields/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "fields" });
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, customFieldDefinitionUpdateSchema);
  if (!data) return badRequest;

  try {
    const ok = await updateCustomFieldDefinition(ctx.businessId, id, data);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Quitar opciones que ya usan registros: la UI muestra cuántos y pide
    // qué hacer con ellos (conservar, vaciar o reemplazar). Nunca se borran
    // datos en silencio.
    if (err instanceof OptionInUseError) return NextResponse.json({ error: "option_in_use", usage: err.usage }, { status: 409 });
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "fields" });
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteCustomFieldDefinition(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
