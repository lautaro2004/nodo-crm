import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { customRecordCreateSchema } from "@/lib/schemas";
import { createRecord, RecordValidationError } from "@/modules/custom-modules/records";

// Cualquier miembro con acceso a Nodo carga registros (como en Leads).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, customRecordCreateSchema);
  if (!data) return badRequest;
  try {
    const record = await createRecord(ctx.businessId, id, ctx.userId, data);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    if (err instanceof RecordValidationError) return NextResponse.json({ error: "invalid_value", fields: err.fields }, { status: 400 });
    return domainErrorResponse(err);
  }
}
