import { prisma } from "@/lib/prisma";
import { createEvent, deleteEvent, updateEvent } from "@/modules/calendar/service";

// "Agregar a Google Calendar" para UNA tarea, por acción explícita del usuario.
// Nunca se convierten todas las tareas en eventos ni se sincronizan solas.
// La tarea se vincula a su evento con CalendarEvent (provider "google",
// googleEventId, taskId): sirve para reconocerlo, actualizarlo y eliminarlo, y
// evita duplicados (un usuario tiene como máximo UN evento de Google por tarea).

const DEFAULT_DURATION_MS = 30 * 60 * 1000;

// La tarea siempre se busca dentro del negocio del usuario autenticado, y el
// evento se crea en el calendario del PROPIO usuario (userId de la sesión).
async function getTask(businessId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, businessId } });
  if (!task) throw new Error("task_not_found");
  return task;
}

function findLinkedEvent(businessId: string, userId: string, taskId: string) {
  return prisma.calendarEvent.findFirst({ where: { businessId, taskId, provider: "google", googleUserId: userId } });
}

export async function getTaskGoogleLink(businessId: string, userId: string, taskId: string) {
  await getTask(businessId, taskId);
  const event = await findLinkedEvent(businessId, userId, taskId);
  return { linked: !!event, eventId: event?.id ?? null };
}

export async function addTaskToGoogleCalendar(businessId: string, userId: string, taskId: string) {
  const task = await getTask(businessId, taskId);
  if (!task.dueAt) throw new Error("task_without_due_date");

  const fields = {
    title: task.title,
    description: task.description,
    startsAt: task.dueAt.toISOString(),
    endsAt: new Date(task.dueAt.getTime() + DEFAULT_DURATION_MS).toISOString(),
  };

  // Ya vinculada: se actualiza el evento existente (no se crea otro).
  const existing = await findLinkedEvent(businessId, userId, taskId);
  if (existing) {
    const updated = await updateEvent(businessId, existing.id, fields, userId);
    if (updated && updated.provider === "google") return { event: updated, created: false };
    // El evento fue borrado directamente en Google: se descarta el vínculo viejo y se recrea.
    if (updated) await deleteEvent(businessId, updated.id, userId);
  }

  const event = await createEvent(
    businessId,
    {
      ...fields,
      type: "follow_up",
      ownerId: task.ownerId,
      companyId: task.companyId,
      contactId: task.contactId,
      leadId: task.leadId,
      opportunityId: task.opportunityId,
      syncToGoogle: true,
    },
    userId,
    { taskId }
  );
  return { event, created: true };
}

export async function removeTaskFromGoogleCalendar(businessId: string, userId: string, taskId: string) {
  await getTask(businessId, taskId);
  const existing = await findLinkedEvent(businessId, userId, taskId);
  if (!existing) return false;
  return deleteEvent(businessId, existing.id, userId);
}
