import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getContact } from "@/modules/contacts/service";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { listTags, listTagsForEntity } from "@/modules/tags/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { Badge, Button, Card, PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { AddActivityForm } from "@/components/activities/add-activity-form";
import { TagPicker } from "@/components/tags/tag-picker";
import { SendEmailAction } from "@/components/email/send-email-action";
import { listTemplates } from "@/modules/email/templates";
import { RelatedEventsList } from "@/components/calendar/related-events-list";
import { listUpcomingEvents } from "@/modules/calendar/service";
import { RelatedTasksList } from "@/components/tasks/related-tasks-list";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const contact = await getContact(ctx.businessId, id);
  if (!contact) notFound();

  const [activities, assignedTags, allTags, members, upcomingEvents, emailTemplates] = await Promise.all([
    listActivitiesForEntity(ctx.businessId, "contact", id),
    listTagsForEntity(ctx.businessId, "contact", id),
    listTags(ctx.businessId),
    listWorkspaceMembers(ctx.businessId),
    listUpcomingEvents(ctx.businessId, { contactId: id }),
    listTemplates(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader
        title={contact.name}
        description={contact.company?.name}
        backHref="/dashboard/contactos"
        actions={
          <div className="flex items-center gap-2">
            <SendEmailAction entityType="contact" entityId={id} templates={emailTemplates.map((t) => ({ id: t.id, name: t.name }))} />
            <Link href={`/dashboard/contactos/${id}/editar`}>
              <Button variant="secondary">Editar</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Información</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-0.5 text-slate-900">{contact.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Teléfono</dt>
                <dd className="mt-0.5 text-slate-900">{contact.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Empresa</dt>
                <dd className="mt-0.5">
                  {contact.company ? (
                    <Link href={`/dashboard/empresas/${contact.company.id}`} className="text-slate-900 underline">
                      {contact.company.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Etiquetas</p>
              <TagPicker entityType="contact" entityId={id} assigned={assignedTags} allTags={allTags} />
            </div>
          </Card>

          {contact.convertedFromLeads.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Origen</h2>
              <ul className="space-y-1 text-sm">
                {contact.convertedFromLeads.map((lead) => (
                  <li key={lead.id} className="text-slate-700">
                    Lead convertido:{" "}
                    <Link href={`/dashboard/leads/${lead.id}`} className="text-slate-900 underline">
                      {lead.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {contact.opportunities.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Oportunidades relacionadas</h2>
              <ul className="space-y-1 text-sm">
                {contact.opportunities.map((o) => (
                  <li key={o.id}>
                    <Link href={`/dashboard/oportunidades/${o.id}`} className="text-slate-700 hover:underline">
                      {o.title}
                    </Link>
                    <Badge className="ml-2">{OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Tareas relacionadas</h2>
            <RelatedTasksList tasks={contact.tasks} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximas actividades</h2>
            <RelatedEventsList events={upcomingEvents} entity="contactId" entityId={id} returnTo={`/dashboard/contactos/${id}`} />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Actividad</h2>
          <AddActivityForm relatedType="contact" relatedId={id} />
          <ActivityFeed activities={activities} memberNameById={memberNameById} />
        </div>
      </div>
    </div>
  );
}
