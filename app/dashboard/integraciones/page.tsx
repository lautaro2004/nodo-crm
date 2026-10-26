import { resolveWorkspaceContext } from "@/lib/workspace";
import { Card, PageHeader, SectionTitle } from "@/components/ui/primitives";
import { GoogleIntegrations } from "@/components/configuracion/google-integrations";
import { LeadIntegrations } from "@/components/integrations/lead-integrations";
import { integrationsEnvironment, listIntegrations } from "@/modules/integrations/service";
import { leadCustomFields } from "@/modules/integrations/sheets";
import { canAdminister, resolveAccess } from "@/modules/access/service";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  const canManage = canAdminister(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "settings");
  const [integrations, customFields] = canManage ? await Promise.all([listIntegrations(ctx.businessId), leadCustomFields(ctx.businessId)]) : [[], []];

  return (
    <div>
      <PageHeader
        title="Integraciones"
        description="Conectá las fuentes de donde llegan tus leads y tu cuenta de Google."
      />
      <div className="space-y-8">
        <section>
          <SectionTitle>Captura automática de leads</SectionTitle>
          {canManage ? (
            <LeadIntegrations
              initial={integrations}
              environment={integrationsEnvironment()}
              customFields={customFields.map((f) => ({ id: f.id, label: f.label }))}
            />
          ) : (
            <Card className="p-4 text-sm text-slate-600">Solo los dueños o administradores del espacio pueden configurar estas integraciones.</Card>
          )}
        </section>
        <section>
          <SectionTitle>Google (Gmail y Calendar)</SectionTitle>
          <Card className="p-4">
            <GoogleIntegrations />
          </Card>
        </section>
      </div>
    </div>
  );
}
