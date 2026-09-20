import { resolveWorkspaceContext } from "@/lib/workspace";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listCompanies } from "@/modules/companies/service";
import { listContacts } from "@/modules/contacts/service";
import { listLeads } from "@/modules/leads/service";
import { listOpportunities } from "@/modules/opportunities/service";
import { PageHeader } from "@/components/ui/primitives";
import { EventForm } from "@/components/calendar/event-form";
import { dayKey, isDayKey } from "@/lib/calendar-dates";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; companyId?: string; contactId?: string; leadId?: string; opportunityId?: string; returnTo?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const sp = await searchParams;
  const [members, companies, contacts, leads, opportunities] = await Promise.all([
    listWorkspaceMembers(ctx.businessId),
    listCompanies(ctx.businessId),
    listContacts(ctx.businessId),
    listLeads(ctx.businessId),
    listOpportunities(ctx.businessId),
  ]);

  // Los ids prefijados vienen de la URL: sólo se aceptan si existen en
  // este negocio (el POST los revalida igual, esto es sólo UX).
  const pick = (id: string | undefined, list: { id: string }[]) => (id && list.some((x) => x.id === id) ? id : "");
  // returnTo sólo puede ser una ruta interna del dashboard.
  const returnTo = sp.returnTo && /^\/dashboard\/[a-z0-9/_-]*$/i.test(sp.returnTo) ? sp.returnTo : undefined;

  return (
    <div>
      <PageHeader title="Programar actividad" backHref={returnTo ?? "/dashboard/calendario"} />
      <EventForm
        returnTo={returnTo}
        initial={{
          date: isDayKey(sp.date) ? sp.date : dayKey(new Date()),
          ownerId: ctx.userId,
          companyId: pick(sp.companyId, companies),
          contactId: pick(sp.contactId, contacts),
          leadId: pick(sp.leadId, leads),
          opportunityId: pick(sp.opportunityId, opportunities),
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
