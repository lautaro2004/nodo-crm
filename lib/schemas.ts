import { z } from "zod";

// Esquemas Zod de validación de entrada — un archivo central para esta
// fase (Core). Crece acá en vez de un archivo por módulo por simplicidad;
// se puede partir después si crece demasiado, mismo criterio que Nexo usa
// para lib/schemas.ts.

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(1).max(120).optional(),
  industry: z.enum(["software", "comercio", "servicios", "gimnasio", "inmobiliaria", "otro"]).optional(),
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

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(200),
  dueAt: z.string().trim().optional().nullable(),
  relatedType: z.enum(["lead", "contact", "company", "opportunity"]).optional().nullable(),
  relatedId: z.string().trim().max(60).optional().nullable(),
  ownerId: z.string().trim().max(60).optional().nullable(),
});
export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(["pending", "done"]).optional(),
});

export const activityCreateSchema = z.object({
  relatedType: z.enum(["lead", "contact", "company", "opportunity"]),
  relatedId: z.string().trim().min(1),
  type: z.enum(["note", "call", "email", "meeting", "stage_change", "status_change"]),
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
