// Registro fijo en código, NO una tabla de base — "queremos probar primero
// la arquitectura configurable" (ver pedido de Fase 3, "Configuración
// inicial por rubro"). Cada template setea activeModules + siembra un
// Pipeline/PipelineStage y StatusDefinition por default para ese
// businessId, y ahora también el nombre visible del módulo de
// Oportunidades (moduleLabel) y el nombre del pipeline que crea
// (pipelineName) — ver modules/workspace/module-config.ts y
// modules/workspace/service.ts::applyIndustryTemplate. No crea ningún
// modelo específico de industria (GymMembership, Property, etc. quedan
// explícitamente fuera de esta fase).

import type { ModuleIconKey } from "@/modules/workspace/module-config";

export type IndustryKey = "software" | "comercio" | "servicios" | "gimnasio" | "inmobiliaria" | "construccion" | "otro";

export interface IndustryModuleLabel {
  labelSingular: string;
  labelPlural: string;
  icon: ModuleIconKey;
}

export interface IndustryTemplate {
  key: IndustryKey;
  label: string;
  activeModules: string[];
  // Nombre visible del módulo interno "opportunity" para este rubro (Fase
  // 2/3) — inerte si "opportunities" no está en activeModules.
  moduleLabel: IndustryModuleLabel;
  pipelineName: string;
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
  // "converted" (Fase 5): se setea EXCLUSIVAMENTE por la conversión
  // (modules/leads/conversion.ts), nunca elegible a mano desde el <select>
  // de estado — ver la guarda en modules/leads/service.ts::updateLead. Se
  // agrega igual al template para que aparezca con su label/color
  // correctos apenas exista un Lead convertido, sin depender de que
  // ensureConvertedStatusDefinition() lo siembre después.
  { key: "converted", label: "Convertido", color: "#6366f1" },
  { key: "disqualified", label: "Descartado", color: "#ef4444" },
];

const DEFAULT_COMPANY_STATUSES: IndustryTemplate["companyStatuses"] = [
  { key: "prospect", label: "Prospecto", color: "#64748b" },
  { key: "customer", label: "Cliente", color: "#22c55e" },
  { key: "archived", label: "Archivado", color: "#94a3b8" },
];

const DEFAULT_OPPORTUNITY_LABEL: IndustryModuleLabel = { labelSingular: "Oportunidad", labelPlural: "Oportunidades", icon: "trending-up" };

export const INDUSTRY_TEMPLATES: Record<IndustryKey, IndustryTemplate> = {
  software: {
    key: "software",
    label: "Software / Tecnología",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    moduleLabel: DEFAULT_OPPORTUNITY_LABEL,
    pipelineName: "Ventas",
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  comercio: {
    key: "comercio",
    label: "Comercio",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    moduleLabel: { labelSingular: "Venta", labelPlural: "Ventas", icon: "trending-up" },
    pipelineName: "Ventas",
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
    // Ejemplo del pedido: estudio jurídico -> Consultas/Citas/Casos.
    moduleLabel: { labelSingular: "Caso", labelPlural: "Casos", icon: "target" },
    pipelineName: "Casos",
    pipelineStages: [
      { key: "consulta", label: "Consulta" },
      { key: "cita", label: "Cita" },
      { key: "caso_abierto", label: "Caso abierto" },
      { key: "cerrado", label: "Cerrado", isWon: true },
      { key: "sin_acuerdo", label: "Cerrado sin acuerdo", isLost: true },
    ],
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  gimnasio: {
    key: "gimnasio",
    label: "Gimnasio",
    // Sin "opportunities" a propósito — el pedido lista Clientes/Contactos/
    // Leads/Tareas para este rubro, sin oportunidades de venta B2B.
    activeModules: ["companies", "contacts", "leads", "tasks"],
    moduleLabel: DEFAULT_OPPORTUNITY_LABEL,
    pipelineName: "Ventas",
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  inmobiliaria: {
    key: "inmobiliaria",
    label: "Inmobiliaria",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    // "Operación" y no "Venta" — evita chocar con el nombre de la última
    // etapa del propio pipeline (Fase 4, ejemplo del pedido).
    moduleLabel: { labelSingular: "Operación", labelPlural: "Operaciones", icon: "building" },
    pipelineName: "Operaciones",
    pipelineStages: [
      { key: "lead", label: "Lead" },
      { key: "visita", label: "Visita" },
      { key: "oferta", label: "Oferta" },
      { key: "reserva", label: "Reserva" },
      { key: "venta", label: "Venta", isWon: true },
      { key: "perdida", label: "Perdida", isLost: true },
    ],
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  construccion: {
    key: "construccion",
    label: "Construcción / Carpintería",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    moduleLabel: { labelSingular: "Proyecto", labelPlural: "Proyectos", icon: "check-square" },
    pipelineName: "Proyectos",
    pipelineStages: [
      { key: "lead", label: "Lead" },
      { key: "presupuesto", label: "Presupuesto" },
      { key: "produccion", label: "Producción" },
      { key: "finalizado", label: "Finalizado", isWon: true },
      { key: "cancelado", label: "Cancelado", isLost: true },
    ],
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
  otro: {
    key: "otro",
    label: "Otro",
    activeModules: ["companies", "contacts", "leads", "opportunities", "tasks"],
    moduleLabel: DEFAULT_OPPORTUNITY_LABEL,
    pipelineName: "Ventas",
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    leadStatuses: DEFAULT_LEAD_STATUSES,
    companyStatuses: DEFAULT_COMPANY_STATUSES,
  },
};

export const INDUSTRY_OPTIONS = Object.values(INDUSTRY_TEMPLATES).map((t) => ({ value: t.key, label: t.label }));
