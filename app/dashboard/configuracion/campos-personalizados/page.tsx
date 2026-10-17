import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { AdminOnly } from "@/components/team/admin-only";
import { listCustomFieldDefinitions } from "@/modules/custom-fields/service";
import { PageHeader } from "@/components/ui/primitives";
import { CustomFieldsManager } from "@/components/custom-fields/custom-fields-manager";

export default async function CustomFieldsSettingsPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!hasRole(ctx.role, "admin")) return <AdminOnly />;

  const definitions = await listCustomFieldDefinitions(ctx.businessId);

  return (
    <div>
      <PageHeader
        title="Campos personalizados"
        description="Entidades fijas (Empresa, Contacto, Lead, Oportunidad) + campos configurables — no un constructor de objetos genérico."
      />
      <CustomFieldsManager definitions={definitions} />
    </div>
  );
}
