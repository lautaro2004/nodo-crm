import { prisma } from "@/lib/prisma";

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

export async function createCustomFieldDefinition(businessId: string, data: CreateCustomFieldDefinitionInput) {
  return prisma.customFieldDefinition.create({
    data: {
      businessId,
      entityType: data.entityType,
      key: data.key,
      label: data.label,
      type: data.type,
      options: data.options ?? [],
      required: data.required ?? false,
      order: data.order ?? 0,
    },
  });
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

// Valida que la definición pertenezca al mismo businessId ANTES de
// escribir el valor — mismo criterio que assignTag: nunca confiar en que
// un definitionId enviado por el cliente sea del Workspace correcto.
export async function setCustomFieldValue(businessId: string, definitionId: string, entityId: string, value: string | null) {
  const definition = await prisma.customFieldDefinition.findFirst({ where: { id: definitionId, businessId } });
  if (!definition) return null;

  return prisma.customFieldValue.upsert({
    where: { definitionId_entityId: { definitionId, entityId } },
    create: { definitionId, entityId, value },
    update: { value },
  });
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
