import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { MAX_BULK_DELETE, deleteRecords, getDeletionImpact, isDeletableEntity } from "@/modules/records/delete";

// Eliminación de uno o varios registros del mismo tipo (selección múltiple
// y botón "Eliminar" de la ficha). Mismo permiso que los DELETE de cada
// entidad: admin u owner. El businessId sale SIEMPRE de la sesión; un id de
// otro negocio simplemente no se encuentra.
//
// - preview: true → no borra nada; devuelve qué se desvincula y qué se borra.
// - Respuesta del borrado: { deleted, notFound, failed } (ids). 200 si no
//   falló ninguno; 207 si hubo fallas parciales; 500 si fallaron todos.

const schema = z.object({
  entityType: z.string().refine(isDeletableEntity, "Tipo de registro inválido"),
  ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_BULK_DELETE),
  preview: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace({ minRole: "admin" });
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, schema);
  if (!data) return badRequest;
  const entityType = data.entityType as Parameters<typeof deleteRecords>[1];

  if (data.preview) {
    return NextResponse.json(await getDeletionImpact(ctx.businessId, entityType, data.ids));
  }

  const result = await deleteRecords(ctx.businessId, entityType, data.ids);
  const status = result.failed.length === 0 ? 200 : result.deleted.length + result.notFound.length > 0 ? 207 : 500;
  return NextResponse.json(result, { status });
}
