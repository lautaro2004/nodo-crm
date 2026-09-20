import { prisma } from "@/lib/prisma";
import { createActivity, type RelatedType, type ActivityType } from "@/modules/activities/service";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { dayKey, timeLabel } from "@/lib/calendar-dates";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/labels";

export const EVENT_TYPES = ["meeting", "call", "follow_up", "event", "other"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const EVENT_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface CreateEventInput {
  title: string;
  description?: string | null;
  type?: EventType;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  ownerId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
}
export interface UpdateEventInput extends Partial<CreateEventInput> {
  status?: EventStatus;
}

type Relations = Pick<CreateEventInput, "ownerId" | "companyId" | "contactId" | "leadId" | "opportunityId">;

// Mismo criterio que Task: ninguna relación recibida del cliente se
// confía sin verificar que pertenezca al MISMO businessId.
async function assertRelationsBelongToBusiness(businessId: string, input: Relations) {
  if (input.ownerId) await assertUserBelongsToBusiness(businessId, input.ownerId);
  if (input.companyId) {
    if (!(await prisma.company.findFirst({ where: { id: input.companyId, businessId }, select: { id: true } }))) throw new Error("company_not_found");
  }
  if (input.contactId) {
    if (!(await prisma.contact.findFirst({ where: { id: input.contactId, businessId }, select: { id: true } }))) throw new Error("contact_not_found");
  }
  if (input.leadId) {
    if (!(await prisma.lead.findFirst({ where: { id: input.leadId, businessId }, select: { id: true } }))) throw new Error("lead_not_found");
  }
  if (input.opportunityId) {
    if (!(await prisma.opportunity.findFirst({ where: { id: input.opportunityId, businessId }, select: { id: true } }))) throw new Error("opportunity_not_found");
  }
}

function parseRange(startsAt: string, endsAt: string): { start: Date; end: Date } {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new Error("invalid_date");
  if (end.getTime() <= start.getTime()) throw new Error("invalid_time_range");
  return { start, end };
}

function describe(title: string, type: string, start: Date) {
  return `${CALENDAR_EVENT_TYPE_LABELS[type] ?? type}: ${title} — ${dayKey(start)} ${timeLabel(start)}`;
}

// El historial del evento se escribe en Activity de CADA entidad CRM
// relacionada (no hay un timeline de "evento" aparte).
async function logForRelated(
  businessId: string,
  event: { companyId: string | null; contactId: string | null; leadId: string | null; opportunityId: string | null },
  type: ActivityType,
  body: string,
  actorUserId: string | null
) {
  const targets: { relatedType: RelatedType; relatedId: string }[] = [];
  if (event.companyId) targets.push({ relatedType: "company", relatedId: event.companyId });
  if (event.contactId) targets.push({ relatedType: "contact", relatedId: event.contactId });
  if (event.leadId) targets.push({ relatedType: "lead", relatedId: event.leadId });
  if (event.opportunityId) targets.push({ relatedType: "opportunity", relatedId: event.opportunityId });
  for (const t of targets) await createActivity(businessId, { ...t, type, body, ownerId: actorUserId });
}

export async function createEvent(businessId: string, data: CreateEventInput, createdById: string | null) {
  const { start, end } = parseRange(data.startsAt, data.endsAt);
  await assertRelationsBelongToBusiness(businessId, data);

  const event = await prisma.calendarEvent.create({
    data: {
      businessId,
      title: data.title,
      description: data.description ?? null,
      type: data.type ?? "meeting",
      startsAt: start,
      endsAt: end,
      location: data.location ?? null,
      ownerId: data.ownerId ?? null,
      createdById,
      companyId: data.companyId ?? null,
      contactId: data.contactId ?? null,
      leadId: data.leadId ?? null,
      opportunityId: data.opportunityId ?? null,
    },
  });

  await logForRelated(businessId, event, "event_scheduled", describe(event.title, event.type, start), createdById);
  return event;
}

const INCLUDE_RELATIONS = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true } },
  opportunity: { select: { id: true, title: true } },
} as const;

export interface ListEventsFilters {
  from?: Date;
  to?: Date;
  ownerId?: string;
  type?: EventType;
  status?: EventStatus;
  companyId?: string;
  contactId?: string;
  leadId?: string;
  opportunityId?: string;
  limit?: number;
}

// Rango por solapamiento: un evento que empieza antes de `from` pero
// termina dentro del rango también se muestra.
export async function listEvents(businessId: string, filters: ListEventsFilters = {}) {
  return prisma.calendarEvent.findMany({
    where: {
      businessId,
      ...(filters.from ? { endsAt: { gt: filters.from } } : {}),
      ...(filters.to ? { startsAt: { lt: filters.to } } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.contactId ? { contactId: filters.contactId } : {}),
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.opportunityId ? { opportunityId: filters.opportunityId } : {}),
    },
    include: INCLUDE_RELATIONS,
    orderBy: { startsAt: "asc" },
    ...(filters.limit ? { take: filters.limit } : {}),
  });
}

export async function listUpcomingEvents(
  businessId: string,
  filters: Omit<ListEventsFilters, "from" | "status"> = {},
  now = new Date()
) {
  return listEvents(businessId, { ...filters, from: now, status: "scheduled", limit: filters.limit ?? 5 });
}

export async function getEvent(businessId: string, id: string) {
  return prisma.calendarEvent.findFirst({ where: { id, businessId }, include: INCLUDE_RELATIONS });
}

// Advertencia simple (no bloqueante): otro evento programado del mismo
// responsable que se solapa. Sin responsable no hay conflicto posible.
export async function findConflicts(
  businessId: string,
  params: { ownerId: string | null | undefined; startsAt: string; endsAt: string; excludeId?: string }
) {
  if (!params.ownerId) return [];
  const { start, end } = parseRange(params.startsAt, params.endsAt);
  return prisma.calendarEvent.findMany({
    where: {
      businessId,
      ownerId: params.ownerId,
      status: "scheduled",
      startsAt: { lt: end },
      endsAt: { gt: start },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: { id: true, title: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
    take: 5,
  });
}

export async function updateEvent(businessId: string, id: string, data: UpdateEventInput, actorUserId: string | null) {
  const current = await prisma.calendarEvent.findFirst({ where: { id, businessId } });
  if (!current) return null;

  await assertRelationsBelongToBusiness(businessId, data);

  const { start, end } = parseRange(data.startsAt ?? current.startsAt.toISOString(), data.endsAt ?? current.endsAt.toISOString());

  const { startsAt: _startsAt, endsAt: _endsAt, ...rest } = data;
  void _startsAt;
  void _endsAt;
  const updated = await prisma.calendarEvent.update({
    where: { id },
    data: { ...rest, startsAt: start, endsAt: end },
  });

  const rescheduled = start.getTime() !== current.startsAt.getTime() || end.getTime() !== current.endsAt.getTime();
  if (rescheduled) {
    await logForRelated(businessId, updated, "event_rescheduled", `${updated.title} → ${dayKey(start)} ${timeLabel(start)}`, actorUserId);
  }
  if (data.ownerId !== undefined && data.ownerId !== current.ownerId) {
    await logForRelated(businessId, updated, "event_reassigned", updated.title, actorUserId);
  }
  if (data.status && data.status !== current.status) {
    if (data.status === "cancelled") await logForRelated(businessId, updated, "event_cancelled", updated.title, actorUserId);
    else if (data.status === "completed") await logForRelated(businessId, updated, "event_completed", updated.title, actorUserId);
    else await logForRelated(businessId, updated, "event_scheduled", `Reactivada: ${describe(updated.title, updated.type, start)}`, actorUserId);
  }

  return updated;
}

// Eliminar = borrado físico (errores de carga); "cancelar" es
// updateEvent({ status: "cancelled" }) y conserva el evento.
export async function deleteEvent(businessId: string, id: string, actorUserId: string | null) {
  const current = await prisma.calendarEvent.findFirst({ where: { id, businessId } });
  if (!current) return false;
  const result = await prisma.calendarEvent.deleteMany({ where: { id, businessId } });
  if (result.count === 0) return false;
  await logForRelated(businessId, current, "event_cancelled", `Eliminada: ${current.title}`, actorUserId);
  return true;
}

// Referencia visual en el calendario: tareas abiertas con vencimiento en
// el rango. NO se convierten en eventos ni se duplican.
export async function listTaskDueDates(businessId: string, from: Date, to: Date, ownerId?: string) {
  return prisma.task.findMany({
    where: {
      businessId,
      status: { in: ["todo", "in_progress"] },
      dueAt: { gte: from, lt: to },
      ...(ownerId ? { ownerId } : {}),
    },
    select: { id: true, title: true, dueAt: true },
    orderBy: { dueAt: "asc" },
  });
}
