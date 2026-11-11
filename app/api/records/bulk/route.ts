import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWorkspace, parseBody, forbidden } from "@/lib/api-guard";
import { MAX_BULK_UPDATE, bulkKindsFor, bulkUpdateRecords, isBulkEntity, type BulkPatch } from "@/modules/records/bulk";
import { can, canSeeRecord } from "@/modules/access/service";
import { loadRecordOwnership } from "@/modules/access/ownership";

// Acciones masivas sobre registros del mismo tipo (barra "Acciones masivas"
// de las listas). Mismo permiso que el PATCH de cada entidad: "Editar" en ese
// módulo (lib/access.ts) y solo sobre registros dentro del alcance de la
// persona — los demás ids se informan como no encontrados. El businessId sale
// SIEMPRE de la sesión.
//
// Respuesta: { updated, notFound, failed, firstError }. 200 si no falló
// ninguno; 207 si hubo fallas parciales; 500 si fallaron todos.

const schema = z.object({
  entityType: z.string().refine(isBulkEntity, "Tipo de registro inválido"),
  ids: z.array(z.string().min(1).max(64)).min(1).max(MAX_BULK_UPDATE),
  action: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("owner"), ownerId: z.string().trim().min(1).max(60).nullable() }),
    z.object({ kind: z.literal("status"), status: z.string().trim().min(1).max(40), statusReason: z.string().trim().max(200).nullable().optional() }),
    z.object({ kind: z.literal("stage"), stageId: z.string().trim().min(1).max(60) }),
  ]),
});

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, schema);
  if (!data) return badRequest;
  const entityType = data.entityType as Parameters<typeof bulkKindsFor>[0];
  if (!can(ctx.access, entityType, "edit")) return forbidden();
  if (!bulkKindsFor(entityType).includes(data.action.kind)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const allowed: string[] = [];
  const outOfScope: string[] = [];
  for (const id of Array.from(new Set(data.ids))) {
    const record = await loadRecordOwnership(ctx.businessId, entityType, id);
    if (record && canSeeRecord(ctx.access, entityType, record)) allowed.push(id);
    else outOfScope.push(id);
  }

  const patch: BulkPatch = data.action;
  const done = await bulkUpdateRecords(ctx.businessId, entityType, allowed, patch, ctx.userId);
  const result = { ...done, notFound: [...done.notFound, ...outOfScope] };
  const status = result.failed.length === 0 ? 200 : result.updated.length + result.notFound.length > 0 ? 207 : 500;
  return NextResponse.json(result, { status });
}
