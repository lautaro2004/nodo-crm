import { prisma } from "@/lib/prisma";
import { isModuleEntityType } from "@/lib/custom-modules";
import { removeImagesForValues } from "@/modules/records/images";

// CustomFieldValue, EntityTag y RecordLink son polimórficos (entityType + entityId,
// sin FK al registro): al borrar un lead/contacto/empresa/oportunidad/
// tarea la base NO los limpia sola. Se borran acá, siempre scopeados al
// negocio, para no dejar valores huérfanos que después aparezcan en
// filtros o exportaciones.
export async function cleanupDeletedRecord(businessId: string, entityType: string, entityId: string) {
  // Imágenes en Storage (solo existen en módulos personalizados).
  if (isModuleEntityType(entityType)) await removeImagesForValues(businessId, { entityId });
  await prisma.$transaction([
    prisma.customFieldValue.deleteMany({ where: { entityId, definition: { businessId, entityType } } }),
    prisma.entityTag.deleteMany({ where: { businessId, entityType, entityId } }),
    // Relaciones (RecordLink) en las que participa, desde o hacia el registro.
    prisma.recordLink.deleteMany({ where: { businessId, OR: [{ fromType: entityType, fromId: entityId }, { toType: entityType, toId: entityId }] } }),
  ]);
}
