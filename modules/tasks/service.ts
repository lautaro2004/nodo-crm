import { prisma } from "@/lib/prisma";

export interface CreateTaskInput {
  title: string;
  dueAt?: string | null;
  relatedType?: "lead" | "contact" | "company" | "opportunity" | null;
  relatedId?: string | null;
  ownerId?: string | null;
}
export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: "pending" | "done";
}

export async function createTask(businessId: string, data: CreateTaskInput) {
  return prisma.task.create({
    data: {
      businessId,
      title: data.title,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      relatedType: data.relatedType ?? null,
      relatedId: data.relatedId ?? null,
      ownerId: data.ownerId ?? null,
    },
  });
}

export async function listTasks(businessId: string) {
  return prisma.task.findMany({ where: { businessId }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] });
}

export async function getTask(businessId: string, id: string) {
  return prisma.task.findFirst({ where: { id, businessId } });
}

export async function updateTask(businessId: string, id: string, data: UpdateTaskInput) {
  const result = await prisma.task.updateMany({
    where: { id, businessId },
    data: { ...data, ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}) },
  });
  if (result.count === 0) return null;
  return getTask(businessId, id);
}

export async function completeTask(businessId: string, id: string) {
  const result = await prisma.task.updateMany({ where: { id, businessId }, data: { status: "done" } });
  return result.count > 0;
}

export async function reopenTask(businessId: string, id: string) {
  const result = await prisma.task.updateMany({ where: { id, businessId }, data: { status: "pending" } });
  return result.count > 0;
}

export async function deleteTask(businessId: string, id: string) {
  const result = await prisma.task.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
