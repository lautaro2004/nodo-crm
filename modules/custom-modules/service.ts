import { prisma } from "@/lib/prisma";
import {
  MAX_CUSTOM_MODULES,
  MODULE_TEMPLATES,
  moduleEntityType,
  slugifyModuleKey,
} from "@/lib/custom-modules";
import { createCustomFieldDefinition } from "@/modules/custom-fields/service";
import { removeImagesForValues } from "@/modules/records/images";
import { removeFilesForValues } from "@/modules/records/files";

// Definición de módulos personalizados (Productos, Citas, …). Todo scopeado
// por businessId; el moduleId/key que llega del cliente se revalida acá.

export async function listModules(businessId: string, options: { includeArchived?: boolean } = {}) {
  return prisma.customModule.findMany({
    where: { businessId, ...(options.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function getModuleById(businessId: string, id: string) {
  return prisma.customModule.findFirst({ where: { id, businessId } });
}

export async function getModuleByKey(businessId: string, key: string) {
  return prisma.customModule.findFirst({ where: { key, businessId } });
}

export async function listModuleFields(businessId: string, moduleId: string) {
  return prisma.customFieldDefinition.findMany({
    where: { businessId, moduleId, entityType: moduleEntityType(moduleId) },
    orderBy: { order: "asc" },
  });
}

async function uniqueKey(businessId: string, label: string) {
  const base = slugifyModuleKey(label);
  let key = base;
  for (let i = 2; await prisma.customModule.count({ where: { businessId, key } }); i++) key = `${base}-${i}`;
  return key;
}

export interface CreateModuleInput {
  labelSingular: string;
  labelPlural: string;
  description?: string | null;
  icon?: string | null;
  templateId?: string | null;
}

export async function createModule(businessId: string, data: CreateModuleInput) {
  if ((await prisma.customModule.count({ where: { businessId } })) >= MAX_CUSTOM_MODULES) throw new Error("too_many_modules");
  const template = data.templateId ? MODULE_TEMPLATES.find((t) => t.id === data.templateId) : undefined;
  const last = await prisma.customModule.findFirst({ where: { businessId }, orderBy: { order: "desc" }, select: { order: true } });

  const mod = await prisma.customModule.create({
    data: {
      businessId,
      key: await uniqueKey(businessId, data.labelPlural),
      labelSingular: data.labelSingular.trim(),
      labelPlural: data.labelPlural.trim(),
      description: data.description?.trim() || null,
      icon: data.icon || template?.icon || "box",
      order: last ? last.order + 1 : 0,
    },
  });

  if (template) {
    const roles: { priceFieldId?: string; imageFieldId?: string; codeFieldId?: string } = {};
    for (const f of template.fields) {
      const def = await createCustomFieldDefinition(businessId, {
        entityType: moduleEntityType(mod.id),
        key: f.key,
        label: f.label,
        type: f.type,
        options: f.options,
        required: f.required,
        defaultValue: f.defaultValue,
        description: f.description,
        ...(f.type === "relation" ? { targetEntity: f.targetEntity, multiple: f.multiple, inverseLabel: f.inverseLabel } : {}),
      });
      if (f.role) roles[`${f.role}FieldId`] = def.id;
    }
    if (Object.keys(roles).length) return prisma.customModule.update({ where: { id: mod.id }, data: roles });
  }
  return mod;
}

const ROLE_TYPES: Record<"priceFieldId" | "imageFieldId" | "codeFieldId", string[]> = {
  priceFieldId: ["currency", "number"],
  imageFieldId: ["image"],
  codeFieldId: ["text"],
};

export interface UpdateModuleInput {
  labelSingular?: string;
  labelPlural?: string;
  description?: string | null;
  icon?: string | null;
  priceFieldId?: string | null;
  imageFieldId?: string | null;
  codeFieldId?: string | null;
  archived?: boolean;
}

export async function updateModule(businessId: string, id: string, data: UpdateModuleInput) {
  const mod = await getModuleById(businessId, id);
  if (!mod) return null;

  // Los campos con rol tienen que ser de ESTE módulo y del tipo adecuado.
  for (const role of Object.keys(ROLE_TYPES) as (keyof typeof ROLE_TYPES)[]) {
    const fieldId = data[role];
    if (!fieldId) continue;
    const def = await prisma.customFieldDefinition.findFirst({ where: { id: fieldId, businessId, moduleId: id } });
    if (!def || !ROLE_TYPES[role].includes(def.type)) throw new Error("invalid_role_field");
  }

  return prisma.customModule.update({
    where: { id },
    data: {
      ...(data.labelSingular !== undefined ? { labelSingular: data.labelSingular.trim() } : {}),
      ...(data.labelPlural !== undefined ? { labelPlural: data.labelPlural.trim() } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.icon !== undefined ? { icon: data.icon || "box" } : {}),
      ...(data.priceFieldId !== undefined ? { priceFieldId: data.priceFieldId } : {}),
      ...(data.imageFieldId !== undefined ? { imageFieldId: data.imageFieldId } : {}),
      ...(data.codeFieldId !== undefined ? { codeFieldId: data.codeFieldId } : {}),
      ...(data.archived !== undefined ? { archivedAt: data.archived ? new Date() : null } : {}),
    },
  });
}

// Borrado definitivo: se lleva sus registros, campos, valores y relaciones
// (FK en cascada + limpieza de valores/etiquetas polimórficos). La UI lo
// pide confirmado y solo para módulos archivados.
export async function deleteModule(businessId: string, id: string) {
  const mod = await getModuleById(businessId, id);
  if (!mod) return false;
  const entityType = moduleEntityType(id);
  await removeImagesForValues(businessId, { moduleId: id });
  await removeFilesForValues(businessId, { moduleId: id });
  const records = await prisma.customRecord.findMany({ where: { businessId, moduleId: id }, select: { id: true } });
  const recordIds = records.map((r) => r.id);
  await prisma.$transaction([
    prisma.entityTag.deleteMany({ where: { businessId, entityType } }),
    // Relaciones desde OTROS módulos que apuntan a registros de este.
    prisma.recordLink.deleteMany({ where: { businessId, toType: entityType } }),
    prisma.customFieldValue.deleteMany({ where: { definition: { businessId, moduleId: id } } }),
    prisma.activity.deleteMany({ where: { businessId, relatedType: entityType, relatedId: { in: recordIds } } }),
    prisma.customModule.delete({ where: { id } }),
  ]);
  return true;
}
