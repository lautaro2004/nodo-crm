import { prisma } from "@/lib/prisma";

export type StatusEntityType = "lead" | "company";

export interface CreateStatusDefinitionInput {
  entityType: StatusEntityType;
  key: string;
  label: string;
  color?: string | null;
  order?: number;
  isDefault?: boolean;
}

export async function createStatusDefinition(businessId: string, data: CreateStatusDefinitionInput) {
  return prisma.statusDefinition.create({
    data: {
      businessId,
      entityType: data.entityType,
      key: data.key,
      label: data.label,
      color: data.color ?? null,
      order: data.order ?? 0,
      isDefault: data.isDefault ?? false,
    },
  });
}

export async function listStatusDefinitions(businessId: string, entityType?: StatusEntityType) {
  return prisma.statusDefinition.findMany({
    where: { businessId, ...(entityType ? { entityType } : {}) },
    orderBy: { order: "asc" },
  });
}

export async function updateStatusDefinition(
  businessId: string,
  id: string,
  data: Partial<Omit<CreateStatusDefinitionInput, "entityType" | "key">>
) {
  const result = await prisma.statusDefinition.updateMany({ where: { id, businessId }, data });
  return result.count > 0;
}

export async function deleteStatusDefinition(businessId: string, id: string) {
  const result = await prisma.statusDefinition.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
