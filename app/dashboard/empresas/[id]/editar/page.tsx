import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getCompany } from "@/modules/companies/service";
import { listStatusOptions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/companies/company-form";
import { can, canSeeRecord, resolveAccess } from "@/modules/access/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const [company, statusOptions] = await Promise.all([getCompany(ctx.businessId, id), listStatusOptions(ctx.businessId, "company")]);
  if (!company) notFound();
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (!canSeeRecord(access, "company", company)) notFound();
  if (!can(access, "company", "edit")) return <NoAccess what="editar este registro" />;

  return (
    <div>
      <PageHeader title={`Editar — ${company.name}`} />
      <CompanyForm
        companyId={company.id}
        statusOptions={statusOptions}
        initial={{ name: company.name, domain: company.domain ?? "", phone: company.phone ?? "", status: company.status }}
      />
    </div>
  );
}
