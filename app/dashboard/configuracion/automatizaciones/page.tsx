import { resolveWorkspaceContext } from "@/lib/workspace";
import { listRecentRuns, listRules, canManageAutomations, runStatsByRule } from "@/modules/automations/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { getModuleCatalog } from "@/modules/entities/registry";
import { relatedPathsFor } from "@/modules/automations/related";
import { resolveAccess } from "@/modules/access/service";
import { PageHeader } from "@/components/ui/primitives";
import { AutomationsManager } from "@/components/automations/automations-manager";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";

export default async function AutomationsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);

  const [rules, runs, members, statuses, modules, stats] = await Promise.all([
    listRules(ctx.businessId),
    listRecentRuns(ctx.businessId, 100),
    listWorkspaceMembers(ctx.businessId),
    listStatusOptions(ctx.businessId, "lead"),
    getModuleCatalog(ctx.businessId),
    runStatsByRule(ctx.businessId),
  ]);
  const related = Object.fromEntries(await Promise.all(modules.map(async (m) => [m.entityType, await relatedPathsFor(ctx.businessId, m.entityType)] as const)));

  return (
    <div>
      <PageHeader
        title="Automatizaciones"
        description="Reglas que actúan solas en cualquier módulo: validan antes de guardar, asignan, notifican, crean tareas y actualizan registros relacionados."
        backHref="/dashboard/configuracion"
        backLabel="Configuración"
      />
      <AutomationsManager
        canManage={canManageAutomations({ ...ctx, access })}
        rules={rules.map((r) => ({ id: r.id, name: r.name, type: r.type, module: r.module, enabled: r.enabled, config: r.config as Record<string, unknown> }))}
        runs={runs.map((r) => ({
          id: r.id,
          ruleId: r.ruleId,
          ruleName: r.rule.name,
          status: r.status,
          message: r.message,
          entityId: r.entityId,
          entityType: r.entityType,
          trigger: r.trigger,
          depth: r.depth,
          details: (r.details as { type: string; status: string; message: string }[] | null) ?? null,
          createdAt: r.createdAt.toISOString(),
        }))}
        members={members.map((m) => ({ value: m.userId, label: m.name || m.email }))}
        statuses={statuses.filter((s) => s.key !== "converted").map((s) => ({ value: s.key, label: s.label }))}
        sources={Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
        meta={{
          modules: modules.map((m) => ({ entityType: m.entityType, singular: m.singular, plural: m.plural, href: m.href, fields: m.fields })),
          related,
          members: members.map((m) => ({ userId: m.userId, name: m.name || m.email, role: m.role })),
        }}
        stats={Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { ...v, lastAt: v.lastAt?.toISOString() ?? null }]))}
      />
    </div>
  );
}
