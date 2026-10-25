import { z } from "zod";

import { conditionGroupSchema } from "@/modules/automations/workflow-config";

// Paneles de Informes (ReportDashboard.widgets). Puro: lo usan el editor
// del panel (cliente) y el servidor, que lo valida al guardar y al
// calcular. Los filtros reutilizan las condiciones de las automatizaciones
// (mismos campos, operadores y validación por tipo).

export const WIDGET_TYPES = ["metric", "bar", "line", "table"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];
export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  metric: "Indicador (número)",
  bar: "Gráfico de barras (agrupado)",
  line: "Evolución en el tiempo",
  table: "Tabla de registros",
};

export const PERIODS = ["7", "30", "90", "365", "month", "year", "all"] as const;
export const PERIOD_LABELS: Record<(typeof PERIODS)[number], string> = {
  "7": "Últimos 7 días",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
  "365": "Último año",
  month: "Este mes",
  year: "Este año",
  all: "Todo el historial",
};

export const widgetSchema = z.object({
  id: z.string().trim().min(1).max(40),
  type: z.enum(WIDGET_TYPES),
  title: z.string().trim().min(1).max(80),
  module: z.union([z.enum(["lead", "contact", "company", "opportunity", "task"]), z.string().regex(/^cm:[a-z0-9]{10,40}$/)]),
  metric: z.object({ op: z.enum(["count", "sum", "avg"]), field: z.string().trim().max(80).nullable().optional() }).default({ op: "count" }),
  /** bar: campo por el que se agrupa. */
  groupBy: z.string().trim().max(80).nullable().optional(),
  /** Campo de fecha para el período y la evolución (por defecto, fecha de creación). */
  dateField: z.string().trim().max(80).default("createdAt"),
  period: z.enum(PERIODS).default("all"),
  filters: conditionGroupSchema.default({ match: "all", conditions: [] }),
  /** table: columnas (claves de campo) y cantidad de filas. */
  columns: z.array(z.string().trim().max(80)).max(8).default([]),
  limit: z.number().int().min(1).max(50).default(10),
  /** Ancho en la grilla (1 a 3 columnas en escritorio). */
  size: z.number().int().min(1).max(3).default(1),
});
export type Widget = z.infer<typeof widgetSchema>;

export const MAX_WIDGETS = 24;
export const MAX_DASHBOARDS = 30;

export const dashboardCreateSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  shared: z.boolean().optional(),
  widgets: z.array(widgetSchema).max(MAX_WIDGETS).optional(),
});
export const dashboardUpdateSchema = dashboardCreateSchema.partial().extend({ order: z.number().int().min(0).max(1000).optional() });
