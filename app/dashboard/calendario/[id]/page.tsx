import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getEvent } from "@/modules/calendar/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { listLeads } from "@/modules/leads/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { EventForm } from "@/components/calendar/event-form";
import { EventActions } from "@/components/calendar/event-actions";
import { CALENDAR_EVENT_STATUS_LABELS } from "@/lib/labels";
import { dayKey, timeLabel } from "@/lib/calendar-dates";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const event = await getEvent(ctx.businessId, id);
  if (!event) notFound();

  const [members, companies, contacts, leads, opportunities] = await Promise.all([
    listWorkspaceMembers(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
    listLeads(ctx.businessId),
    listOpportunities(ctx.businessId),
  ]);

  return (
    <div>
      <PageHeader
        title={event.title}
        backHref="/dashboard/calendario"
        actions={
          <Badge variant={event.status === "cancelled" ? "danger" : event.status === "completed" ? "success" : "brand"}>
            {CALENDAR_EVENT_STATUS_LABELS[event.status] ?? event.status}
          </Badge>
        }
      />
      <Card className="mb-6 p-4">
        <EventActions eventId={event.id} status={event.status} />
      </Card>
      <EventForm
        eventId={event.id}
        initial={{
          title: event.title,
          description: event.description ?? "",
          type: event.type,
          date: dayKey(event.startsAt),
          startTime: timeLabel(event.startsAt),
          endTime: timeLabel(event.endsAt),
          location: event.location ?? "",
          ownerId: event.ownerId ?? "",
          companyId: event.companyId ?? "",
          contactId: event.contactId ?? "",
          leadId: event.leadId ?? "",
          opportunityId: event.opportunityId ?? "",
        }}
        members={members}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
        leads={leads.map((l) => ({ id: l.id, name: l.name }))}
        opportunities={opportunities.map((o) => ({ id: o.id, name: o.title }))}
      />
    </div>
  );
}
