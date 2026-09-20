import { prisma } from "@/lib/prisma";

export type TaggableType = "lead" | "contact" | "company" | "opportunity" | "task";

export async function createTag(businessId: string, data: { name: string; color?: string | null }) {
  return prisma.tag.create({ data: { businessId, name: data.name, color: data.color ?? null } });
}

export async function listTags(businessId: string) {
  return prisma.tag.findMany({ where: { businessId }, orderBy: { name: "asc" } });
}

export async function deleteTag(businessId: string, id: string) {
  const result = await prisma.tag.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

// assignTag valida que el Tag pertenezca al mismo businessId ANTES de
// crear la asociación — evita que alguien etiquete una entidad propia con
// un tagId robado/adivinado de otro Workspace.
export async function assignTag(businessId: string, tagId: string, entityType: TaggableType, entityId: string) {
  const tag = await prisma.tag.findFirst({ where: { id: tagId, businessId } });
  if (!tag) return null;

  return prisma.entityTag.upsert({
    where: { tagId_entityType_entityId: { tagId, entityType, entityId } },
    create: { businessId, tagId, entityType, entityId },
    update: {},
  });
}

export async function unassignTag(businessId: string, tagId: string, entityType: TaggableType, entityId: string) {
  const result = await prisma.entityTag.deleteMany({ where: { businessId, tagId, entityType, entityId } });
  return result.count > 0;
}

export async function listTagsForEntity(businessId: string, entityType: TaggableType, entityId: string) {
  const links = await prisma.entityTag.findMany({
    where: { businessId, entityType, entityId },
    include: { tag: true },
  });
  return links.map((l) => l.tag);
}

export async function listEntityIdsForTag(businessId: string, tagId: string, entityType: TaggableType) {
  const links = await prisma.entityTag.findMany({ where: { businessId, tagId, entityType }, select: { entityId: true } });
  return links.map((l) => l.entityId);
}
