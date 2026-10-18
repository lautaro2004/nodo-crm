import { prisma } from "@/lib/prisma";
import { customValueFilterVariants, normalizeCustomValue, validateCustomValue } from "@/lib/custom-fields";

export type CustomFieldEntityType = "lead" | "contact" | "company" | "opportunity" | "task";

export interface CreateCustomFieldDefinitionInput {
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
  order?: number;
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
      options: data.options ?? [],
      required: data.required ?? false,
      order: data.order ?? (last ? last.order + 1 : 0),
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

export async function updateCustomFieldDefinition(
  businessId: string,
  id: string,
  data: Partial<Omit<CreateCustomFieldDefinitionInput, "entityType" | "key">>
) {
  const result = await prisma.customFieldDefinition.updateMany({ where: { id, businessId }, data });
  return result.count > 0;
}

// Borra la definición Y sus valores — evita dejar CustomFieldValue
// huérfanos apuntando a una definición que ya no existe (la FK ya lo hace
// cumplir con CASCADE a nivel de base; esto solo lo hace explícito acá).
export async function deleteCustomFieldDefinition(businessId: string, id: string) {
  const result = await prisma.customFieldDefinition.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

// El registro tiene que existir en ESTE negocio y ser del módulo de la
// definición (un valor de "Rubro de lead" no se puede colgar de una
// empresa, ni de un lead de otro negocio). CustomFieldValue no guarda
// businessId: el aislamiento depende de este chequeo + el de la definición.
async function entityBelongsToBusiness(businessId: string, entityType: string, entityId: string) {
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
    default:
      return false;
  }
}

export type SetCustomFieldValueResult =
  | { ok: true; value: string | null }
  | { ok: false; error: "not_found" }
  | { ok: false; error: "invalid_value"; message: string };

// Valida que la definición Y el registro pertenezcan al businessId ANTES
// de escribir — mismo criterio que assignTag: nunca confiar en ids
// enviados por el cliente. El valor se valida contra el tipo real de la
// definición y se guarda en forma canónica (ver lib/custom-fields.ts);
// vacío borra el valor.
export async function setCustomFieldValue(
  businessId: string,
  definitionId: string,
  entityId: string,
  raw: string | null,
  options: { skipEntityCheck?: boolean } = {}
): Promise<SetCustomFieldValueResult> {
  const definition = await prisma.customFieldDefinition.findFirst({ where: { id: definitionId, businessId } });
  if (!definition) return { ok: false, error: "not_found" };
  if (!options.skipEntityCheck && !(await entityBelongsToBusiness(businessId, definition.entityType, entityId))) {
    return { ok: false, error: "not_found" };
  }

  const message = validateCustomValue({ type: definition.type, options: definition.options, label: definition.label }, raw ?? "");
  if (message) return { ok: false, error: "invalid_value", message };

  const value = normalizeCustomValue(definition.type, raw);
  if (value === null) {
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
  value: string | null;
}

// Devuelve TODAS las definiciones del tipo de entidad, con el valor de
// ESTA entidad puntual si existe (o null) — así la UI siempre puede
// renderizar el formulario completo, tenga o no un valor cargado todavía.
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

  return definitions.map((d) => ({
    definitionId: d.id,
    key: d.key,
    label: d.label,
    type: d.type,
    options: d.options,
    required: d.required,
    value: d.values[0]?.value ?? null,
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
