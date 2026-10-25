import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse } from "@/lib/api-guard";
import { customModuleCreateSchema } from "@/lib/schemas";
import { createModule, listModules } from "@/modules/custom-modules/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listModules(ctx.businessId));
}

// Crear módulos (y sus campos) es configuración: dueño o admin.
export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ admin: "fields" });
  if (!ctx) return response;
  const { data, response: badRequest } = await parseBody(request, customModuleCreateSchema);
  if (!data) return badRequest;
  try {
    return NextResponse.json(await createModule(ctx.businessId, data), { status: 201 });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
