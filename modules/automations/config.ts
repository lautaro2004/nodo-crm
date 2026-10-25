import { z } from "zod";

import { workflowRuleCreateSchema } from "@/modules/automations/workflow-config";

// Tipos de regla y su configuración (JSON en AutomationRule.config),
// validada con Zod en el servidor al crear/editar Y al ejecutar: si una
// regla quedó con una config inválida (ej. editada a mano), no corre.

export const AUTOMATION_TYPES = ["assign_lead", "lead_unattended", "lead_status_change"] as const;
export type AutomationType = (typeof AUTOMATION_TYPES)[number];

export const AUTOMATION_TYPE_LABELS: Record<AutomationType, string> = {
  assign_lead: "Asignación automática de leads",
  lead_unattended: "Alerta de lead sin atención",
  lead_status_change: "Acciones por cambio de estado",
};

const userId = z.string().trim().min(1).max(60);

export const assignLeadConfig = z.object({
  /** round_robin: rota entre los usuarios; fixed: siempre el primero. */
  mode: z.enum(["round_robin", "fixed"]),
  userIds: z.array(userId).min(1, "Elegí al menos un responsable").max(50),
  /** Solo leads de estos orígenes (vacío = todos). */
  sources: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const leadUnattendedConfig = z.object({
  /** Horas desde la creación sin ningún seguimiento real. */
  hours: z.number().int().min(1).max(720),
});

export const leadStatusChangeConfig = z
  .object({
    toStatus: z.string().trim().min(1).max(60),
    fromStatus: z.string().trim().min(1).max(60).nullable().default(null),
    assignTo: userId.nullable().default(null),
    onlyIfUnassigned: z.boolean().default(true),
    createTask: z
      .object({ title: z.string().trim().min(1).max(160), dueInDays: z.number().int().min(0).max(60) })
      .nullable()
      .default(null),
    notifyOwner: z.boolean().default(false),
  })
  .refine((c) => c.assignTo || c.createTask || c.notifyOwner, { message: "Elegí al menos una acción" });

export const CONFIG_SCHEMAS = {
  assign_lead: assignLeadConfig,
  lead_unattended: leadUnattendedConfig,
  lead_status_change: leadStatusChangeConfig,
} as const;

export type AssignLeadConfig = z.infer<typeof assignLeadConfig>;
export type LeadUnattendedConfig = z.infer<typeof leadUnattendedConfig>;
export type LeadStatusChangeConfig = z.infer<typeof leadStatusChangeConfig>;

export function parseConfig<T extends AutomationType>(type: T, config: unknown): z.infer<(typeof CONFIG_SCHEMAS)[T]> | null {
  const parsed = CONFIG_SCHEMAS[type].safeParse(config);
  return parsed.success ? (parsed.data as z.infer<(typeof CONFIG_SCHEMAS)[T]>) : null;
}

export const automationRuleCreateSchema = z.discriminatedUnion("type", [
  workflowRuleCreateSchema,
  z.object({ type: z.literal("assign_lead"), name: z.string().trim().min(1).max(80), enabled: z.boolean().optional(), config: assignLeadConfig }),
  z.object({ type: z.literal("lead_unattended"), name: z.string().trim().min(1).max(80), enabled: z.boolean().optional(), config: leadUnattendedConfig }),
  z.object({ type: z.literal("lead_status_change"), name: z.string().trim().min(1).max(80), enabled: z.boolean().optional(), config: leadStatusChangeConfig }),
]);
export const automationRuleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  enabled: z.boolean().optional(),
  config: z.unknown().optional(),
});
