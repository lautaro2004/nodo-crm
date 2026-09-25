import { z } from "zod";

// Esquemas Zod de validación de entrada — un archivo central para esta
// fase (Core). Crece acá en vez de un archivo por módulo por simplicidad;
// se puede partir después si crece demasiado, mismo criterio que Nexo usa
// para lib/schemas.ts.

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(1).max(120).optional(),
  industry: z.enum(["software", "comercio", "servicios", "gimnasio", "inmobiliaria", "construccion", "otro"]).optional(),
  // Selección editable del paso "¿Qué querés gestionar?" (sugerida según
  // el rubro, pero el usuario puede cambiarla antes de confirmar) — sólo
  // tiene efecto si además viene `industry` en el mismo request; ver
  // app/api/onboarding/route.ts.
  activeModules: z.array(z.enum(["companies", "contacts", "leads", "opportunities", "tasks"])).min(1).optional(),
});

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  domain: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  status: z.string().trim().min(1).max(40).optional(),
  ownerId: z.string().trim().max(60).optional().nullable(),
});
export const companyUpdateSchema = companyCreateSchema.partial();

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(60).optional().nullable(),
  companyId: z.string().trim().max(60).optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
});
export const contactUpdateSchema = contactCreateSchema.partial();

export const leadCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(60).optional().nullable(),
  companyId: z.string().trim().max(60).optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
  status: z.string().trim().min(1).max(40).optional(),
  source: z.string().trim().max(40).optional(),
});
export const leadUpdateSchema = leadCreateSchema.partial();

// Fase 5 — payload de "Convertir Lead". discriminatedUnion sobre
// contact.mode para que el body sea inválido (400 en el borde, no un bug
// silencioso más adentro) si falta contactId cuando mode es "existing".
export const convertLeadSchema = z.object({
  contact: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("new") }),
    z.object({ mode: z.literal("existing"), contactId: z.string().trim().min(1) }),
  ]),
  createOpportunity: z.boolean(),
  opportunity: z
    .object({
      title: z.string().trim().min(1, "El nombre de la oportunidad es obligatorio").max(160),
      pipelineId: z.string().trim().min(1, "Elegí un pipeline"),
      stageId: z.string().trim().min(1, "Elegí una etapa"),
      ownerId: z.string().trim().max(60).optional().nullable(),
      amount: z.number().nonnegative().optional().nullable(),
    })
    .optional(),
});

export const pipelineCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional(),
});
export const pipelineUpdateSchema = pipelineCreateSchema.partial();

export const pipelineStageCreateSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  order: z.number().int().min(0).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});
export const pipelineStageUpdateSchema = pipelineStageCreateSchema.partial();
export const pipelineStageReorderSchema = z.object({
  stageIds: z.array(z.string().trim().min(1)).min(1),
});

export const opportunityCreateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(160),
  companyId: z.string().trim().max(60).optional().nullable(),
  contactId: z.string().trim().max(60).optional().nullable(),
  pipelineId: z.string().trim().min(1, "Elegí un pipeline"),
  stageId: z.string().trim().min(1, "Elegí una etapa"),
  amount: z.number().nonnegative().optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
});
export const opportunityUpdateSchema = opportunityCreateSchema.partial().extend({
  status: z.enum(["open", "won", "lost"]).optional(),
});

// Vocabulario fijo de Task — validado acá (TypeScript/Zod), NO como enum
// nativo de Postgres — ver comentario en prisma/schema.prisma, modelo
// Task, y docs/architecture/crm-fase-tareas.md.
export const taskStatusEnum = z.enum(["todo", "in_progress", "completed", "cancelled"]);
export const taskPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  priority: taskPriorityEnum.optional(),
  startDate: z.string().trim().optional().nullable(),
  dueAt: z.string().trim().optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
  companyId: z.string().trim().max(60).optional().nullable(),
  contactId: z.string().trim().max(60).optional().nullable(),
  leadId: z.string().trim().max(60).optional().nullable(),
  opportunityId: z.string().trim().max(60).optional().nullable(),
});
export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: taskStatusEnum.optional(),
});

export const calendarEventTypeEnum = z.enum(["meeting", "call", "follow_up", "event", "other"]);
export const calendarEventStatusEnum = z.enum(["scheduled", "completed", "cancelled"]);

export const calendarEventCreateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  type: calendarEventTypeEnum.optional(),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  location: z.string().trim().max(300).optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
  companyId: z.string().trim().max(60).optional().nullable(),
  contactId: z.string().trim().max(60).optional().nullable(),
  leadId: z.string().trim().max(60).optional().nullable(),
  opportunityId: z.string().trim().max(60).optional().nullable(),
  syncToGoogle: z.boolean().optional(),
});
export const calendarEventUpdateSchema = calendarEventCreateSchema.partial().extend({
  status: calendarEventStatusEnum.optional(),
});

export const emailSettingsSchema = z.object({
  provider: z.enum(["sandbox", "resend"]),
  fromEmail: z.string().trim().email("Email inválido").max(200).optional().nullable().or(z.literal("")),
  fromName: z.string().trim().max(120).optional().nullable(),
});

export const emailTemplateCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  subject: z.string().trim().min(1, "El asunto es obligatorio").max(300),
  bodyHtml: z.string().trim().min(1, "El cuerpo es obligatorio").max(100000),
});
export const emailTemplateUpdateSchema = emailTemplateCreateSchema.partial();

const emailEntityTypeEnum = z.enum(["contact", "lead", "opportunity"]);
export const emailPreviewSchema = z.object({
  entityType: emailEntityTypeEnum,
  entityId: z.string().trim().min(1).max(60),
  templateId: z.string().trim().max(60).optional(),
});
export const emailSendSchema = z.object({
  entityType: emailEntityTypeEnum,
  entityId: z.string().trim().min(1).max(60),
  subject: z.string().trim().min(1, "El asunto es obligatorio").max(300),
  bodyHtml: z.string().trim().min(1, "El cuerpo es obligatorio").max(100000),
});

export const taskReminderSchema = z.object({
  remindAt: z.string().trim().min(1, "Elegí fecha y hora"),
});

export const importRowSchema = z.object({
  standard: z.record(z.string(), z.string()),
  custom: z.record(z.string(), z.string()),
});
export const importExecuteSchema = z.object({
  rows: z.array(importRowSchema).min(1, "No hay filas para importar").max(2000),
});

export const moduleConfigUpdateSchema = z.object({
  internalModule: z.enum(["opportunity"]),
  labelSingular: z.string().trim().min(1, "Obligatorio").max(60),
  labelPlural: z.string().trim().min(1, "Obligatorio").max(60),
  icon: z.enum(["trending-up", "target", "calendar", "check-square", "building"]).optional().nullable(),
});

export const taskCommentSchema = z.object({
  body: z.string().trim().min(1, "Escribí algo").max(4000),
});

export const activityCreateSchema = z.object({
  relatedType: z.enum(["lead", "contact", "company", "opportunity", "task"]),
  relatedId: z.string().trim().min(1),
  type: z.enum([
    "note",
    "call",
    "email",
    "meeting",
    "stage_change",
    "status_change",
    "comment",
    "assigned",
    "priority_changed",
    "due_date_changed",
    "attachment_added",
  ]),
  body: z.string().trim().max(4000).optional().nullable(),
});

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().trim().max(20).optional().nullable(),
});
export const tagAssignSchema = z.object({
  entityType: z.enum(["lead", "contact", "company", "opportunity"]),
  entityId: z.string().trim().min(1),
});

export const customFieldTypes = [
  "text",
  "number",
  "currency",
  "date",
  "datetime",
  "boolean",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
] as const;

export const customFieldDefinitionCreateSchema = z.object({
  entityType: z.enum(["lead", "contact", "company", "opportunity"]),
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "Usá minúsculas, números y guión bajo, empezando con una letra"),
  label: z.string().trim().min(1).max(80),
  type: z.enum(customFieldTypes),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});
export const customFieldDefinitionUpdateSchema = customFieldDefinitionCreateSchema
  .omit({ entityType: true, key: true })
  .partial();

export const customFieldValueSetSchema = z.object({
  definitionId: z.string().trim().min(1),
  entityId: z.string().trim().min(1),
  value: z.string().trim().max(2000).optional().nullable(),
});

export const statusDefinitionCreateSchema = z.object({
  entityType: z.enum(["lead", "company"]),
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, "Usá minúsculas, números y guión bajo, empezando con una letra"),
  label: z.string().trim().min(1).max(80),
  color: z.string().trim().max(20).optional().nullable(),
  order: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
});
export const statusDefinitionUpdateSchema = statusDefinitionCreateSchema.omit({ entityType: true, key: true }).partial();
