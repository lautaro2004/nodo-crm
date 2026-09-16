import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getLead } from "@/modules/leads/service";
import { listCompanies } from "@/modules/companies/service";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { LeadForm } from "@/components/leads/lead-form";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const [lead, companies, statuses] = await Promise.all([
    getLead(ctx.businessId, id),
    listCompanies(ctx.businessId),
    listStatusDefinitions(ctx.businessId, "lead"),
  ]);
  if (!lead) notFound();

  return (
    <div>
      <PageHeader title={`Editar — ${lead.name}`} />
      <LeadForm
        leadId={lead.id}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        statusOptions={statuses.map((s) => ({ key: s.key, label: s.label }))}
        initial={{
          name: lead.name,
          email: lead.email ?? "",
          phone: lead.phone ?? "",
          companyId: lead.companyId ?? "",
          status: lead.status,
        }}
      />
    </div>
  );
}
