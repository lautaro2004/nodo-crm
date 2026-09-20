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
