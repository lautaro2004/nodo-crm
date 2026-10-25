import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { endOfDay, getCustomFieldFilters, getDay, getParam, type SearchParamsLike } from "@/lib/filters/params";
import { validateCustomValue, type FieldValidation } from "@/lib/custom-fields";
import { RECORDS_PAGE_SIZE, moduleEntityType } from "@/lib/custom-modules";
import { CustomValuesError, entityIdsMatchingCustomFilter, setCustomFieldValue } from "@/modules/custom-fields/service";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { cleanupDeletedRecord } from "@/modules/records/cleanup";
import { parseIdList, setRelationLinks } from "@/modules/records/links";
import { getModuleById, listModuleFields } from "@/modules/custom-modules/service";
import { proposedFrom, trackChange } from "@/modules/automations/workflow";

// Registros de módulos personalizados. Toda operación revalida que el
// módulo sea del negocio (y el registro, del módulo).

/** Errores por campo (definitionId → mensaje) para mostrarlos en el form. */
export class RecordValidationError extends CustomValuesError {}

export interface RecordListFilters {
  search?: string;
  archived?: boolean;
  ownerId?: string;
  customFields?: { definitionId: string; value: string }[];
  from?: Date;
  to?: Date;
  dateField?: string;
  sort?: string;
  page?: number;
  /** Alcance de permisos (responsable o creador visibles para el usuario). */
  scope?: Prisma.CustomRecordWhereInput;
}

/** Filtros desde la URL (mismos nombres que Leads/Oportunidades). */
export function parseRecordFilters(sp: SearchParamsLike, userId: string): RecordListFilters {
  const owner = getParam(sp, "ownerId");
  const page = Number.parseInt(getParam(sp, "page") ?? "", 10);
  return {
    search: getParam(sp, "q") || undefined,
    archived: getParam(sp, "archived") === "1",
    ownerId: owner === "me" ? userId : owner || undefined,
    customFields: getCustomFieldFilters(sp),
    from: getDay(sp, "from"),
    to: getDay(sp, "to"),
    dateField: getParam(sp, "dateField") || undefined,
    sort: getParam(sp, "sort") || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export async function listRecords(businessId: string, moduleId: string, f: RecordListFilters = {}) {
  const entityType = moduleEntityType(moduleId);
  const and: Prisma.CustomRecordWhereInput[] = [];
  if (f.scope && Object.keys(f.scope).length) and.push(f.scope);
  if (f.search) and.push({ title: { contains: f.search, mode: "insensitive" } });
  if (f.ownerId) and.push({ ownerId: f.ownerId === "none" ? null : f.ownerId });
  if (f.from || f.to) {
    const field = f.dateField === "updated" ? "updatedAt" : "createdAt";
    and.push({ [field]: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: endOfDay(f.to) } : {}) } });
  }
  for (const cf of f.customFields ?? []) {
    and.push({ id: { in: await entityIdsMatchingCustomFilter(businessId, entityType, cf.definitionId, cf.value) } });
  }
  const where: Prisma.CustomRecordWhereInput = {
    businessId,
    moduleId,
    archivedAt: f.archived ? { not: null } : null,
    ...(and.length ? { AND: and } : {}),
  };
  const orderBy: Prisma.CustomRecordOrderByWithRelationInput =
    f.sort === "title" ? { title: "asc" } : f.sort === "updated" ? { updatedAt: "desc" } : { createdAt: "desc" };
  const page = Math.max(1, f.page ?? 1);
  const [items, total] = await Promise.all([
    prisma.customRecord.findMany({ where, orderBy, skip: (page - 1) * RECORDS_PAGE_SIZE, take: RECORDS_PAGE_SIZE }),
    prisma.customRecord.count({ where }),
  ]);
  return { items, total, page, pageSize: RECORDS_PAGE_SIZE };
}

/** Todos los registros que cumplen el filtro (para CSV), con tope. */
export async function listAllRecords(businessId: string, moduleId: string, f: RecordListFilters = {}, max = 5000) {
  const out = [];
  for (let page = 1; out.length < max; page++) {
    const { items, total } = await listRecords(businessId, moduleId, { ...f, page });
    out.push(...items);
    if (out.length >= total || items.length === 0) break;
  }
  return out.slice(0, max);
}

export async function getRecord(businessId: string, moduleId: string, id: string) {
  return prisma.customRecord.findFirst({ where: { id, businessId, moduleId } });
}

export interface RecordInput {
  title?: string;
  ownerId?: string | null;
  values?: Record<string, string | null>;
}

type FieldDef = Awaited<ReturnType<typeof listModuleFields>>[number];

// Valida TODOS los valores contra las definiciones reales del módulo antes
// de escribir nada (así un error en un campo no deja el registro a medias).
function validateValues(fields: FieldDef[], values: Record<string, string | null>, creating: boolean) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const errors: Record<string, string> = {};
  for (const [id, raw] of Object.entries(values)) {
    const def = byId.get(id);
    if (!def) {
      errors[id] = "Ese campo no es de este módulo.";
      continue;
    }
    if (def.type === "image") continue; // se sube por su propio endpoint
    if (def.type === "relation") continue; // se valida contra la base al guardar
    const message = validateCustomValue({ type: def.type, options: def.options, label: def.label, validation: (def.validation as FieldValidation | null) ?? null }, raw ?? "");
    if (message) errors[id] = message;
  }
  for (const def of fields) {
    if (!def.required || def.type === "image") continue;
    const provided = def.id in values;
    const empty = !(values[def.id] ?? "").trim();
    if ((creating && empty && !(!provided && def.defaultValue)) || (!creating && provided && empty)) errors[def.id] = `"${def.label}" es obligatorio.`;
  }
  if (Object.keys(errors).length) throw new RecordValidationError(errors);
}

async function writeValues(businessId: string, moduleId: string, recordId: string, fields: FieldDef[], values: Record<string, string | null>) {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const entityType = moduleEntityType(moduleId);
  for (const [id, raw] of Object.entries(values)) {
    const def = byId.get(id);
    if (!def || def.type === "image") continue;
    if (def.type === "relation") {
      try {
        await setRelationLinks(businessId, def, entityType, recordId, parseIdList(raw));
      } catch (err) {
        const taken = err instanceof Error && err.message === "relation_target_taken";
        throw new RecordValidationError({
          [def.id]: taken ? `"${def.label}": alguno de los registros elegidos ya está vinculado a otro registro.` : `"${def.label}": alguno de los registros elegidos no existe.`,
        });
      }
      continue;
    }
    await setCustomFieldValue(businessId, id, recordId, raw, { skipEntityCheck: true, skipRequired: true });
  }
}

function defaultValues(fields: FieldDef[]): Record<string, string> {
  return Object.fromEntries(fields.filter((f) => f.defaultValue && f.type !== "relation" && f.type !== "image").map((f) => [f.id, f.defaultValue!]));
}

async function loadWritableModule(businessId: string, moduleId: string) {
  const mod = await getModuleById(businessId, moduleId);
  if (!mod) throw new Error("module_not_found");
  if (mod.archivedAt) throw new Error("module_archived");
  return mod;
}

export async function createRecord(businessId: string, moduleId: string, userId: string, data: RecordInput) {
  await loadWritableModule(businessId, moduleId);
  const fields = await listModuleFields(businessId, moduleId);
  // Valores predeterminados de los campos que no vinieron en el alta.
  const values = { ...defaultValues(fields), ...(data.values ?? {}) };
  validateValues(fields, values, true);
  if (data.ownerId) await assertUserBelongsToBusiness(businessId, data.ownerId);

  return trackChange(
    {
      businessId,
      entityType: moduleEntityType(moduleId),
      kind: "create",
      proposed: proposedFrom({ title: data.title, ownerId: data.ownerId ?? null }, values),
      actorUserId: userId,
    },
    () => insertRecord(businessId, moduleId, userId, data, fields, values),
    (record) => record.id
  );
}

async function insertRecord(businessId: string, moduleId: string, userId: string, data: RecordInput, fields: FieldDef[], values: Record<string, string | null>) {
  const record = await prisma.customRecord.create({
    data: { businessId, moduleId, title: (data.title ?? "").trim(), ownerId: data.ownerId ?? null, createdById: userId },
  });
  try {
    await writeValues(businessId, moduleId, record.id, fields, values);
  } catch (err) {
    // Relación inválida descubierta al escribir: no dejar un registro a medias.
    await cleanupDeletedRecord(businessId, moduleEntityType(moduleId), record.id);
    await prisma.customRecord.delete({ where: { id: record.id } });
    throw err;
  }
  return record;
}

export async function updateRecord(
  businessId: string,
  moduleId: string,
  id: string,
  data: RecordInput & { archived?: boolean },
  actorUserId: string | null = null
) {
  const record = await getRecord(businessId, moduleId, id);
  if (!record) return null;
  const fields = await listModuleFields(businessId, moduleId);
  const values = data.values ?? {};
  validateValues(fields, values, false);
  if (data.ownerId) await assertUserBelongsToBusiness(businessId, data.ownerId);

  return trackChange(
    {
      businessId,
      entityType: moduleEntityType(moduleId),
      kind: "update",
      recordId: id,
      proposed: proposedFrom({ title: data.title, ownerId: data.ownerId }, values),
      actorUserId,
    },
    async () => {
      await writeValues(businessId, moduleId, id, fields, values);
      return applyRecordUpdate(id, data);
    },
    (updated) => updated.id
  );
}

function applyRecordUpdate(id: string, data: RecordInput & { archived?: boolean }) {
  return prisma.customRecord.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
      ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
      // updatedAt cambia aunque solo se hayan tocado valores personalizados.
      updatedAt: new Date(),
    },
  });
}

export async function deleteRecord(businessId: string, moduleId: string, id: string, actorUserId: string | null = null) {
  return trackChange(
    { businessId, entityType: moduleEntityType(moduleId), kind: "delete", recordId: id, actorUserId },
    async () => {
      const result = await prisma.customRecord.deleteMany({ where: { id, businessId, moduleId } });
      if (result.count > 0) await cleanupDeletedRecord(businessId, moduleEntityType(moduleId), id);
      return result.count > 0;
    },
    (ok) => (ok ? id : null)
  );
}
