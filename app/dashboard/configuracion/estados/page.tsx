import { resolveWorkspaceContext } from "@/lib/workspace";
import { AdminOnly } from "@/components/team/admin-only";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { StatusDefinitionsManager } from "@/components/configuracion/status-definitions-manager";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export default async function StatusDefinitionsSettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return <AdminOnly />;

  const statuses = await listStatusDefinitions(ctx.businessId);

  return (
    <div>
      <PageHeader title="Estados" description="Estados configurables por tu Workspace para Leads y Empresas." />
      <StatusDefinitionsManager statuses={statuses} />
    </div>
  );
}
