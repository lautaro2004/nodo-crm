export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Nota",
  call: "Llamada",
  email: "Email",
  meeting: "Reunión",
  stage_change: "Cambio de etapa",
  status_change: "Cambio de estado",
  comment: "Comentario",
  assigned: "Asignación",
  priority_changed: "Cambio de prioridad",
  due_date_changed: "Cambio de fecha",
  attachment_added: "Archivo adjuntado",
  converted: "Conversión",
  event_scheduled: "Actividad programada",
  event_rescheduled: "Actividad reprogramada",
  event_reassigned: "Responsable de actividad",
  event_completed: "Actividad realizada",
  event_cancelled: "Actividad cancelada",
};

// Color del punto en el timeline de Activity (components/activities/activity-feed.tsx)
// — agrupa por "familia" de evento más que por tipo exacto, para que el
// historial se lea de un vistazo: violeta = interacción humana con el
// cliente, índigo = cambio de estado/proceso, ámbar = cambios de gestión
// de la tarea, esmeralda = archivos, gris = nota simple.
export const ACTIVITY_TYPE_DOT_COLOR: Record<string, string> = {
  note: "bg-slate-400",
  call: "bg-violet-500",
  email: "bg-violet-500",
  meeting: "bg-violet-500",
  comment: "bg-sky-500",
  stage_change: "bg-indigo-500",
  status_change: "bg-indigo-500",
  converted: "bg-indigo-600",
  event_scheduled: "bg-violet-500",
  event_rescheduled: "bg-amber-500",
  event_reassigned: "bg-amber-500",
  event_completed: "bg-emerald-500",
  event_cancelled: "bg-slate-400",
  assigned: "bg-amber-500",
  priority_changed: "bg-amber-500",
  due_date_changed: "bg-amber-500",
  attachment_added: "bg-emerald-500",
};

export const RELATED_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  contact: "Contacto",
  company: "Empresa",
  opportunity: "Oportunidad",
  task: "Tarea",
};

export const COMPANY_STATUS_LABELS: Record<string, string> = {
  prospect: "Prospecto",
  customer: "Cliente",
  archived: "Archivado",
};

export const OPPORTUNITY_STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  won: "Ganada",
  lost: "Perdida",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "Por hacer",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const TASK_PRIORITY_BADGE_VARIANT: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  low: "neutral",
  medium: "brand",
  high: "warning",
  urgent: "danger",
};

export const TASK_STATUS_BADGE_VARIANT: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  todo: "neutral",
  in_progress: "brand",
  completed: "success",
  cancelled: "danger",
};

// Fase 4 — origen de un Lead. "nexo_appointment" es el único valor real
// producido por una integración hoy; el resto son manuales.
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  nexo_appointment: "Nexo — Reserva",
  nexo_inquiry: "Nexo — Consulta",
  import: "Importación",
};

export const CALENDAR_EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: "Reunión",
  call: "Llamada",
  follow_up: "Seguimiento",
  event: "Evento",
  other: "Otro",
};

// Clases de chip en el calendario, por tipo.
export const CALENDAR_EVENT_TYPE_CHIP: Record<string, string> = {
  meeting: "bg-indigo-50 text-indigo-700 border-indigo-200",
  call: "bg-violet-50 text-violet-700 border-violet-200",
  follow_up: "bg-amber-50 text-amber-700 border-amber-200",
  event: "bg-emerald-50 text-emerald-700 border-emerald-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};

export const CALENDAR_EVENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programada",
  completed: "Realizada",
  cancelled: "Cancelada",
};
