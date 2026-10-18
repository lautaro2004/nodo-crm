import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { opportunityItemCreateSchema } from "@/lib/schemas";
import { addItem } from "@/modules/opportunity-items/service";

// Mismo permiso que editar la oportunidad (cualquier miembro con acceso).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, opportunityItemCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await addItem(ctx.businessId, id, data), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
