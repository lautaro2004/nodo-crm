import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, domainErrorResponse, forbidden } from "@/lib/api-guard";
import { can } from "@/modules/access/service";
import { importExecuteSchema } from "@/lib/schemas";
import { IMPORT_MODULES, type ImportModule } from "@/modules/import/shared";
import { executeCustomModuleImport, executeImport } from "@/modules/import/execute";
import { moduleIdFromEntityType } from "@/lib/custom-modules";

// El módulo viaja en la URL (Fase 8: "nunca confiar en... nombres de
// entidades") — se valida contra la whitelist fija (o contra los módulos
// personalizados del negocio, "cm:<id>") ANTES de tocar cualquier lógica
// de negocio, nunca se usa el string crudo para acceso dinámico a un
// modelo de Prisma.
export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const { ctx, response } = await requireWorkspace({ admin: "import" });
  if (!ctx) return response;

  const moduleParam = decodeURIComponent((await params).module);
  const customModuleId = /^cm:[a-z0-9]{10,40}$/.test(moduleParam) ? moduleIdFromEntityType(moduleParam) : null;
  if (!customModuleId && !(IMPORT_MODULES as readonly string[]).includes(moduleParam)) {
    return NextResponse.json({ error: "unknown_module" }, { status: 404 });
  }

  // Importar crea registros: además del permiso de importar, el de crear en ese módulo.
  if (!can(ctx.access, moduleParam, "create")) return forbidden();

  const { data, response: badRequest } = await parseBody(request, importExecuteSchema);
  if (!data) return badRequest;

  try {
    const result = customModuleId
      ? await executeCustomModuleImport(ctx.businessId, customModuleId, ctx.userId, data.rows)
      : await executeImport(ctx.businessId, moduleParam as ImportModule, data.rows, ctx.userId);
    return NextResponse.json(result);
  } catch (err) {
    return domainErrorResponse(err);
  }
}
