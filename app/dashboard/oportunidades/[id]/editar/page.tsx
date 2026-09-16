import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getOpportunity } from "@/modules/opportunities/service";
import { listPipelines } from "@/modules/pipelines/service";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { PageHeader } from "@/components/ui/primitives";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const [opportunity, pipelines, companies, contacts] = await Promise.all([
    getOpportunity(ctx.businessId, id),
    listPipelines(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
  ]);
  if (!opportunity) notFound();

  return (
    <div>
      <PageHeader title={`Editar — ${opportunity.title}`} />
      <OpportunityForm
        opportunityId={opportunity.id}
        pipelines={pipelines.map((p) => ({ id: p.id, name: p.name, stages: p.stages }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          title: opportunity.title,
          companyId: opportunity.companyId ?? "",
          contactId: opportunity.contactId ?? "",
          pipelineId: opportunity.pipelineId,
          stageId: opportunity.stageId,
          amount: opportunity.amount?.toString() ?? "",
        }}
      />
    </div>
  );
}
