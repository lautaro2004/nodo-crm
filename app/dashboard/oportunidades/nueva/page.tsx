import { resolveWorkspaceContext } from "@/lib/workspace";
import { listPipelines } from "@/modules/pipelines/service";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { PageHeader } from "@/components/ui/primitives";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";

export default async function NewOpportunityPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [pipelines, companies, contacts, moduleLabel] = await Promise.all([
    listPipelines(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
    getModuleLabel(ctx.businessId, "opportunity"),
  ]);

  return (
    <div>
      <PageHeader title={`Nueva ${moduleLabel.labelSingular.toLowerCase()}`} />
      <OpportunityForm
        pipelines={pipelines.map((p) => ({ id: p.id, name: p.name, stages: p.stages }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
