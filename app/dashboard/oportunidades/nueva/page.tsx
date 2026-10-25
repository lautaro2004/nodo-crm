import { resolveWorkspaceContext } from "@/lib/workspace";
import { listPipelines } from "@/modules/pipelines/service";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { PageHeader } from "@/components/ui/primitives";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { can, resolveAccess } from "@/modules/access/service";
import { customFieldsForForm } from "@/modules/custom-fields/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function NewOpportunityPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!can(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "opportunity", "create")) return <NoAccess what="crear registros acá" />;

  const [pipelines, companies, contacts, moduleLabel] = await Promise.all([
    listPipelines(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
    getModuleLabel(ctx.businessId, "opportunity"),
  ]);

  return (
    <div>
      <PageHeader title={`Nueva ${moduleLabel.labelSingular.toLowerCase()}`} />
      <OpportunityForm customFields={await customFieldsForForm(ctx.businessId, "opportunity")}
        pipelines={pipelines.map((p) => ({ id: p.id, name: p.name, stages: p.stages }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
