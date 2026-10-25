import { resolveWorkspaceContext } from "@/lib/workspace";
import { AdminOnly } from "@/components/team/admin-only";
import { getEmailSettings } from "@/modules/email/settings";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EmailSettingsForm } from "@/components/email/email-settings-form";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export default async function EmailSettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings")) return <AdminOnly />;

  const { settings, status } = await getEmailSettings(ctx.businessId);

  return (
    <div>
      <PageHeader title="Email" description="Remitente y proveedor con los que este negocio envía correos desde el CRM." backHref="/dashboard/configuracion" />
      <Card className="p-4">
        <EmailSettingsForm
          status={status}
          initial={{ provider: settings?.provider ?? "sandbox", fromEmail: settings?.fromEmail ?? "", fromName: settings?.fromName ?? "" }}
        />
      </Card>
    </div>
  );
}
