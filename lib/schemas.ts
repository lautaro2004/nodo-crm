import { z } from "zod";

import { STATUS_COLOR_KEYS } from "@/lib/status-colors";

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

// Campos personalizados enviados junto con el alta/edición de un registro
// estándar: definitionId → valor (texto; las relaciones, ids separados por
// coma). Se validan contra las definiciones REALES en el servidor
// (prepareCustomValues).
const customValuesSchema = z.record(z.string().max(60), z.string().max(2000).nullable()).optional();

export const companyCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  domain: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  status: z.string().trim().min(1).max(40).optional(),
  ownerId: z.string().trim().max(60).optional().nullable(),
  customValues: customValuesSchema,
});
export const companyUpdateSchema = companyCreateSchema.partial();

export const contactCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(60).optional().nullable(),
  companyId: z.string().trim().max(60).optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
  customValues: customValuesSchema,
});
export const contactUpdateSchema = contactCreateSchema.partial();

export const leadCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(160),
  email: z.string().trim().email("Email inválido").max(160).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(60).optional().nullable(),
  companyId: z.string().trim().max(60).optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
  status: z.string().trim().min(1).max(40).optional(),
  statusReason: z.string().trim().max(200).optional().nullable(),
  source: z.string().trim().max(40).optional(),
  customValues: customValuesSchema,
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

export const statusColorSchema = z.enum(STATUS_COLOR_KEYS);

export const pipelineStageCreateSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  color: statusColorSchema.optional().nullable(),
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
  customValues: customValuesSchema,
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
  customValues: customValuesSchema,
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
  "image",
  "file",
  "relation",
] as const;

// Módulos estándar o personalizados ("cm:<moduleId>"). Que el módulo sea
// del negocio se valida en el servicio, nunca acá.
export const fieldEntityTypeSchema = z.union([
  z.enum(["lead", "contact", "company", "opportunity", "task"]),
  z.string().regex(/^cm:[a-z0-9]{10,40}$/, "Módulo inválido"),
]);
const relationTargetSchema = z.union([
  z.enum(["lead", "contact", "company", "opportunity", "task"]),
  z.string().regex(/^cm:[a-z0-9]{10,40}$/),
]);

// Validaciones extra por tipo (ver lib/custom-fields.ts, sanitizeValidation:
// el servidor descarta las que no corresponden al tipo).
const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(2000).nullable().optional(),
    maxLength: z.number().int().min(0).max(2000).nullable().optional(),
    min: z.number().finite().nullable().optional(),
    max: z.number().finite().nullable().optional(),
    minDate: z.string().trim().max(10).nullable().optional(),
    maxDate: z.string().trim().max(10).nullable().optional(),
  })
  .strict();

export const customFieldDefinitionCreateSchema = z.object({
  entityType: fieldEntityTypeSchema,
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
  targetEntity: relationTargetSchema.optional().nullable(),
  multiple: z.boolean().optional(),
  exclusive: z.boolean().optional(),
  inverseLabel: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(300).optional().nullable(),
  defaultValue: z.string().trim().max(2000).optional().nullable(),
  validation: fieldValidationSchema.optional().nullable(),
});
// El tipo y el destino de una relación no se cambian después de crear el
// campo (reinterpretaría los valores ya cargados). Las opciones sí:
// renombrar migra los valores cargados, y quitar una opción en uso exige
// elegir qué hacer con esos registros (ver updateCustomFieldDefinition).
const removedOptionStrategySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("keep") }),
  z.object({ action: z.literal("clear") }),
  z.object({ action: z.literal("replace"), replaceWith: z.string().trim().min(1).max(80) }),
]);
export const customFieldDefinitionUpdateSchema = customFieldDefinitionCreateSchema
  .omit({ entityType: true, key: true, type: true, targetEntity: true })
  .partial()
  .extend({
    options: z.array(z.string().trim().min(1).max(80)).max(200).optional(),
    optionRenames: z.array(z.object({ from: z.string().trim().min(1).max(80), to: z.string().trim().min(1).max(80) })).max(200).optional(),
    removedOptions: z.record(z.string(), removedOptionStrategySchema).optional(),
  });

export const customFieldReorderSchema = z.object({
  entityType: fieldEntityTypeSchema,
  ids: z.array(z.string().trim().min(1)).min(1).max(200),
});

export const customModuleCreateSchema = z.object({
  labelSingular: z.string().trim().min(1, "Poné un nombre").max(40),
  labelPlural: z.string().trim().min(1, "Poné un nombre").max(40),
  description: z.string().trim().max(300).optional().nullable(),
  icon: z.string().trim().max(20).optional().nullable(),
  templateId: z.string().trim().max(40).optional().nullable(),
});
export const customModuleUpdateSchema = customModuleCreateSchema
  .omit({ templateId: true })
  .partial()
  .extend({
    priceFieldId: z.string().trim().min(1).nullable().optional(),
    imageFieldId: z.string().trim().min(1).nullable().optional(),
    codeFieldId: z.string().trim().min(1).nullable().optional(),
    archived: z.boolean().optional(),
  });

// values: definitionId → valor (texto; las relaciones son una lista de ids
// separada por coma). Se validan contra las definiciones REALES del
// módulo en el servicio.
export const customRecordCreateSchema = z.object({
  title: z.string().trim().min(1, "El nombre es obligatorio").max(200),
  ownerId: z.string().trim().min(1).nullable().optional(),
  values: z.record(z.string(), z.string().max(2000).nullable()).optional(),
});
export const customRecordUpdateSchema = customRecordCreateSchema.partial().extend({
  archived: z.boolean().optional(),
});

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
  // Clave de la paleta de 10 colores (lib/status-colors.ts). Los hex
  // legacy ya guardados se siguen LEYENDO, pero no se aceptan nuevos.
  color: statusColorSchema.optional().nullable(),
  order: z.number().int().min(0).optional(),
  isDefault: z.boolean().optional(),
  requiresReason: z.boolean().optional(),
  reasonOptions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  isRejection: z.boolean().optional(),
});
export const statusDefinitionUpdateSchema = statusDefinitionCreateSchema.omit({ entityType: true, key: true }).partial();
export const statusDefinitionReorderSchema = z.object({
  entityType: z.enum(["lead", "company"]),
  ids: z.array(z.string().trim().min(1)).min(1).max(100),
});

export const savedViewCreateSchema = z.object({
  entityType: z.union([z.enum(["lead", "opportunity", "contact", "company", "task"]), z.string().regex(/^cm:[a-z0-9]{10,40}$/)]),
  name: z.string().trim().min(1, "Poné un nombre").max(60),
  params: z.string().max(2000),
  shared: z.boolean().optional(),
});
export const savedViewUpdateSchema = savedViewCreateSchema.omit({ entityType: true }).partial();

export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido").max(160),
  role: z.enum(["admin", "member"]),
  products: z.array(z.enum(["crm", "nexo"])).min(1, "Elegí al menos un producto").max(2),
  /** Rol de Nodo que se aplica al aceptar (ej. "viewer" = solo lectura). */
  accessRole: z.string().trim().min(1).max(60).optional().nullable(),
});
export const memberUpdateSchema = z
  .object({
    role: z.enum(["admin", "member"]).optional(),
    products: z.array(z.enum(["crm", "nexo"])).min(1).max(2).optional(),
  })
  .refine((d) => d.role !== undefined || d.products !== undefined, { message: "Nada para actualizar" });
export const invitationAcceptSchema = z.object({ token: z.string().trim().min(20).max(200) });

export const opportunityItemCreateSchema = z.object({
  recordId: z.string().trim().min(1),
  quantity: z.number().positive().max(1_000_000).optional(),
  unitPrice: z.number().min(0).max(1_000_000_000).optional(),
});
export const opportunityItemUpdateSchema = opportunityItemCreateSchema.omit({ recordId: true });
