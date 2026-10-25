import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canAdmin, type AccessPolicy } from "@/lib/access";
import { isKnownEntityType } from "@/lib/entities";
import { moduleIdFromEntityType } from "@/lib/custom-modules";
import { CONFIG_SCHEMAS, type AutomationType } from "@/modules/automations/config";
import { workflowConfigSchema, type WorkflowAction, type WorkflowConfig } from "@/modules/automations/workflow-config";
import { validateGroup } from "@/modules/automations/conditions";
import { relatedPathsFor } from "@/modules/automations/related";
import { getFieldMap, getModuleDescriptor } from "@/modules/entities/registry";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { assertValidStatus } from "@/modules/status-definitions/service";

type Actor = { userId: string; role: string; access?: { policy: AccessPolicy } };

// Gestión de reglas: permiso administrativo "Automatizaciones" (por
// defecto, dueños/administradores — ver lib/access.ts).
export function canManageAutomations(actor: string | Actor) {
  if (typeof actor !== "string" && actor.access) return canAdmin(actor.access.policy, "automations");
  const role = typeof actor === "string" ? actor : actor.role;
  return role === "owner" || role === "admin";
}

/** Error de configuración con mensaje para mostrar en el constructor. */
export class WorkflowConfigError extends Error {
  constructor(public detail: string) {
    super("invalid_config");
  }
}

/**
 * Valida una regla genérica contra el módulo REAL del negocio: que el
 * módulo exista, que cada campo exista y su operador corresponda al tipo,
 * que los campos a escribir sean escribibles, que los usuarios sean
 * miembros y que las relaciones de "Actualizar relacionados" existan.
 */
export async function validateWorkflow(businessId: string, module: string, config: WorkflowConfig) {
  if (!isKnownEntityType(module)) throw new WorkflowConfigError("Módulo inválido.");
  const moduleId = moduleIdFromEntityType(module);
  if (moduleId && !(await prisma.customModule.count({ where: { id: moduleId, businessId } }))) throw new Error("module_not_found");
  const fields = await getFieldMap(businessId, module);
  if (config.trigger.field && !fields.has(config.trigger.field)) throw new WorkflowConfigError("El campo del disparador ya no existe.");
  const allowChangeOps = config.trigger.event === "updated" || config.trigger.event === "created_or_updated" || config.trigger.event === "before_save";
  const condError = validateGroup(config.conditions, fields, { allowChangeOps });
  if (condError) throw new WorkflowConfigError(condError);

  const checkWritable = async (target: string, key: string) => {
    const map = target === module ? fields : await getFieldMap(businessId, target);
    const meta = map.get(key);
    if (!meta) throw new WorkflowConfigError("Uno de los campos a actualizar ya no existe.");
    if (!meta.writable) throw new WorkflowConfigError(`«${meta.label}» no se puede modificar desde una automatización.`);
  };
  const users = (a: WorkflowAction): string[] =>
    a.type === "assign_owner" ? a.userIds : a.type === "create_task" && a.userId ? [a.userId] : a.type === "notify" ? (a.userIds ?? []) : [];

  for (const action of config.actions) {
    for (const u of users(action)) await assertUserBelongsToBusiness(businessId, u);
    if (action.type === "require_fields") for (const f of action.fields) if (!fields.has(f)) throw new WorkflowConfigError("Uno de los campos obligatorios ya no existe.");
    if (action.type === "set_field") {
      await checkWritable(module, action.field);
      if (action.valueFrom && !fields.has(action.valueFrom)) throw new WorkflowConfigError("El campo a copiar ya no existe.");
    }
    if (action.type === "update_related") {
      const path = (await relatedPathsFor(businessId, module)).find((p) => p.via === action.via);
      if (!path) throw new WorkflowConfigError("La relación elegida ya no existe.");
      await checkWritable(path.target, action.field);
      if (action.valueFrom && !fields.has(action.valueFrom)) throw new WorkflowConfigError("El campo a copiar ya no existe.");
    }
    if ((action.type === "set_field" || action.type === "update_related") && action.value) {
      // Un valor fijo en un campo de lista tiene que ser una opción válida.
      const target = action.type === "update_related" ? (await relatedPathsFor(businessId, module)).find((p) => p.via === action.via)!.target : module;
      const desc = await getModuleDescriptor(businessId, target);
      const meta = desc?.fields.find((f) => f.key === action.field);
      if (meta?.type === "select" && meta.options?.length && !meta.options.some((o) => o.value === action.value)) {
        throw new WorkflowConfigError(`«${action.value}» no es una opción de «${meta.label}».`);
      }
    }
  }
}

async function validateReferences(businessId: string, type: AutomationType, config: Record<string, unknown>) {
  if (type === "assign_lead") {
    for (const u of config.userIds as string[]) await assertUserBelongsToBusiness(businessId, u);
  }
  if (type === "lead_status_change") {
    await assertValidStatus(businessId, "lead", config.toStatus as string);
    if (config.fromStatus) await assertValidStatus(businessId, "lead", config.fromStatus as string);
    if (config.assignTo) await assertUserBelongsToBusiness(businessId, config.assignTo as string);
  }
}

export async function listRules(businessId: string) {
  return prisma.automationRule.findMany({ where: { businessId }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] });
}

export async function listRecentRuns(businessId: string, limit = 30, filters: { ruleId?: string; status?: string } = {}) {
  return prisma.automationRun.findMany({
    where: { businessId, ...(filters.ruleId ? { ruleId: filters.ruleId } : {}), ...(filters.status ? { status: filters.status } : {}) },
    include: { rule: { select: { name: true, module: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 200),
  });
}

/** Resumen por regla (últimos 30 días): ejecuciones, errores y última ejecución. */
export async function runStatsByRule(businessId: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await prisma.automationRun.groupBy({
    by: ["ruleId", "status"],
    where: { businessId, createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const out: Record<string, { total: number; errors: number; blocked: number; lastAt: Date | null }> = {};
  for (const r of rows) {
    const s = (out[r.ruleId] ??= { total: 0, errors: 0, blocked: 0, lastAt: null });
    s.total += r._count._all;
    if (r.status === "error") s.errors += r._count._all;
    if (r.status === "blocked") s.blocked += r._count._all;
    if (r._max.createdAt && (!s.lastAt || r._max.createdAt > s.lastAt)) s.lastAt = r._max.createdAt;
  }
  return out;
}

export async function createRule(
  businessId: string,
  actor: Actor,
  data: { type: AutomationType | "workflow"; name: string; enabled?: boolean; module?: string; config: Record<string, unknown> }
) {
  if (!canManageAutomations(actor)) throw new Error("forbidden");
  if (data.type === "workflow") {
    const config = workflowConfigSchema.parse(data.config);
    await validateWorkflow(businessId, data.module!, config);
    return prisma.automationRule.create({
      data: { businessId, type: "workflow", module: data.module!, name: data.name, enabled: data.enabled ?? true, config: config as unknown as Prisma.InputJsonValue, createdBy: actor.userId },
    });
  }
  await validateReferences(businessId, data.type, data.config);
  return prisma.automationRule.create({
    data: { businessId, type: data.type, name: data.name, enabled: data.enabled ?? true, config: data.config as Prisma.InputJsonValue, createdBy: actor.userId },
  });
}

export async function updateRule(
  businessId: string,
  id: string,
  actor: Actor,
  data: { name?: string; enabled?: boolean; config?: unknown }
) {
  if (!canManageAutomations(actor)) throw new Error("forbidden");
  const rule = await prisma.automationRule.findFirst({ where: { id, businessId } });
  if (!rule) return null;
  let config: Record<string, unknown> | undefined;
  if (data.config !== undefined && rule.type === "workflow") {
    const parsed = workflowConfigSchema.safeParse(data.config);
    if (!parsed.success) throw new WorkflowConfigError(parsed.error.issues[0]?.message ?? "Configuración inválida.");
    await validateWorkflow(businessId, rule.module ?? "", parsed.data);
    config = parsed.data as unknown as Record<string, unknown>;
  } else if (data.config !== undefined) {
    const parsed = CONFIG_SCHEMAS[rule.type as AutomationType]?.safeParse(data.config);
    if (!parsed?.success) throw new Error("invalid_config");
    config = parsed.data as Record<string, unknown>;
    await validateReferences(businessId, rule.type as AutomationType, config);
  }
  return prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      ...(config ? { config: config as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function deleteRule(businessId: string, id: string, actor: Actor) {
  if (!canManageAutomations(actor)) throw new Error("forbidden");
  const r = await prisma.automationRule.deleteMany({ where: { id, businessId } });
  return r.count > 0;
}
