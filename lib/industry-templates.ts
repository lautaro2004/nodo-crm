// Registro fijo en código, NO una tabla de base — "queremos probar primero
// la arquitectura configurable" (ver pedido de Fase 3, "Configuración
// inicial por rubro"). Cada template setea activeModules + siembra un
// Pipeline/PipelineStage y StatusDefinition por default para ese
// businessId. No crea ningún modelo específico de industria (GymMembership,
// Property, etc. quedan explícitamente fuera de esta fase).

export type IndustryKey = "software" | "comercio" | "servicios" | "gimnasio" | "inmobiliaria" | "otro";

export interface IndustryTemplate {
  key: IndustryKey;
  label: string;
  activeModules: string[];
  pipelineStages: { key: string; label: string; isWon?: boolean; isLost?: boolean }[];
  leadStatuses: { key: string; label: string; color: string }[];
  companyStatuses: { key: string; label: string; color: string }[];
}

const DEFAULT_PIPELINE_STAGES: IndustryTemplate["pipelineStages"] = [
  { key: "lead", label: "Lead" },
  { key: "contacted", label: "Contactado" },
  { key: "proposal", label: "Propuesta" },
  { key: "negotiation", label: "Negociación" },
  { key: "won", label: "Ganado", isWon: true },
  { key: "lost", label: "Perdido", isLost: true },
];

const DEFAULT_LEAD_STATUSES: IndustryTemplate["leadStatuses"] = [
  { key: "new", label: "Nuevo", color: "#64748b" },
  { key: "contacted", label: "Contactado", color: "#0ea5e9" },
  { key: "qualified", label: "Calificado", color: "#22c55e" },
  { key: "disqualified", label: "Descartado", color: "#ef4444" },
];

const DEFAULT_COMPANY_STATUSES: IndustryTemplate["companyStatuses"] = [
  { key: "prospect", label: "Prospecto", color: "#64748b" },
  { key: "customer", label: "Cliente", color: "#22c55e" },
  { key: "archived", label: "Archivado", color: "#94a3b8" },
];

export const INDUSTRY_TEMPLATES: Record<IndustryKey, IndustryTemplate> = {
  software: {
    key: "software",
    label: "Software / Tecnología",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  comercio: {
    key: "comercio",
    label: "Comercio",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    pipelineStages: [
      { key: "lead", label: "Consulta" },
      { key: "quoted", label: "Presupuestado" },
      { key: "confirmed", label: "Confirmado" },
      { key: "won", label: "Entregado", isWon: true },
      { key: "lost", label: "Perdido", isLost: true },
    ],
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  servicios: {
    key: "servicios",
    label: "Servicios profesionales",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  gimnasio: {
    key: "gimnasio",
    label: "Gimnasio",
    // Sin "opportunities" a propósito — el pedido lista Clientes/Contactos/
    // Leads/Tareas para este rubro, sin oportunidades de venta B2B.
    activeModules: ["companies", "contacts", "leads", "tasks"],
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  inmobiliaria: {
    key: "inmobiliaria",
    label: "Inmobiliaria",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  otro: {
    key: "otro",
    label: "Otro",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
};

export const INDUSTRY_OPTIONS = Object.values(INDUSTRY_TEMPLATES).map((t) => ({ value: t.key, label: t.label }));
