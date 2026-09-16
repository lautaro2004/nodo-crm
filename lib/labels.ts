export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Nota",
  call: "Llamada",
  email: "Email",
  meeting: "Reunión",
  stage_change: "Cambio de etapa",
  status_change: "Cambio de estado",
};

export const RELATED_TYPE_LABELS: Record<string, string> = {
  lead: "Lead",
  contact: "Contacto",
  company: "Empresa",
  opportunity: "Oportunidad",
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
  pending: "Pendiente",
  done: "Completada",
};

// Fase 4 — origen de un Lead. "nexo_appointment" es el único valor real
// producido por una integración hoy; el resto son manuales.
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  nexo_appointment: "Nexo — Reserva",
  import: "Importación",
};
