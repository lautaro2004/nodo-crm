import { z } from "zod";

// Configuración de las automatizaciones genéricas (AutomationRule.type =
// "workflow"). Pura: la usan el constructor de la UI y el servidor, que la
// valida al guardar Y al ejecutar (una regla con config inválida no corre).
//
//   Disparador   cuándo se evalúa (alta, modificación, baja o "antes de
//                guardar", opcionalmente solo si cambió un campo).
//   Condiciones  grupo AND/OR de condiciones sobre cualquier campo del
//                módulo (estándar o personalizado), con un nivel de
//                subgrupos para combinar ("A y (B o C)").
//   Acciones     se ejecutan en orden; "Actualizar campo" y "Actualizar
//                relacionados" pueden disparar otras automatizaciones
//                (encadenadas, con límite de profundidad y sin ciclos).

export const WORKFLOW_EVENTS = ["created", "updated", "created_or_updated", "deleted", "before_save"] as const;
export type WorkflowEvent = (typeof WORKFLOW_EVENTS)[number];

export const WORKFLOW_EVENT_LABELS: Record<WorkflowEvent, string> = {
  created: "Se crea un registro",
  updated: "Se modifica un registro",
  created_or_updated: "Se crea o modifica un registro",
  deleted: "Se elimina un registro",
  before_save: "Antes de guardar (validar)",
};

export const WORKFLOW_EVENT_HINTS: Record<WorkflowEvent, string> = {
  created: "Corre después del alta, desde cualquier origen (formulario, importación, integraciones).",
  updated: "Corre después de cada modificación. Elegí un campo para que corra solo cuando ese campo cambia.",
  created_or_updated: "Corre después del alta y de cada modificación.",
  deleted: "Corre después de eliminar. Las acciones no pueden modificar el registro eliminado.",
  before_save: "Se evalúa ANTES de guardar: puede exigir campos (ej. motivo de rechazo) o impedir el cambio.",
};

const fieldKey = z.string().trim().min(1).max(80);
const text = (max: number) => z.string().trim().max(max);

export const conditionSchema = z.object({
  field: fieldKey,
  op: z.string().trim().min(1).max(30),
  value: text(500).nullable().optional(),
});
export type WorkflowCondition = z.infer<typeof conditionSchema>;

export const conditionGroupSchema = z.object({
  match: z.enum(["all", "any"]),
  conditions: z.array(z.union([conditionSchema, z.object({ match: z.enum(["all", "any"]), conditions: z.array(conditionSchema).max(20) })])).max(20),
});
export type WorkflowConditionGroup = z.infer<typeof conditionGroupSchema>;

const userId = z.string().trim().min(1).max(60);

export const actionSchema = z.discriminatedUnion("type", [
  // Solo "antes de guardar": exige que estos campos tengan valor.
  z.object({ type: z.literal("require_fields"), fields: z.array(fieldKey).min(1).max(10), message: text(200).optional().nullable() }),
  // Solo "antes de guardar": impide el cambio con este mensaje.
  z.object({ type: z.literal("block"), message: text(200).min(1) }),
  // Escribe un valor fijo (vacío = borrar) o copia otro campo del mismo registro.
  z.object({ type: z.literal("set_field"), field: fieldKey, value: text(2000).nullable().optional(), valueFrom: fieldKey.nullable().optional() }),
  z.object({ type: z.literal("assign_owner"), mode: z.enum(["fixed", "round_robin"]), userIds: z.array(userId).min(1).max(50), onlyIfUnassigned: z.boolean().default(false) }),
  z.object({
    type: z.literal("create_task"),
    title: text(160).min(1),
    dueInDays: z.number().int().min(0).max(365),
    assignTo: z.enum(["record_owner", "actor", "user"]),
    userId: userId.nullable().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  }),
  z.object({
    type: z.literal("notify"),
    recipients: z.enum(["owner", "actor", "admins", "users"]),
    userIds: z.array(userId).max(50).optional(),
    title: text(120).min(1),
    message: text(500).optional().nullable(),
  }),
  z.object({ type: z.literal("add_note"), body: text(2000).min(1) }),
  // Actualiza un campo de los registros vinculados por `via` (ver
  // relatedPathsFor en modules/automations/related.ts).
  z.object({ type: z.literal("update_related"), via: z.string().trim().min(1).max(120), field: fieldKey, value: text(2000).nullable().optional(), valueFrom: fieldKey.nullable().optional() }),
  // Email con una plantilla de Configuración → Plantillas de email, por el
  // proveedor del negocio (Resend). Destinatario: el registro (su email, o
  // el de su contacto en oportunidades), un campo email del registro, el
  // responsable o una dirección fija. Ver executeAction en workflow.ts.
  z
    .object({
      type: z.literal("send_email"),
      templateId: z.string().trim().min(1, "Elegí una plantilla").max(60),
      to: z.enum(["record", "field", "owner", "fixed"]),
      field: fieldKey.nullable().optional(),
      address: z.string().trim().email("Email inválido").max(200).nullable().optional(),
    })
    .refine((a) => a.to !== "field" || !!a.field, { message: "Elegí el campo con el email", path: ["field"] })
    .refine((a) => a.to !== "fixed" || !!a.address, { message: "Escribí la dirección", path: ["address"] }),
]);
export type WorkflowAction = z.infer<typeof actionSchema>;

export const ACTION_LABELS: Record<WorkflowAction["type"], string> = {
  require_fields: "Exigir campos obligatorios",
  block: "Impedir el cambio",
  set_field: "Actualizar un campo",
  assign_owner: "Asignar responsable",
  create_task: "Crear una tarea",
  notify: "Enviar una notificación",
  add_note: "Agregar una nota al historial",
  update_related: "Actualizar registros relacionados",
  send_email: "Enviar un email",
};

/** Acciones válidas según el disparador. */
export const BEFORE_SAVE_ACTIONS = new Set<WorkflowAction["type"]>(["require_fields", "block"]);

export const workflowConfigSchema = z
  .object({
    trigger: z.object({ event: z.enum(WORKFLOW_EVENTS), field: fieldKey.nullable().optional() }),
    conditions: conditionGroupSchema.default({ match: "all", conditions: [] }),
    actions: z.array(actionSchema).min(1, "Agregá al menos una acción").max(10),
    /** Si una acción falla, no seguir con las siguientes. */
    stopOnError: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    c.actions.forEach((a, i) => {
      const beforeSave = c.trigger.event === "before_save";
      if (beforeSave && !BEFORE_SAVE_ACTIONS.has(a.type)) {
        ctx.addIssue({ code: "custom", path: ["actions", i], message: "Antes de guardar solo se puede exigir campos o impedir el cambio." });
      }
      if (!beforeSave && BEFORE_SAVE_ACTIONS.has(a.type)) {
        ctx.addIssue({ code: "custom", path: ["actions", i], message: "Exigir campos e impedir cambios solo funcionan con el disparador «Antes de guardar»." });
      }
      if (c.trigger.event === "deleted" && (a.type === "set_field" || a.type === "assign_owner" || a.type === "add_note")) {
        ctx.addIssue({ code: "custom", path: ["actions", i], message: "Un registro eliminado no se puede modificar." });
      }
      if ((a.type === "set_field" || a.type === "update_related") && a.valueFrom && a.value) {
        ctx.addIssue({ code: "custom", path: ["actions", i], message: "Elegí un valor fijo o copiar de otro campo, no ambos." });
      }
      if (a.type === "create_task" && a.assignTo === "user" && !a.userId) {
        ctx.addIssue({ code: "custom", path: ["actions", i], message: "Elegí a quién asignar la tarea." });
      }
      if (a.type === "notify" && a.recipients === "users" && !a.userIds?.length) {
        ctx.addIssue({ code: "custom", path: ["actions", i], message: "Elegí a quién notificar." });
      }
    });
  });
export type WorkflowConfig = z.infer<typeof workflowConfigSchema>;

export const workflowRuleCreateSchema = z.object({
  type: z.literal("workflow"),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().optional(),
  module: z.union([z.enum(["lead", "contact", "company", "opportunity", "task"]), z.string().regex(/^cm:[a-z0-9]{10,40}$/)]),
  config: workflowConfigSchema,
});

/** Profundidad máxima de una cadena de automatizaciones. */
export const MAX_CHAIN_DEPTH = 3;
