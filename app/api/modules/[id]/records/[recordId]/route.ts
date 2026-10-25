import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, notFound, requireRecordAccess } from "@/lib/api-guard";
import { customRecordUpdateSchema } from "@/lib/schemas";
import { moduleEntityType } from "@/lib/custom-modules";
import { deleteRecord, RecordValidationError, updateRecord } from "@/modules/custom-modules/records";

// Editar y archivar: permiso "Editar" del módulo. Borrar definitivo:
// "Eliminar" (por defecto, administradores — mismo criterio que los
// módulos estándar). Siempre dentro del alcance de la persona.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId } = await params;
  const denied = await requireRecordAccess(ctx, moduleEntityType(id), recordId, "edit");
  if (denied) return denied;
  const { data, response: badRequest } = await parseBody(request, customRecordUpdateSchema);
  if (!data) return badRequest;
  try {
    const record = await updateRecord(ctx.businessId, id, recordId, data, ctx.userId);
    return record ? NextResponse.json(record) : notFound();
  } catch (err) {
    if (err instanceof RecordValidationError) return NextResponse.json({ error: "invalid_value", fields: err.fields }, { status: 400 });
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId } = await params;
  const denied = await requireRecordAccess(ctx, moduleEntityType(id), recordId, "delete");
  if (denied) return denied;
  const ok = await deleteRecord(ctx.businessId, id, recordId, ctx.userId);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
