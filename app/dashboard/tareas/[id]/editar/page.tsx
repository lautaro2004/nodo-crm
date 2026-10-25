import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getTask } from "@/modules/tasks/service";
import { getReminderForTask } from "@/modules/reminders/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { listLeads } from "@/modules/leads/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { PageHeader } from "@/components/ui/primitives";
import { TaskForm } from "@/components/tasks/task-form";
import { can, canSeeRecord, resolveAccess } from "@/modules/access/service";
import { NoAccess } from "@/components/team/admin-only";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function toDateTimeInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 16) : "";
}

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const [task, members, companies, contacts, leads, opportunities, reminder] = await Promise.all([
    getTask(ctx.businessId, id),
    listWorkspaceMembers(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
    listLeads(ctx.businessId),
    listOpportunities(ctx.businessId),
    getReminderForTask(ctx.businessId, id),
  ]);
  if (!task) notFound();
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (!canSeeRecord(access, "task", task)) notFound();
  if (!can(access, "task", "edit")) return <NoAccess what="editar este registro" />;

  return (
    <div>
      <PageHeader title={`Editar — ${task.title}`} />
      <TaskForm
        taskId={task.id}
        members={members}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        leads={leads.map((l) => ({ id: l.id, name: l.name }))}
        opportunities={opportunities.map((o) => ({ id: o.id, name: o.title }))}
        initial={{
          title: task.title,
          description: task.description ?? "",
          priority: task.priority,
          startDate: toDateInputValue(task.startDate),
          dueAt: toDateTimeInputValue(task.dueAt),
          ownerId: task.ownerId ?? "",
          companyId: task.companyId ?? "",
          contactId: task.contactId ?? "",
          leadId: task.leadId ?? "",
          opportunityId: task.opportunityId ?? "",
        }}
        initialReminder={toDateTimeInputValue(reminder?.remindAt ?? null) || null}
      />
    </div>
  );
}
