import { prisma } from "@/lib/prisma";

export type RelatedType = "lead" | "contact" | "company" | "opportunity" | "task";
// "comment" (Fase Tareas v2): decisión explícita de NO crear un modelo
// TaskComment aparte — un comentario es, estructuralmente, una Activity de
// tipo "note"/"comment" con relatedType: "task". Mismo timeline sirve para
// comentarios Y para el historial de cambios de la tarea (asignación,
// prioridad, fecha, completado/reabierto, adjunto agregado) — ver
// docs/architecture/crm-fase-tareas.md, "Comentarios e historial".
export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "stage_change"
  | "status_change"
  | "comment"
  | "assigned"
  | "priority_changed"
  | "due_date_changed"
  | "attachment_added"
  // Fase 5 (conversión de Leads): un evento propio, distinto de
  // "status_change" genérico — permite distinguir en el historial "este
  // Lead se convirtió" de un cambio de estado cualquiera.
  | "converted"
  // Calendario: historial de un evento, escrito en cada entidad CRM
  // relacionada (modules/calendar/service.ts). No es un segundo sistema
  // de historial — es el mismo Activity.
  | "event_scheduled"
  | "event_rescheduled"
  | "event_reassigned"
  | "event_completed"
  | "event_cancelled";

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
  const activity = await prisma.activity.create({
    data: {
      businessId,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      type: input.type,
      body: input.body ?? null,
      ownerId: input.ownerId ?? null,
    },
  });
  if (input.relatedType === "lead" && isFollowUp(input)) {
    // Scopeado por businessId: una actividad sobre un id ajeno no toca nada.
    await prisma.lead.updateMany({
      where: { id: input.relatedId, businessId },
      data: { lastFollowUpAt: activity.createdAt },
    });
  }
  return activity;
}

// "Seguimiento real" de un lead: interacción registrada POR UNA PERSONA
// (ownerId presente). Abrir la ficha no genera actividad, y los eventos
// automáticos ("Lead creado", sync de Nexo, cambios de estado/etapa,
// asignaciones) no cuentan. Misma definición que usa el backfill de la
// migración 20261017090000_views_automations.
export const FOLLOW_UP_TYPES: ActivityType[] = ["call", "email", "meeting", "note", "comment", "event_completed"];

export function isFollowUp(input: { type: string; ownerId?: string | null }) {
  return !!input.ownerId && (FOLLOW_UP_TYPES as string[]).includes(input.type);
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
