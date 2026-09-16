import { prisma } from "@/lib/prisma";

export type RelatedType = "lead" | "contact" | "company" | "opportunity";
export type ActivityType = "note" | "call" | "email" | "meeting" | "stage_change" | "status_change";

export interface CreateActivityInput {
  relatedType: RelatedType;
  relatedId: string;
  type: ActivityType;
  body?: string | null;
  ownerId?: string | null;
}

// Único punto de escritura de Activity — tanto una nota manual como un
// cambio de etapa/estado disparado por otro módulo (ver
// modules/opportunities/service.ts, modules/leads/service.ts) pasan por
// acá, nunca por un create() directo repetido en cada lugar.
export async function createActivity(businessId: string, input: CreateActivityInput) {
  return prisma.activity.create({
    data: {
      businessId,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      type: input.type,
      body: input.body ?? null,
      ownerId: input.ownerId ?? null,
    },
  });
}

export async function listActivitiesForEntity(businessId: string, relatedType: RelatedType, relatedId: string) {
  return prisma.activity.findMany({
    where: { businessId, relatedType, relatedId },
    orderBy: { createdAt: "desc" },
  });
}

export async function listRecentActivities(businessId: string, limit = 20) {
  return prisma.activity.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
