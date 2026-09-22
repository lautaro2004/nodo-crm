import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { importExecuteSchema } from "@/lib/schemas";
import { IMPORT_MODULES, type ImportModule } from "@/modules/import/shared";
import { executeImport } from "@/modules/import/execute";

// El módulo viaja en la URL (Fase 8: "nunca confiar en... nombres de
// entidades") — se valida contra la whitelist fija ANTES de tocar
// cualquier lógica de negocio, nunca se usa el string crudo para acceso
// dinámico a un modelo de Prisma.
export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { module } = await params;
  if (!(IMPORT_MODULES as readonly string[]).includes(module)) {
    return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  }

  const { data, response: badRequest } = await parseBody(request, importExecuteSchema);
  if (!data) return badRequest;

  const result = await executeImport(ctx.businessId, module as ImportModule, data.rows);
  return NextResponse.json(result);
}
