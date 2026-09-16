import { resolveWorkspaceContext } from "@/lib/workspace";
import { listCompanies } from "@/modules/companies/service";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { LeadForm } from "@/components/leads/lead-form";

export default async function NewLeadPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [companies, statuses] = await Promise.all([
    listCompanies(ctx.businessId),
    listStatusDefinitions(ctx.businessId, "lead"),
  ]);

  return (
    <div>
      <PageHeader title="Nuevo lead" />
      <LeadForm
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        statusOptions={statuses.map((s) => ({ key: s.key, label: s.label }))}
      />
    </div>
  );
}
