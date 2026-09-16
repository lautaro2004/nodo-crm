import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getCompany } from "@/modules/companies/service";
import { PageHeader } from "@/components/ui/primitives";
import { CompanyForm } from "@/components/companies/company-form";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const company = await getCompany(ctx.businessId, id);
  if (!company) notFound();

  return (
    <div>
      <PageHeader title={`Editar — ${company.name}`} />
      <CompanyForm
        companyId={company.id}
        initial={{ name: company.name, domain: company.domain ?? "", phone: company.phone ?? "", status: company.status }}
      />
    </div>
  );
}
