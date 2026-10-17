import { resolveWorkspaceContext } from "@/lib/workspace";
import { listRecentRuns, listRules, canManageAutomations } from "@/modules/automations/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { AutomationsManager } from "@/components/automations/automations-manager";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";

export default async function AutomationsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [rules, runs, members, statuses] = await Promise.all([
    listRules(ctx.businessId),
    listRecentRuns(ctx.businessId, 40),
    listWorkspaceMembers(ctx.businessId),
    listStatusOptions(ctx.businessId, "lead"),
  ]);

  return (
    <div>
      <PageHeader
        title="Automatizaciones"
        description="Reglas que asignan leads, avisan cuando un lead queda sin atención y actúan al cambiar de estado."
        backHref="/dashboard/configuracion"
        backLabel="Configuración"
      />
      <AutomationsManager
        canManage={canManageAutomations(ctx.role)}
        rules={rules.map((r) => ({ id: r.id, name: r.name, type: r.type, enabled: r.enabled, config: r.config as Record<string, unknown> }))}
        runs={runs.map((r) => ({
          id: r.id,
          ruleName: r.rule.name,
          status: r.status,
          message: r.message,
          entityId: r.entityId,
          createdAt: r.createdAt.toISOString(),
        }))}
        members={members.map((m) => ({ value: m.userId, label: m.name || m.email }))}
        statuses={statuses.filter((s) => s.key !== "converted").map((s) => ({ value: s.key, label: s.label }))}
        sources={Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
      />
    </div>
  );
}
