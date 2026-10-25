import { resolveWorkspaceContext } from "@/lib/workspace";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/companies/company-form";
import { can, resolveAccess } from "@/modules/access/service";
import { customFieldsForForm } from "@/modules/custom-fields/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function NewCompanyPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!can(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "company", "create")) return <NoAccess what="crear registros acá" />;
  const statusOptions = await listStatusOptions(ctx.businessId, "company");

  return (
    <div>
      <PageHeader title="Nueva empresa" backHref="/dashboard/empresas" />
      <CompanyForm customFields={await customFieldsForForm(ctx.businessId, "company")} statusOptions={statusOptions} />
    </div>
  );
}
