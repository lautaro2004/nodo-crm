import { prisma } from "@/lib/prisma";
import { createActivity, type RelatedType, type ActivityType } from "@/modules/activities/service";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { dayKey, timeLabel } from "@/lib/calendar-dates";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/labels";
import { GoogleCalendarError } from "@/modules/google-calendar/client";
import { createGoogleEvent, deleteGoogleEvent, updateGoogleEvent } from "@/modules/google-calendar/service";

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
  // Además de guardarlo en Nodo, crearlo en el Google Calendar principal del
  // usuario que lo crea (requiere Google conectado con permiso de Calendar).
  syncToGoogle?: boolean;
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

// Google puede no estar disponible por causas del usuario (sin conexión, acceso
// revocado) o por fallos transitorios; se distinguen para poder decidir.
function isConnectionUnavailable(error: unknown): boolean {
  return error instanceof GoogleCalendarError && (error.code === "not_connected" || error.code === "revoked");
}

function toDomainError(error: unknown): unknown {
  if (!(error instanceof GoogleCalendarError)) return error;
  if (error.code === "not_connected") return new Error("google_not_connected");
  if (error.code === "revoked") return new Error("google_needs_reconnect");
  return new Error("google_sync_failed");
}

// Campos que se reflejan en Google cuando el evento está vinculado.
const GOOGLE_SYNCED_FIELDS = ["title", "description", "location", "startsAt", "endsAt"] as const;

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

export async function createEvent(
  businessId: string,
  data: CreateEventInput,
  createdById: string | null,
  options: { taskId?: string | null } = {}
) {
  const { start, end } = parseRange(data.startsAt, data.endsAt);
  await assertRelationsBelongToBusiness(businessId, data);
  if (data.syncToGoogle && !createdById) throw new Error("google_requires_user");

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
      taskId: options.taskId ?? null,
    },
  });

  // Vinculación con Google Calendar (solo si se pidió). El evento se crea con
  // la conexión del PROPIO usuario que lo crea. Si Google falla, no queda un
  // evento a medias: se deshace la fila y se informa el error.
  let result = event;
  if (data.syncToGoogle && createdById) {
    const scope = { businessId, userId: createdById };
    try {
      const ref = await createGoogleEvent(
        scope,
        { title: event.title, description: event.description, location: event.location, startsAt: start, endsAt: end },
        event.id
      );
      try {
        result = await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { provider: "google", googleEventId: ref.id, googleUserId: createdById },
        });
      } catch (dbError) {
        await deleteGoogleEvent(scope, ref.id).catch(() => undefined);
        throw dbError;
      }
    } catch (error) {
      await prisma.calendarEvent.deleteMany({ where: { id: event.id, businessId } });
      throw toDomainError(error);
    }
  }

  await logForRelated(businessId, result, "event_scheduled", describe(result.title, result.type, start), createdById);
  return result;
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

  const { startsAt: _startsAt, endsAt: _endsAt, syncToGoogle: _sync, ...rest } = data;
  void _startsAt;
  void _endsAt;
  void _sync;

  // Evento vinculado a Google: los cambios de contenido/horario también se
  // aplican allá, con la conexión de quien lo creó y SOLO si es quien edita
  // (nunca se usa la conexión de otro usuario).
  let unlink = false;
  if (current.provider === "google" && current.googleEventId) {
    const touchesGoogle = GOOGLE_SYNCED_FIELDS.some((field) => data[field] !== undefined);
    if (touchesGoogle) {
      if (!current.googleUserId || actorUserId !== current.googleUserId) throw new Error("google_event_forbidden");
      const timesChanged = data.startsAt !== undefined || data.endsAt !== undefined;
      try {
        await updateGoogleEvent({ businessId, userId: current.googleUserId }, current.googleEventId, {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.location !== undefined ? { location: data.location } : {}),
          ...(timesChanged ? { startsAt: start, endsAt: end } : {}),
        });
      } catch (error) {
        if (error instanceof GoogleCalendarError && error.code === "not_found") {
          // Lo borraron en Google: el vínculo ya no es válido; queda como evento de Nodo.
          unlink = true;
        } else if (!isConnectionUnavailable(error)) {
          throw toDomainError(error);
        }
        // Sin conexión/revocada: se guarda el cambio en Nodo y el evento de Google queda como estaba.
      }
    }
  }

  const updated = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...rest,
      startsAt: start,
      endsAt: end,
      ...(unlink ? { provider: "internal", googleEventId: null, googleUserId: null } : {}),
    },
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

  // Evento vinculado a Google: se elimina también allá (con la conexión de su
  // dueño, y solo si es quien lo elimina). Sin conexión activa, el evento de
  // Google queda como está y solo se borra el de Nodo.
  if (current.provider === "google" && current.googleEventId) {
    if (!current.googleUserId || actorUserId !== current.googleUserId) throw new Error("google_event_forbidden");
    try {
      await deleteGoogleEvent({ businessId, userId: current.googleUserId }, current.googleEventId);
    } catch (error) {
      if (!isConnectionUnavailable(error)) throw toDomainError(error);
    }
  }

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
