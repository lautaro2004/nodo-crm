import { prisma } from "@/lib/prisma";
import { createActivity } from "@/modules/activities/service";
import { assertUserBelongsToBusiness } from "@/modules/business/members";

export const TASK_STATUSES = ["todo", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  startDate?: string | null;
  dueAt?: string | null;
  ownerId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
}
export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  status?: TaskStatus;
}

// Valida que cada relación (owner + las 4 entidades CRM) pertenezca al
// MISMO businessId antes de guardar — nunca se confía en un id recibido
// del cliente. Mismo criterio que assertBelongsToBusiness en
// modules/opportunities/service.ts.
async function assertRelationsBelongToBusiness(
  businessId: string,
  input: { ownerId?: string | null; companyId?: string | null; contactId?: string | null; leadId?: string | null; opportunityId?: string | null }
) {
  if (input.ownerId) await assertUserBelongsToBusiness(businessId, input.ownerId);
  if (input.companyId) {
    const c = await prisma.company.findFirst({ where: { id: input.companyId, businessId }, select: { id: true } });
    if (!c) throw new Error("company_not_found");
  }
  if (input.contactId) {
    const c = await prisma.contact.findFirst({ where: { id: input.contactId, businessId }, select: { id: true } });
    if (!c) throw new Error("contact_not_found");
  }
  if (input.leadId) {
    const l = await prisma.lead.findFirst({ where: { id: input.leadId, businessId }, select: { id: true } });
    if (!l) throw new Error("lead_not_found");
  }
  if (input.opportunityId) {
    const o = await prisma.opportunity.findFirst({ where: { id: input.opportunityId, businessId }, select: { id: true } });
    if (!o) throw new Error("opportunity_not_found");
  }
}

export async function createTask(businessId: string, data: CreateTaskInput, createdById: string | null) {
  await assertRelationsBelongToBusiness(businessId, data);

  const task = await prisma.task.create({
    data: {
      businessId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? "medium",
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      ownerId: data.ownerId ?? null,
      createdById,
      companyId: data.companyId ?? null,
      contactId: data.contactId ?? null,
      leadId: data.leadId ?? null,
      opportunityId: data.opportunityId ?? null,
    },
  });

  await createActivity(businessId, { relatedType: "task", relatedId: task.id, type: "note", body: "Tarea creada" });
  if (data.ownerId) {
    await createActivity(businessId, { relatedType: "task", relatedId: task.id, type: "assigned", ownerId: createdById });
  }

  return task;
}

const INCLUDE_RELATIONS = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
  attachments: true,
} as const;

export interface ListTasksFilters {
  ownerId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  view?: "all" | "mine" | "overdue" | "today" | "upcoming" | "completed";
  currentUserId?: string; // requerido cuando view === "mine"
}

export async function listTasks(businessId: string, filters: ListTasksFilters = {}) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const viewWhere = (() => {
    switch (filters.view) {
      case "mine":
        return filters.currentUserId ? { ownerId: filters.currentUserId } : {};
      case "overdue":
        return { status: { notIn: ["completed", "cancelled"] }, dueAt: { lt: startOfToday } };
      case "today":
        return { status: { notIn: ["completed", "cancelled"] }, dueAt: { gte: startOfToday, lt: startOfTomorrow } };
      case "upcoming":
        return { status: { notIn: ["completed", "cancelled"] }, dueAt: { gte: startOfTomorrow } };
      case "completed":
        return { status: "completed" };
      default:
        return {};
    }
  })();

  return prisma.task.findMany({
    where: {
      businessId,
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" as const } },
              { description: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...viewWhere,
    },
    include: INCLUDE_RELATIONS,
    orderBy: [{ status: "asc" }, { dueAt: "asc" }],
  });
}

export async function getTask(businessId: string, id: string) {
  return prisma.task.findFirst({ where: { id, businessId }, include: INCLUDE_RELATIONS });
}

export async function updateTask(businessId: string, id: string, data: UpdateTaskInput, actorUserId: string | null) {
  await assertRelationsBelongToBusiness(businessId, data);

  const current = await prisma.task.findFirst({ where: { id, businessId } });
  if (!current) return null;

  const statusChangingToCompleted = data.status === "completed" && current.status !== "completed";
  const statusReopening = data.status && data.status !== "completed" && current.status === "completed";

  const updated = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}),
      ...(statusChangingToCompleted ? { completedAt: new Date() } : {}),
      ...(statusReopening ? { completedAt: null } : {}),
    },
  });

  if (data.ownerId !== undefined && data.ownerId !== current.ownerId) {
    await createActivity(businessId, { relatedType: "task", relatedId: id, type: "assigned", ownerId: actorUserId });
  }
  if (data.priority && data.priority !== current.priority) {
    await createActivity(businessId, {
      relatedType: "task",
      relatedId: id,
      type: "priority_changed",
      body: `${current.priority} → ${data.priority}`,
      ownerId: actorUserId,
    });
  }
  if (data.dueAt !== undefined && data.dueAt !== (current.dueAt?.toISOString() ?? null)) {
    await createActivity(businessId, { relatedType: "task", relatedId: id, type: "due_date_changed", ownerId: actorUserId });
  }
  if (statusChangingToCompleted) {
    await createActivity(businessId, { relatedType: "task", relatedId: id, type: "status_change", body: "Completada", ownerId: actorUserId });
  } else if (statusReopening) {
    await createActivity(businessId, { relatedType: "task", relatedId: id, type: "status_change", body: "Reabierta", ownerId: actorUserId });
  } else if (data.status && data.status !== current.status) {
    await createActivity(businessId, {
      relatedType: "task",
      relatedId: id,
      type: "status_change",
      body: `${current.status} → ${data.status}`,
      ownerId: actorUserId,
    });
  }

  return updated;
}

export async function completeTask(businessId: string, id: string, actorUserId: string | null) {
  return updateTask(businessId, id, { status: "completed" }, actorUserId);
}

export async function reopenTask(businessId: string, id: string, actorUserId: string | null) {
  return updateTask(businessId, id, { status: "todo" }, actorUserId);
}

export async function deleteTask(businessId: string, id: string) {
  const result = await prisma.task.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

// Comentario = Activity de tipo "comment" — ver la nota en
// modules/activities/service.ts. Valida que la tarea pertenezca al
// negocio antes de escribir.
export async function addTaskComment(businessId: string, taskId: string, body: string, authorId: string | null) {
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId }, select: { id: true } });
  if (!task) return null;

  return createActivity(businessId, { relatedType: "task", relatedId: taskId, type: "comment", body, ownerId: authorId });
}
