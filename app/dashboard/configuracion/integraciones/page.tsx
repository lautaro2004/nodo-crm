import { resolveWorkspaceContext } from "@/lib/workspace";
import { Card, PageHeader } from "@/components/ui/primitives";
import { GoogleIntegrations } from "@/components/configuracion/google-integrations";

export default async function IntegrationsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  return (
    <div>
      <PageHeader
        title="Integraciones"
        description="Conectá tu cuenta de Google una sola vez; cada función pide solo el permiso que necesita."
        backHref="/dashboard/configuracion"
      />
      <Card className="p-4">
        <GoogleIntegrations />
      </Card>
    </div>
  );
}
