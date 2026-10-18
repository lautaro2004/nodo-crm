import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, notFound } from "@/lib/api-guard";
import { customRecordUpdateSchema } from "@/lib/schemas";
import { deleteRecord, RecordValidationError, updateRecord } from "@/modules/custom-modules/records";

// Editar y archivar: cualquier miembro. Borrar definitivo: admin (mismo
// criterio que los módulos estándar).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id, recordId } = await params;
  const { data, response: badRequest } = await parseBody(request, customRecordUpdateSchema);
  if (!data) return badRequest;
  try {
    const record = await updateRecord(ctx.businessId, id, recordId, data);
    return record ? NextResponse.json(record) : notFound();
  } catch (err) {
    if (err instanceof RecordValidationError) return NextResponse.json({ error: "invalid_value", fields: err.fields }, { status: 400 });
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;
  const { id, recordId } = await params;
  const ok = await deleteRecord(ctx.businessId, id, recordId);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
