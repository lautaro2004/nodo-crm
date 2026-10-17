import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CONFIG_SCHEMAS, type AutomationType } from "@/modules/automations/config";
import { assertUserBelongsToBusiness } from "@/modules/business/members";
import { assertValidStatus } from "@/modules/status-definitions/service";

// Gestión de reglas: solo dueños/administradores del espacio.
export function canManageAutomations(role: string) {
  return role === "owner" || role === "admin";
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

export async function listRecentRuns(businessId: string, limit = 30) {
  return prisma.automationRun.findMany({
    where: { businessId },
    include: { rule: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function createRule(
  businessId: string,
  actor: { userId: string; role: string },
  data: { type: AutomationType; name: string; enabled?: boolean; config: Record<string, unknown> }
) {
  if (!canManageAutomations(actor.role)) throw new Error("forbidden");
  await validateReferences(businessId, data.type, data.config);
  return prisma.automationRule.create({
    data: { businessId, type: data.type, name: data.name, enabled: data.enabled ?? true, config: data.config as Prisma.InputJsonValue, createdBy: actor.userId },
  });
}

export async function updateRule(
  businessId: string,
  id: string,
  actor: { userId: string; role: string },
  data: { name?: string; enabled?: boolean; config?: unknown }
) {
  if (!canManageAutomations(actor.role)) throw new Error("forbidden");
  const rule = await prisma.automationRule.findFirst({ where: { id, businessId } });
  if (!rule) return null;
  let config: Record<string, unknown> | undefined;
  if (data.config !== undefined) {
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

export async function deleteRule(businessId: string, id: string, actor: { role: string }) {
  if (!canManageAutomations(actor.role)) throw new Error("forbidden");
  const r = await prisma.automationRule.deleteMany({ where: { id, businessId } });
  return r.count > 0;
}
