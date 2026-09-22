import { prisma } from "@/lib/prisma";

export interface CreateNotificationInput {
  type: string;
  title: string;
  body: string;
  resourceHref?: string | null;
}

// Siempre por (businessId, userId) — la bandeja de cada miembro es propia,
// ver comentario del modelo en prisma/schema.prisma.
export async function createNotification(businessId: string, userId: string, input: CreateNotificationInput) {
  return prisma.notification.create({
    data: { businessId, userId, type: input.type, title: input.title, body: input.body, resourceHref: input.resourceHref ?? null },
  });
}

export async function listNotifications(businessId: string, userId: string, limit = 20) {
  return prisma.notification.findMany({ where: { businessId, userId }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function countUnread(businessId: string, userId: string) {
  return prisma.notification.count({ where: { businessId, userId, readAt: null } });
}

export async function markRead(businessId: string, userId: string, id: string) {
  const result = await prisma.notification.updateMany({ where: { id, businessId, userId, readAt: null }, data: { readAt: new Date() } });
  return result.count > 0;
}

export async function markAllRead(businessId: string, userId: string) {
  await prisma.notification.updateMany({ where: { businessId, userId, readAt: null }, data: { readAt: new Date() } });
}
