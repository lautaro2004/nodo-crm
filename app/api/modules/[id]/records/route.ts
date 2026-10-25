import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, forbidden } from "@/lib/api-guard";
import { customRecordCreateSchema } from "@/lib/schemas";
import { moduleEntityType } from "@/lib/custom-modules";
import { createRecord, RecordValidationError } from "@/modules/custom-modules/records";
import { can, defaultOwnerFor } from "@/modules/access/service";

// Alta de registros: permiso "Crear" en el módulo (por defecto, cualquier
// miembro, como en Leads).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  if (!can(ctx.access, moduleEntityType(id), "create")) return forbidden();
  const { data, response: badRequest } = await parseBody(request, customRecordCreateSchema);
  if (!data) return badRequest;
  try {
    const record = await createRecord(ctx.businessId, id, ctx.userId, { ...data, ownerId: defaultOwnerFor(ctx.access, moduleEntityType(id), data.ownerId) });
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof RecordValidationError) return NextResponse.json({ error: "invalid_value", fields: err.fields }, { status: 400 });
    return domainErrorResponse(err);
  }
}
