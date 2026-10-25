import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse, requireRecordAccess, forbidden } from "@/lib/api-guard";
import { customFieldValueSetSchema } from "@/lib/schemas";
import { normalizeCustomValue } from "@/lib/custom-fields";
import { CUSTOM_RECORD_FIELDS, STANDARD_FIELDS, customFieldKey, isStandardEntityType } from "@/lib/entities";
import { prisma } from "@/lib/prisma";
import { can } from "@/modules/access/service";
import { writeFields } from "@/modules/entities/writer";

// Edición de UN campo personalizado desde la ficha de un registro. Pasa por
// el servicio del módulo (writeFields → updateLead/updateRecord/…), así
// aplican las mismas validaciones, permisos, automatizaciones "antes de
// guardar" y eventos que cualquier otra edición.
export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const raw = (await request.clone().json().catch(() => ({}))) as Record<string, unknown>;
  const { data, response: badRequest } = await parseBody(request, customFieldValueSetSchema);
  if (!data) return badRequest;

  const definition = await prisma.customFieldDefinition.findFirst({ where: { id: data.definitionId, businessId: ctx.businessId } });
  if (!definition) return notFound();
  if (definition.type === "image") return NextResponse.json({ error: "invalid_value", message: `"${definition.label}" se edita con su propio control.` }, { status: 400 });
  if (!can(ctx.access, definition.entityType, "edit")) return forbidden();
  const denied = await requireRecordAccess(ctx, definition.entityType, data.entityId, "edit");
  if (denied) return denied;

  try {
    const value = data.value ?? null;
    // Datos extra que pidió una automatización "antes de guardar" (el
    // diálogo los agrega al reintentar): otros campos personalizados en
    // customValues/values y campos estándar escribibles por su nombre.
    const changes: Record<string, string | null> = { [customFieldKey(definition.id)]: value };
    const extraCustom = { ...(raw.customValues as Record<string, unknown>), ...(raw.values as Record<string, unknown>) };
    for (const [k, v] of Object.entries(extraCustom)) if (typeof v === "string" || v === null) changes[customFieldKey(k)] = v;
    const meta = new Map((isStandardEntityType(definition.entityType) ? STANDARD_FIELDS[definition.entityType] : CUSTOM_RECORD_FIELDS).map((f) => [f.key, f]));
    for (const [k, v] of Object.entries(raw)) if (meta.get(k)?.writable && typeof v === "string") changes[k] = v;
    const result = await writeFields(ctx.businessId, definition.entityType, data.entityId, changes, ctx.userId);
    if (!result) return notFound();
    return NextResponse.json({ value: definition.type === "relation" ? value : normalizeCustomValue(definition.type, value) });
  } catch (err) {
    return domainErrorResponse(err);
  }
}
