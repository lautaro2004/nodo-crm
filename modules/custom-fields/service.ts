import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULTABLE_TYPES,
  OPTION_TYPES,
  customValueFilterVariants,
  normalizeCustomValue,
  sanitizeValidation,
  splitMultiValue,
  validateCustomValue,
  type FieldValidation,
} from "@/lib/custom-fields";
import { MAX_FIELDS_PER_MODULE, moduleIdFromEntityType } from "@/lib/custom-modules";
import { removeImagesForValues } from "@/modules/records/images";
import { existingIds, parseIdList, setRelationLinks } from "@/modules/records/links";

export type CustomFieldEntityType = "lead" | "contact" | "company" | "opportunity" | "task" | `cm:${string}`;

/** Tipos cuyos valores NO viven en CustomFieldValue como texto libre. */
const STRUCTURED_TYPES = new Set(["relation", "image"]);

export interface CreateCustomFieldDefinitionInput {
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  order?: number;
  targetEntity?: string | null;
  multiple?: boolean;
  exclusive?: boolean;
  inverseLabel?: string | null;
  description?: string | null;
  defaultValue?: string | null;
  validation?: FieldValidation | null;
}

// Un módulo personalizado (o el destino de una relación) tiene que ser de
// ESTE negocio y no estar archivado. Devuelve el moduleId o lanza.
async function assertModuleOfBusiness(businessId: string, entityType: string): Promise<string | null> {
  const moduleId = moduleIdFromEntityType(entityType);
  if (!moduleId) return null;
  const mod = await prisma.customModule.findFirst({ where: { id: moduleId, businessId }, select: { id: true } });
  if (!mod) throw new Error("module_not_found");
  return mod.id;
}

/** Opciones sin vacíos ni duplicados (respeta el orden pedido). */
export function cleanOptions(options: string[] | undefined): string[] {
  const out: string[] = [];
  for (const o of options ?? []) {
    const v = o.trim();
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v.slice(0, 80));
  }
  return out;
}

/** Valida y normaliza el valor predeterminado contra el tipo/opciones/validaciones. */
function resolveDefaultValue(
  def: { type: string; label: string; options: string[]; validation: FieldValidation | null },
  raw: string | null | undefined
): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (!DEFAULTABLE_TYPES.has(def.type)) throw new Error("invalid_default");
  if (validateCustomValue({ type: def.type, options: def.options, label: def.label, validation: def.validation }, value)) throw new Error("invalid_default");
  return normalizeCustomValue(def.type, value);
}

function resolveValidation(type: string, input: FieldValidation | null | undefined): FieldValidation | null {
  const r = sanitizeValidation(type, input);
  if (!r.ok) throw new Error("invalid_validation");
  return r.value;
}

// Idempotente por (negocio, módulo, key): si ya existe un campo con esa
// clave y el MISMO tipo, se devuelve el existente (`existing: true`) en
// vez de fallar con un 500 o crear un duplicado — es el caso típico de
// reimportar el mismo archivo y volver a "crear" la columna. Con otro tipo
// es un conflicto real (`field_key_taken`): no se reinterpretan valores.
export async function createCustomFieldDefinition(businessId: string, data: CreateCustomFieldDefinitionInput) {
  const existing = await prisma.customFieldDefinition.findFirst({
    where: { businessId, entityType: data.entityType, key: data.key },
  });
  if (existing) {
    if (existing.type !== data.type) throw new Error("field_key_taken");
    return { ...existing, existing: true as const };
  }
  const moduleId = await assertModuleOfBusiness(businessId, data.entityType);
  if (moduleId && (await prisma.customFieldDefinition.count({ where: { moduleId } })) >= MAX_FIELDS_PER_MODULE) {
    throw new Error("too_many_fields");
  }
  let targetEntity: string | null = null;
  if (data.type === "relation") {
    if (!data.targetEntity) throw new Error("relation_target_required");
    await assertModuleOfBusiness(businessId, data.targetEntity);
    targetEntity = data.targetEntity;
  }
  const options = OPTION_TYPES.has(data.type) ? cleanOptions(data.options) : [];
  const validation = resolveValidation(data.type, data.validation);
  const defaultValue = resolveDefaultValue({ type: data.type, label: data.label, options, validation }, data.defaultValue);
  // Nuevo campo al final del orden (así no se "cuela" arriba de los que
  // el negocio ya ordenó).
  const last = await prisma.customFieldDefinition.findFirst({
    where: { businessId, entityType: data.entityType },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const created = await prisma.customFieldDefinition.create({
    data: {
      businessId,
      entityType: data.entityType,
      key: data.key,
      label: data.label,
      type: data.type,
      options,
      required: data.type === "image" ? false : (data.required ?? false),
      order: data.order ?? (last ? last.order + 1 : 0),
      moduleId,
      targetEntity,
      multiple: data.type === "relation" ? !!data.multiple : false,
      exclusive: data.type === "relation" ? !!data.exclusive : false,
      inverseLabel: data.type === "relation" ? data.inverseLabel?.trim() || null : null,
      description: data.description?.trim() || null,
      defaultValue,
      ...(validation ? { validation: validation as Prisma.InputJsonValue } : {}),
    },
  });
  return { ...created, existing: false as const };
}

export async function listCustomFieldDefinitions(businessId: string, entityType?: CustomFieldEntityType) {
  return prisma.customFieldDefinition.findMany({
    where: { businessId, ...(entityType ? { entityType } : {}) },
    orderBy: { order: "asc" },
  });
}

// ── Uso de opciones (para advertir antes de borrar/renombrar) ───────────

export interface OptionUsage {
  /** Registros con algún valor cargado en el campo. */
  total: number;
  /** opción → cantidad de registros que la tienen. */
  byOption: Record<string, number>;
  /** Valores cargados que NO están entre las opciones actuales (datos viejos/importados). */
  unlisted: Record<string, number>;
}

export async function getOptionUsage(businessId: string, id: string): Promise<OptionUsage | null> {
  const def = await prisma.customFieldDefinition.findFirst({ where: { id, businessId }, select: { id: true, type: true, options: true } });
  if (!def) return null;
  const values = await prisma.customFieldValue.findMany({ where: { definitionId: def.id, value: { not: null } }, select: { value: true } });
  const byOption: Record<string, number> = Object.fromEntries(def.options.map((o) => [o, 0]));
  const unlisted: Record<string, number> = {};
  for (const v of values) {
    const parts = def.type === "multiselect" ? splitMultiValue(v.value) : [v.value!.trim()];
    for (const p of parts) {
      if (!p) continue;
      if (p in byOption) byOption[p]++;
      else unlisted[p] = (unlisted[p] ?? 0) + 1;
    }
  }
  return { total: values.length, byOption, unlisted };
}

/** Error con detalle: hay registros que usan opciones que se quieren quitar. */
export class OptionInUseError extends Error {
  constructor(public usage: { option: string; count: number }[]) {
    super("option_in_use");
  }
}

/** Qué hacer con los registros que tienen una opción que se quita. */
export type RemovedOptionStrategy = { action: "keep" } | { action: "clear" } | { action: "replace"; replaceWith: string };

export interface UpdateCustomFieldDefinitionInput {
  label?: string;
  description?: string | null;
  options?: string[];
  /** Renombres de opciones existentes: los valores cargados se migran. */
  optionRenames?: { from: string; to: string }[];
  /** Estrategia por opción eliminada que está en uso (obligatoria si hay uso). */
  removedOptions?: Record<string, RemovedOptionStrategy>;
  defaultValue?: string | null;
  required?: boolean;
  validation?: FieldValidation | null;
  order?: number;
  multiple?: boolean;
  exclusive?: boolean;
  inverseLabel?: string | null;
}

function replaceInMulti(value: string, map: Map<string, string | null>) {
  const out: string[] = [];
  for (const p of splitMultiValue(value)) {
    const next = map.has(p) ? map.get(p)! : p;
    if (next && !out.includes(next)) out.push(next);
  }
  return out.length ? out.join(", ") : null;
}

/**
 * Edita una definición SIN perder datos:
 * - Renombrar una opción migra los valores ya cargados al nombre nuevo.
 * - Quitar una opción en uso exige elegir qué hacer con esos registros
 *   (conservar el valor histórico, vaciarlo o reemplazarlo por otra
 *   opción); sin estrategia se rechaza con el detalle de uso.
 * - Tipo, clave, módulo y destino de una relación no se cambian nunca.
 * - "Permite varios" → "a uno" y "exclusivo" solo si los datos lo permiten.
 * Todo en una transacción: o se aplica completo o nada.
 */
export async function updateCustomFieldDefinition(businessId: string, id: string, data: UpdateCustomFieldDefinitionInput) {
  const def = await prisma.customFieldDefinition.findFirst({ where: { id, businessId } });
  if (!def) return false;

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const update: Prisma.CustomFieldDefinitionUpdateInput = {};
  if (data.label !== undefined) update.label = data.label.trim();
  if (data.description !== undefined) update.description = data.description?.trim() || null;
  if (data.required !== undefined && def.type !== "image") update.required = data.required;
  if (data.order !== undefined) update.order = data.order;

  let options = def.options;
  if (OPTION_TYPES.has(def.type) && (data.options !== undefined || data.optionRenames?.length)) {
    options = cleanOptions(data.options ?? def.options);
    const renames = new Map<string, string>();
    for (const r of data.optionRenames ?? []) {
      const from = r.from.trim();
      const to = r.to.trim();
      if (!from || !to || from === to) continue;
      if (!def.options.includes(from)) throw new Error("invalid_option_rename");
      if (!options.includes(to)) throw new Error("invalid_option_rename");
      renames.set(from, to);
    }
    const removed = def.options.filter((o) => !options.includes(o) && !renames.has(o));
    const usage = removed.length || renames.size ? await getOptionUsage(businessId, id) : null;
    const inUse = removed.map((o) => ({ option: o, count: usage?.byOption[o] ?? 0 })).filter((u) => u.count > 0);
    const missing = inUse.filter((u) => !data.removedOptions?.[u.option]);
    if (missing.length) throw new OptionInUseError(missing);

    // Mapa final valor viejo → valor nuevo (null = vaciar). "keep" no toca.
    const map = new Map<string, string | null>(renames);
    for (const u of inUse) {
      const s = data.removedOptions![u.option];
      if (s.action === "clear") map.set(u.option, null);
      if (s.action === "replace") {
        if (!options.includes(s.replaceWith)) throw new Error("invalid_option_replacement");
        map.set(u.option, s.replaceWith);
      }
    }
    if (map.size) {
      if (def.type === "select") {
        for (const [from, to] of map) {
          ops.push(
            to === null
              ? prisma.customFieldValue.deleteMany({ where: { definitionId: id, value: from } })
              : prisma.customFieldValue.updateMany({ where: { definitionId: id, value: from }, data: { value: to } })
          );
        }
      } else {
        const rows = await prisma.customFieldValue.findMany({ where: { definitionId: id, value: { not: null } }, select: { id: true, value: true } });
        for (const row of rows) {
          const next = replaceInMulti(row.value!, map);
          if (next === row.value) continue;
          ops.push(next === null ? prisma.customFieldValue.delete({ where: { id: row.id } }) : prisma.customFieldValue.update({ where: { id: row.id }, data: { value: next } }));
        }
      }
    }
    update.options = options;
  }

  let validation = (def.validation as FieldValidation | null) ?? null;
  if (data.validation !== undefined) {
    validation = resolveValidation(def.type, data.validation);
    update.validation = validation ? (validation as Prisma.InputJsonValue) : Prisma.DbNull;
  }

  // El predeterminado se revalida contra las opciones/validaciones FINALES
  // (un default que apuntaba a una opción renombrada o borrada se ajusta).
  if (data.defaultValue !== undefined || update.options || data.validation !== undefined) {
    let candidate = data.defaultValue !== undefined ? data.defaultValue : def.defaultValue;
    if (candidate && data.optionRenames) candidate = data.optionRenames.find((r) => r.from === candidate)?.to ?? candidate;
    if (candidate && OPTION_TYPES.has(def.type)) {
      const parts = def.type === "multiselect" ? splitMultiValue(candidate) : [candidate];
      if (parts.some((p) => !options.includes(p))) candidate = data.defaultValue !== undefined ? candidate : null;
    }
    const label = (update.label as string | undefined) ?? def.label;
    update.defaultValue = resolveDefaultValue({ type: def.type, label, options, validation }, candidate);
  }

  if (def.type === "relation") {
    if (data.inverseLabel !== undefined) update.inverseLabel = data.inverseLabel?.trim() || null;
    if (data.multiple !== undefined && data.multiple !== def.multiple) {
      if (!data.multiple) {
        // Pasar a "a uno" con registros que ya tienen varios vínculos perdería datos.
        const multi = await prisma.recordLink.groupBy({ by: ["fromId"], where: { definitionId: id }, _count: { _all: true }, having: { fromId: { _count: { gt: 1 } } } });
        if (multi.length) throw new Error("relation_has_multiple");
      }
      update.multiple = data.multiple;
    }
    if (data.exclusive !== undefined && data.exclusive !== def.exclusive) {
      if (data.exclusive) {
        const shared = await prisma.recordLink.groupBy({ by: ["toId"], where: { definitionId: id }, _count: { _all: true }, having: { toId: { _count: { gt: 1 } } } });
        if (shared.length) throw new Error("relation_not_exclusive");
        ops.push(prisma.$executeRaw`UPDATE "crm"."RecordLink" SET "exclusiveTo" = "toId" WHERE "definitionId" = ${id}`);
      } else {
        ops.push(prisma.recordLink.updateMany({ where: { definitionId: id }, data: { exclusiveTo: null } }));
      }
      update.exclusive = data.exclusive;
    }
  }

  await prisma.$transaction([...ops, prisma.customFieldDefinition.update({ where: { id: def.id }, data: update })]);
  return true;
}

// Reordena los campos de UN módulo: solo toca definiciones de este negocio
// y de ese entityType (ids ajenos se ignoran).
export async function reorderCustomFieldDefinitions(businessId: string, entityType: CustomFieldEntityType, ids: string[]) {
  await prisma.$transaction(
    ids.map((id, order) => prisma.customFieldDefinition.updateMany({ where: { id, businessId, entityType }, data: { order } }))
  );
}

// Borra la definición Y sus valores — evita dejar CustomFieldValue
// huérfanos apuntando a una definición que ya no existe (la FK ya lo hace
// cumplir con CASCADE a nivel de base; esto solo lo hace explícito acá).
export async function deleteCustomFieldDefinition(businessId: string, id: string) {
  await removeImagesForValues(businessId, { definitionId: id });
  const result = await prisma.customFieldDefinition.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

// El registro tiene que existir en ESTE negocio y ser del módulo de la
// definición (un valor de "Rubro de lead" no se puede colgar de una
// empresa, ni de un lead de otro negocio). CustomFieldValue no guarda
// businessId: el aislamiento depende de este chequeo + el de la definición.
export async function entityBelongsToBusiness(businessId: string, entityType: string, entityId: string) {
  const where = { id: entityId, businessId };
  switch (entityType) {
    case "lead":
      return (await prisma.lead.count({ where })) > 0;
    case "contact":
      return (await prisma.contact.count({ where })) > 0;
    case "company":
      return (await prisma.company.count({ where })) > 0;
    case "opportunity":
      return (await prisma.opportunity.count({ where })) > 0;
    case "task":
      return (await prisma.task.count({ where })) > 0;
    default: {
      const moduleId = moduleIdFromEntityType(entityType);
      return moduleId ? (await prisma.customRecord.count({ where: { ...where, moduleId } })) > 0 : false;
    }
  }
}

export type SetCustomFieldValueResult =
  | { ok: true; value: string | null }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_value"; message: string };

type Definition = NonNullable<Awaited<ReturnType<typeof prisma.customFieldDefinition.findFirst>>>;

function typeInfo(d: Definition) {
  return { type: d.type, options: d.options, label: d.label, validation: (d.validation as FieldValidation | null) ?? null };
}

// Valida que la definición Y el registro pertenezcan al businessId ANTES
// de escribir — mismo criterio que assignTag: nunca confiar en ids
// enviados por el cliente. El valor se valida contra el tipo real de la
// definición y se guarda en forma canónica (ver lib/custom-fields.ts);
// vacío borra el valor (salvo que el campo sea obligatorio).
export async function setCustomFieldValue(
  businessId: string,
  definitionId: string,
  entityId: string,
  raw: string | null,
  options: { skipEntityCheck?: boolean; allowStructured?: boolean; skipRequired?: boolean } = {}
): Promise<SetCustomFieldValueResult> {
  const definition = await prisma.customFieldDefinition.findFirst({ where: { id: definitionId, businessId } });
  if (!definition) return { ok: false, error: "not_found" };
  // Relaciones (RecordLink) e imágenes (ruta en Storage) tienen su propio
  // flujo validado: nunca se escriben como texto libre desde el cliente.
  if (STRUCTURED_TYPES.has(definition.type) && !options.allowStructured) {
    return { ok: false, error: "invalid_value", message: `"${definition.label}" se edita con su propio control.` };
  }
  if (!options.skipEntityCheck && !(await entityBelongsToBusiness(businessId, definition.entityType, entityId))) {
    return { ok: false, error: "not_found" };
  }

  const message = validateCustomValue(typeInfo(definition), raw ?? "");
  if (message) return { ok: false, error: "invalid_value", message };

  const value = normalizeCustomValue(definition.type, raw);
  if (value === null) {
    if (definition.required && !options.skipRequired) return { ok: false, error: "invalid_value", message: `"${definition.label}" es obligatorio.` };
    await prisma.customFieldValue.deleteMany({ where: { definitionId, entityId } });
    return { ok: true, value: null };
  }
  await prisma.customFieldValue.upsert({
    where: { definitionId_entityId: { definitionId, entityId } },
    create: { definitionId, entityId, value },
    update: { value },
  });
  return { ok: true, value };
}

/** Errores por campo (definitionId → mensaje) para mostrarlos en el form. */
export class CustomValuesError extends Error {
  constructor(public fields: Record<string, string>) {
    super("invalid_value");
  }
}

/**
 * Varios valores de un registro de módulo ESTÁNDAR a la vez (alta/edición
 * desde los formularios, la API y las automatizaciones), en dos pasos:
 * `prepareCustomValues` valida TODO (tipos, opciones, validaciones,
 * obligatorios y que los registros de las relaciones existan) sin escribir
 * nada, y devuelve la función que escribe. Así un alta nunca crea el
 * registro con valores a medias. `creating` aplica obligatorios (si
 * `enforceRequired`) y valores predeterminados de los campos no enviados.
 */
export async function prepareCustomValues(
  businessId: string,
  entityType: CustomFieldEntityType,
  values: Record<string, string | null>,
  options: { creating?: boolean; enforceRequired?: boolean; recordId?: string } = {}
): Promise<(entityId: string) => Promise<void>> {
  const defs = await prisma.customFieldDefinition.findMany({ where: { businessId, entityType } });
  const byId = new Map(defs.map((d) => [d.id, d]));
  const errors: Record<string, string> = {};
  const toWrite: [Definition, string | null][] = [];
  for (const [id, raw] of Object.entries(values)) {
    const def = byId.get(id);
    if (!def) {
      errors[id] = "Ese campo no es de este módulo.";
      continue;
    }
    if (def.type === "image") continue;
    if (def.type === "relation") {
      const ids = parseIdList(raw);
      if (!def.multiple && ids.length > 1) errors[id] = `"${def.label}" admite un solo registro.`;
      else if (ids.length && def.targetEntity && (await existingIds(businessId, def.targetEntity, ids)).size !== ids.length) {
        errors[id] = `"${def.label}": alguno de los registros elegidos no existe.`;
      } else if (def.exclusive && ids.length) {
        const taken = await prisma.recordLink.count({ where: { definitionId: def.id, toId: { in: ids }, ...(options.recordId ? { fromId: { not: options.recordId } } : {}) } });
        if (taken) errors[id] = `"${def.label}": alguno de los registros elegidos ya está vinculado a otro.`;
      }
    } else {
      const message = validateCustomValue(typeInfo(def), raw ?? "");
      if (message) errors[id] = message;
    }
    toWrite.push([def, raw]);
  }
  if (options.creating) {
    for (const def of defs) {
      if (def.id in values || !def.defaultValue || def.type === "relation" || def.type === "image") continue;
      toWrite.push([def, def.defaultValue]);
    }
  }
  for (const def of defs) {
    if (!def.required || def.type === "image") continue;
    const provided = def.id in values;
    const empty = !(values[def.id] ?? "").trim();
    // Alta desde un formulario: todo obligatorio tiene que venir (o tener
    // predeterminado). Edición: no se puede vaciar un obligatorio.
    if (options.creating) {
      if (options.enforceRequired && empty && !(!provided && def.defaultValue)) errors[def.id] = `"${def.label}" es obligatorio.`;
    } else if (provided && empty && options.enforceRequired !== false) {
      errors[def.id] = `"${def.label}" es obligatorio.`;
    }
  }
  if (Object.keys(errors).length) throw new CustomValuesError(errors);

  return async (entityId: string) => {
    for (const [def, raw] of toWrite) {
      if (def.type === "relation") {
        await setRelationLinks(businessId, def, entityType, entityId, parseIdList(raw));
        continue;
      }
      const value = normalizeCustomValue(def.type, raw);
      if (value === null) await prisma.customFieldValue.deleteMany({ where: { definitionId: def.id, entityId } });
      else
        await prisma.customFieldValue.upsert({
          where: { definitionId_entityId: { definitionId: def.id, entityId } },
          create: { definitionId: def.id, entityId, value },
          update: { value },
        });
    }
  };
}

// Valores de varios registros a la vez, para las columnas de campos
// personalizados de las listas y el CSV: Map<entityId, Map<definitionId, valor>>.
// Las definiciones se filtran por negocio, así que nunca se leen valores
// de campos ajenos aunque lleguen ids arbitrarios.
export async function getCustomValuesForEntities(businessId: string, definitionIds: string[], entityIds: string[]) {
  const result = new Map<string, Map<string, string>>();
  if (definitionIds.length === 0 || entityIds.length === 0) return result;
  const values = await prisma.customFieldValue.findMany({
    where: { definitionId: { in: definitionIds }, entityId: { in: entityIds }, definition: { businessId } },
    select: { definitionId: true, entityId: true, value: true },
  });
  for (const v of values) {
    if (v.value === null) continue;
    if (!result.has(v.entityId)) result.set(v.entityId, new Map());
    result.get(v.entityId)!.set(v.definitionId, v.value);
  }
  return result;
}

export interface CustomFieldWithValue {
  definitionId: string;
  key: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
  description?: string | null;
  validation?: FieldValidation | null;
  targetEntity?: string | null;
  multiple?: boolean;
  value: string | null;
}

// Devuelve TODAS las definiciones del tipo de entidad, con el valor de
// ESTA entidad puntual si existe (o null) — así la UI siempre puede
// renderizar el formulario completo, tenga o no un valor cargado todavía.
// Las relaciones devuelven los ids vinculados separados por coma.
export async function getCustomFieldsForEntity(
  businessId: string,
  entityType: CustomFieldEntityType,
  entityId: string
): Promise<CustomFieldWithValue[]> {
  const definitions = await prisma.customFieldDefinition.findMany({
    where: { businessId, entityType },
    orderBy: { order: "asc" },
    include: { values: { where: { entityId } } },
  });
  const relationIds = definitions.filter((d) => d.type === "relation").map((d) => d.id);
  const links = relationIds.length
    ? await prisma.recordLink.findMany({ where: { businessId, definitionId: { in: relationIds }, fromId: entityId }, orderBy: { createdAt: "asc" }, select: { definitionId: true, toId: true } })
    : [];

  return definitions.map((d) => ({
    definitionId: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: d.options,
    required: d.required,
    description: d.description,
    validation: (d.validation as FieldValidation | null) ?? null,
    targetEntity: d.targetEntity,
    multiple: d.multiple,
    value:
      d.type === "relation"
        ? links.filter((l) => l.definitionId === d.id).map((l) => l.toId).join(",") || null
        : (d.values[0]?.value ?? null),
  }));
}

// Ids de registros cuyo campo personalizado coincide con el filtro de la
// lista. La definición tiene que ser de este negocio y de ese módulo: un id
// ajeno no matchea nada (devuelve vacío, nunca filtra "de más").
export async function entityIdsMatchingCustomFilter(
  businessId: string,
  entityType: CustomFieldEntityType,
  definitionId: string,
  input: string
): Promise<string[]> {
  const definition = await prisma.customFieldDefinition.findFirst({
    where: { id: definitionId, businessId, entityType },
    select: { type: true },
  });
  if (!definition) return [];
  const { equals, contains } = customValueFilterVariants(definition.type, input);
  const or = [
    ...(equals?.length ? [{ value: { in: equals, mode: "insensitive" as const } }] : []),
    ...contains.map((c) => ({ value: { contains: c, mode: "insensitive" as const } })),
  ];
  const values = await prisma.customFieldValue.findMany({
    where: { definitionId, OR: or },
    select: { entityId: true },
  });
  return values.map((v) => v.entityId);
}

/** Definiciones listas para el formulario de alta de un módulo (serializables). */
export async function customFieldsForForm(businessId: string, entityType: CustomFieldEntityType) {
  const defs = await prisma.customFieldDefinition.findMany({ where: { businessId, entityType, type: { not: "image" } }, orderBy: { order: "asc" } });
  return defs.map((d) => ({
    definitionId: d.id,
    label: d.label,
    type: d.type,
    options: d.options,
    required: d.required,
    description: d.description,
    defaultValue: d.defaultValue,
    targetEntity: d.targetEntity,
    multiple: d.multiple,
  }));
}
