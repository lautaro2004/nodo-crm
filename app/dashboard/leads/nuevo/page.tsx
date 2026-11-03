import { resolveWorkspaceContext } from "@/lib/workspace";
import { listCompanies } from "@/modules/companies/service";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { PageHeader } from "@/components/ui/primitives";
import { LeadForm } from "@/components/leads/lead-form";
import { can, resolveAccess } from "@/modules/access/service";
import { customFieldsForForm } from "@/modules/custom-fields/service";
import { NoAccess } from "@/components/team/admin-only";

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<{ name?: string; phone?: string; companyId?: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  if (!can(await resolveAccess(ctx.businessId, ctx.userId, ctx.role), "lead", "create")) return <NoAccess what="crear registros acá" />;

  const [companies, statuses] = await Promise.all([
    listCompanies(ctx.businessId),
    listStatusDefinitions(ctx.businessId, "lead"),
  ]);

  const sp = await searchParams;
  const initial = {
    name: sp.name?.slice(0, 200) ?? "",
    phone: sp.phone?.slice(0, 50) ?? "",
    // Solo se precarga una empresa del propio workspace (el select ignora ids ajenos).
    companyId: companies.some((c) => c.id === sp.companyId) ? (sp.companyId ?? "") : "",
  };

  return (
    <div>
      <PageHeader title="Nuevo lead" />
      <LeadForm initial={initial} customFields={await customFieldsForForm(ctx.businessId, "lead")}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        statusOptions={statuses.map((s) => ({ key: s.key, label: s.label }))}
      />
    </div>
  );
}
