import { prisma } from "@/lib/prisma";
import { isModuleEntityType } from "@/lib/custom-modules";
import { removeImagesForValues } from "@/modules/records/images";

// CustomFieldValue, EntityTag, RecordLink y Activity son polimórficos (entityType + entityId,
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
    // Historial propio del registro (notas, llamadas, "Lead creado"…). Sin el
    // registro quedaba huérfano y el feed global de Actividades mostraba
    // links a una ficha inexistente. Sus recordatorios se borran por FK.
    prisma.activity.deleteMany({ where: { businessId, relatedType: entityType, relatedId: entityId } }),
  ]);
}
