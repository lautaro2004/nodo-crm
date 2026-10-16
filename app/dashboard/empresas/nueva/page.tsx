import { resolveWorkspaceContext } from "@/lib/workspace";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/companies/company-form";

export default async function NewCompanyPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  const statusOptions = await listStatusOptions(ctx.businessId, "company");

  return (
    <div>
      <PageHeader title="Nueva empresa" backHref="/dashboard/empresas" />
      <CompanyForm statusOptions={statusOptions} />
    </div>
  );
}
