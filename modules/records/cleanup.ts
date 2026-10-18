import { prisma } from "@/lib/prisma";

// CustomFieldValue y EntityTag son polimórficos (entityType + entityId,
// sin FK al registro): al borrar un lead/contacto/empresa/oportunidad/
// tarea la base NO los limpia sola. Se borran acá, siempre scopeados al
// negocio, para no dejar valores huérfanos que después aparezcan en
// filtros o exportaciones.
export async function cleanupDeletedRecord(businessId: string, entityType: string, entityId: string) {
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany({ where: { entityId, definition: { businessId, entityType } } }),
    prisma.entityTag.deleteMany({ where: { businessId, entityType, entityId } }),
  ]);
}
