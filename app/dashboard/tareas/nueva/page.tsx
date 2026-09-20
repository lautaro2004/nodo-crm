import { resolveWorkspaceContext } from "@/lib/workspace";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { listLeads } from "@/modules/leads/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { PageHeader } from "@/components/ui/primitives";
import { TaskForm } from "@/components/tasks/task-form";

export default async function NewTaskPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const [members, companies, contacts, leads, opportunities] = await Promise.all([
    listWorkspaceMembers(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
    listLeads(ctx.businessId),
    listOpportunities(ctx.businessId),
  ]);

  return (
    <div>
      <PageHeader title="Nueva tarea" />
      <TaskForm
        members={members}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        leads={leads.map((l) => ({ id: l.id, name: l.name }))}
        opportunities={opportunities.map((o) => ({ id: o.id, name: o.title }))}
      />
    </div>
  );
}
