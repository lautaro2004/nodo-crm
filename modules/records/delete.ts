import { prisma } from "@/lib/prisma";
import { isModuleEntityType, moduleIdFromEntityType } from "@/lib/custom-modules";
import { deleteLead } from "@/modules/leads/service";
import { deleteContact } from "@/modules/contacts/service";
import { deleteCompany } from "@/modules/companies/service";
import { deleteOpportunity } from "@/modules/opportunities/service";
import { deleteRecord } from "@/modules/custom-modules/records";

// Eliminación de uno o varios registros (selección múltiple y ficha).
//
// Reutiliza las funciones de borrado que ya usaban los endpoints DELETE de
// cada entidad (todas scopeadas por businessId + cleanupDeletedRecord), así
// que una baja masiva se comporta EXACTAMENTE igual que una individual.
//
// Política de integridad (sin cambios de esquema):
// - Lo PROPIO del registro se borra: valores de campos personalizados,
//   etiquetas, relaciones (RecordLink), imágenes, historial de actividad
//   (con sus recordatorios) y, en una oportunidad, sus ítems/productos.
// - Lo que REFERENCIA al registro desde otro registro se DESVINCULA (las FK
//   ya son ON DELETE SET NULL): contactos/leads/oportunidades de una
//   empresa, oportunidades/tareas de un contacto, tareas de un lead, etc.
//   Esos registros siguen existiendo.
// - Un producto (registro de módulo) usado en oportunidades NO cambia sus
//   montos: el ítem conserva el nombre y el precio guardados al agregarlo.
// Antes de confirmar, `getDeletionImpact` muestra todo esto con números.

export const MAX_BULK_DELETE = 500;

export type DeletableEntity = "lead" | "contact" | "company" | "opportunity" | `cm:${string}`;

export function isDeletableEntity(value: string): value is DeletableEntity {
  return ["lead", "contact", "company", "opportunity"].includes(value) || isModuleEntityType(value);
}

function deleterFor(entityType: DeletableEntity): (businessId: string, id: string) => Promise<boolean> {
  switch (entityType) {
    case "lead":
      return deleteLead;
    case "contact":
      return deleteContact;
    case "company":
      return deleteCompany;
    case "opportunity":
      return deleteOpportunity;
    default: {
      const moduleId = moduleIdFromEntityType(entityType)!;
      return (businessId, id) => deleteRecord(businessId, moduleId, id);
    }
  }
}

export interface DeleteRecordsResult {
  /** Ids efectivamente borrados. */
  deleted: string[];
  /** No existían en este negocio (otro los borró antes, o no son de este negocio). */
  notFound: string[];
  /** Fallaron por un error inesperado (siguen existiendo). */
  failed: string[];
}

export async function deleteRecords(businessId: string, entityType: DeletableEntity, ids: string[]): Promise<DeleteRecordsResult> {
  const unique = Array.from(new Set(ids)).slice(0, MAX_BULK_DELETE);
  const remove = deleterFor(entityType);
  const result: DeleteRecordsResult = { deleted: [], notFound: [], failed: [] };
  // De a uno, a propósito: cada borrado es atómico con su limpieza y un
  // error en un registro no deja a los demás a medias.
  for (const id of unique) {
    try {
      if (await remove(businessId, id)) result.deleted.push(id);
      else result.notFound.push(id);
    } catch (error) {
      console.error(`[records/delete] No se pudo borrar ${entityType} ${id}:`, error instanceof Error ? error.message : error);
      result.failed.push(id);
    }
  }
  return result;
}

export interface DeletionImpactItem {
  /** Texto para la confirmación, ej. "3 contactos quedan sin empresa". */
  label: string;
  count: number;
}

export interface DeletionImpact {
  /** Cuántos de los ids pedidos existen en este negocio. */
  found: number;
  /** Registros relacionados que se desvinculan (siguen existiendo). */
  unlinked: DeletionImpactItem[];
  /** Datos propios que se borran junto con el registro. */
  removed: DeletionImpactItem[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function getDeletionImpact(businessId: string, entityType: DeletableEntity, ids: string[]): Promise<DeletionImpact> {
  const unique = Array.from(new Set(ids)).slice(0, MAX_BULK_DELETE);
  const inIds = { in: unique };
  const unlinked: DeletionImpactItem[] = [];
  const removed: DeletionImpactItem[] = [];
  let found = 0;

  if (entityType === "company") {
    const [n, contacts, leads, opportunities] = await Promise.all([
      prisma.company.count({ where: { businessId, id: inIds } }),
      prisma.contact.count({ where: { businessId, companyId: inIds } }),
      prisma.lead.count({ where: { businessId, companyId: inIds } }),
      prisma.opportunity.count({ where: { businessId, companyId: inIds } }),
    ]);
    found = n;
    if (contacts) unlinked.push({ count: contacts, label: `${plural(contacts, "contacto queda", "contactos quedan")} sin empresa` });
    if (leads) unlinked.push({ count: leads, label: `${plural(leads, "lead queda", "leads quedan")} sin empresa` });
    if (opportunities) unlinked.push({ count: opportunities, label: `${plural(opportunities, "oportunidad queda", "oportunidades quedan")} sin empresa` });
  } else if (entityType === "contact") {
    const [n, opportunities, tasks, leads] = await Promise.all([
      prisma.contact.count({ where: { businessId, id: inIds } }),
      prisma.opportunity.count({ where: { businessId, contactId: inIds } }),
      prisma.task.count({ where: { businessId, contactId: inIds } }),
      prisma.lead.count({ where: { businessId, convertedContactId: inIds } }),
    ]);
    found = n;
    if (opportunities) unlinked.push({ count: opportunities, label: `${plural(opportunities, "oportunidad queda", "oportunidades quedan")} sin contacto` });
    if (tasks) unlinked.push({ count: tasks, label: `${plural(tasks, "tarea queda", "tareas quedan")} sin contacto` });
    if (leads) unlinked.push({ count: leads, label: `${plural(leads, "lead convertido pierde", "leads convertidos pierden")} el vínculo con el contacto` });
  } else if (entityType === "lead") {
    const [n, tasks] = await Promise.all([
      prisma.lead.count({ where: { businessId, id: inIds } }),
      prisma.task.count({ where: { businessId, leadId: inIds } }),
    ]);
    found = n;
    if (tasks) unlinked.push({ count: tasks, label: `${plural(tasks, "tarea queda", "tareas quedan")} sin lead` });
  } else if (entityType === "opportunity") {
    const [n, tasks, items] = await Promise.all([
      prisma.opportunity.count({ where: { businessId, id: inIds } }),
      prisma.task.count({ where: { businessId, opportunityId: inIds } }),
      prisma.opportunityItem.count({ where: { businessId, opportunityId: inIds } }),
    ]);
    found = n;
    if (tasks) unlinked.push({ count: tasks, label: `${plural(tasks, "tarea queda", "tareas quedan")} sin oportunidad` });
    if (items) removed.push({ count: items, label: plural(items, "producto o ítem cargado", "productos o ítems cargados") });
  } else {
    const moduleId = moduleIdFromEntityType(entityType)!;
    const [n, items] = await Promise.all([
      prisma.customRecord.count({ where: { businessId, moduleId, id: inIds } }),
      prisma.opportunityItem.count({ where: { businessId, recordId: inIds } }),
    ]);
    found = n;
    if (items) unlinked.push({ count: items, label: `${plural(items, "ítem de oportunidad conserva", "ítems de oportunidades conservan")} su nombre y precio, sin vínculo al registro` });
  }

  const [activities, links] = await Promise.all([
    prisma.activity.count({ where: { businessId, relatedType: entityType, relatedId: inIds } }),
    prisma.recordLink.count({
      where: { businessId, OR: [{ fromType: entityType, fromId: inIds }, { toType: entityType, toId: inIds }] },
    }),
  ]);
  if (activities) removed.push({ count: activities, label: `${plural(activities, "actividad", "actividades")} del historial` });
  if (links) removed.push({ count: links, label: plural(links, "relación con otros registros", "relaciones con otros registros") });

  return { found, unlinked, removed };
}
