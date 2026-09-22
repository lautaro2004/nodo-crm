import { prisma } from "@/lib/prisma";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { createNotification } from "@/modules/notifications/service";

export const REMINDER_STATUSES = ["pending", "sent", "cancelled"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export interface CreateReminderInput {
  userId: string;
  taskId?: string | null;
  activityId?: string | null;
  remindAt: string;
}

function parseRemindAt(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("invalid_date");
  return d;
}

// Exactamente una de las dos referencias — ver comentario del modelo.
// Ambas se validan contra el MISMO businessId (nunca se confía en un id
// recibido del cliente), igual que el responsable.
async function assertTarget(businessId: string, input: Pick<CreateReminderInput, "taskId" | "activityId">) {
  const hasTask = !!input.taskId;
  const hasActivity = !!input.activityId;
  if (hasTask === hasActivity) throw new Error("target_required");

  if (hasTask) {
    const task = await prisma.task.findFirst({ where: { id: input.taskId!, businessId }, select: { id: true } });
    if (!task) throw new Error("task_not_found");
  } else {
    const activity = await prisma.activity.findFirst({ where: { id: input.activityId!, businessId }, select: { id: true } });
    if (!activity) throw new Error("activity_not_found");
  }
}

export async function createReminder(businessId: string, input: CreateReminderInput) {
  const remindAt = parseRemindAt(input.remindAt);
  await assertTarget(businessId, input);
  await assertUserBelongsToBusiness(businessId, input.userId);

  return prisma.reminder.create({
    data: { businessId, userId: input.userId, taskId: input.taskId ?? null, activityId: input.activityId ?? null, remindAt },
  });
}

// Sólo se puede editar mientras está pending (uno ya enviado/cancelado es
// historia, no se "reabre").
export async function updateReminder(businessId: string, id: string, remindAtInput: string) {
  const remindAt = parseRemindAt(remindAtInput);
  const result = await prisma.reminder.updateMany({ where: { id, businessId, status: "pending" }, data: { remindAt } });
  if (result.count === 0) return null;
  return prisma.reminder.findFirst({ where: { id, businessId } });
}

export async function cancelReminder(businessId: string, id: string) {
  const result = await prisma.reminder.updateMany({ where: { id, businessId, status: "pending" }, data: { status: "cancelled" } });
  return result.count > 0;
}

export async function deleteReminder(businessId: string, id: string) {
  const result = await prisma.reminder.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

export async function getReminderForTask(businessId: string, taskId: string) {
  return prisma.reminder.findFirst({ where: { businessId, taskId, status: "pending" }, orderBy: { createdAt: "desc" } });
}

// Flujo de "Recordarme" desde el formulario de Task: un único recordatorio
// pending por tarea. Si ya hay uno, se reprograma en vez de duplicar.
export async function upsertTaskReminder(businessId: string, taskId: string, userId: string, remindAtInput: string) {
  const remindAt = parseRemindAt(remindAtInput);
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId }, select: { id: true } });
  if (!task) throw new Error("task_not_found");
  await assertUserBelongsToBusiness(businessId, userId);

  const existing = await prisma.reminder.findFirst({ where: { businessId, taskId, status: "pending" } });
  if (existing) return prisma.reminder.update({ where: { id: existing.id }, data: { remindAt, userId } });
  return prisma.reminder.create({ data: { businessId, taskId, userId, remindAt } });
}

const REMINDER_BATCH_SIZE = 200;

// Barrido global (todas las empresas) invocado por un scheduler externo
// protegido con CRON_SECRET — mismo patrón que nexo/app/api/cron/*. No usa
// setInterval: en serverless el proceso no vive entre requests.
//
// Idempotencia/concurrencia: el "claim" es un único UPDATE condicionado a
// status = 'pending' (mismo guard atómico que
// modules/leads/conversion.ts, `updateMany ... WHERE convertedAt IS
// NULL`). Si dos invocaciones del cron corren en simultáneo, sólo una
// logra pasar count === 1 para un recordatorio dado; la otra lo encuentra
// ya en 'sent' y no hace nada. No hace falta un lock explícito.
export async function processDueReminders(now: Date = new Date()) {
  const due = await prisma.reminder.findMany({
    where: { status: "pending", remindAt: { lte: now } },
    include: {
      task: { select: { id: true, title: true, dueAt: true } },
      activity: { select: { id: true, type: true, body: true, relatedType: true, relatedId: true } },
    },
    orderBy: { remindAt: "asc" },
    take: REMINDER_BATCH_SIZE,
  });

  let sent = 0;
  let skipped = 0;

  for (const reminder of due) {
    const claim = await prisma.reminder.updateMany({ where: { id: reminder.id, status: "pending" }, data: { status: "sent" } });
    if (claim.count === 0) {
      skipped++;
      continue;
    }

    const { title, body, resourceHref } = describeReminder(reminder);
    await createNotification(reminder.businessId, reminder.userId, { type: "reminder", title, body, resourceHref });
    sent++;
  }

  return { found: due.length, sent, skipped };
}

function describeReminder(reminder: {
  remindAt: Date;
  task: { id: string; title: string } | null;
  activity: { id: string; relatedType: string; relatedId: string; type: string; body: string | null } | null;
}) {
  const time = reminder.remindAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  if (reminder.task) {
    return {
      title: reminder.task.title,
      body: `Recordatorio programado para las ${time}.`,
      resourceHref: `/dashboard/tareas/${reminder.task.id}`,
    };
  }
  const activity = reminder.activity!;
  return {
    title: "Recordatorio",
    body: `Recordatorio programado para las ${time}.`,
    resourceHref: `/dashboard/${ENTITY_BASE[activity.relatedType] ?? ""}/${activity.relatedId}`,
  };
}

const ENTITY_BASE: Record<string, string> = {
  company: "empresas",
  contact: "contactos",
  lead: "leads",
  opportunity: "oportunidades",
  task: "tareas",
};
