import { prisma } from "@/lib/prisma";
import { moduleIdFromEntityType } from "@/lib/custom-modules";

// Responsable/creador de UN registro, scopeado al negocio, para chequear
// el alcance de permisos (todos / equipo / propios). null = no existe en
// este negocio.
export async function loadRecordOwnership(
  businessId: string,
  entityType: string,
  id: string
): Promise<{ ownerId: string | null; createdById?: string | null } | null> {
  const where = { id, businessId };
  const owner = { ownerId: true } as const;
  switch (entityType) {
    case "lead":
      return prisma.lead.findFirst({ where, select: owner });
    case "contact":
      return prisma.contact.findFirst({ where, select: owner });
    case "company":
      return prisma.company.findFirst({ where, select: owner });
    case "opportunity":
      return prisma.opportunity.findFirst({ where, select: owner });
    case "task":
      return prisma.task.findFirst({ where, select: { ownerId: true, createdById: true } });
    case "calendar":
      return prisma.calendarEvent.findFirst({ where, select: { ownerId: true, createdById: true } });
    default: {
      const moduleId = moduleIdFromEntityType(entityType);
      if (!moduleId) return null;
      return prisma.customRecord.findFirst({ where: { ...where, moduleId }, select: { ownerId: true, createdById: true } });
    }
  }
}
