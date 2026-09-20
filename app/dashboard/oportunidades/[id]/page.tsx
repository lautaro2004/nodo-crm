import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getOpportunity } from "@/modules/opportunities/service";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { listTags, listTagsForEntity } from "@/modules/tags/service";
import { Badge, Button, Card, PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { AddActivityForm } from "@/components/activities/add-activity-form";
import { TagPicker } from "@/components/tags/tag-picker";
import { StatusSelect } from "@/components/shared/status-select";
import { OwnerAssign } from "@/components/shared/owner-assign";
import { SendEmailAction } from "@/components/email/send-email-action";
import { listTemplates } from "@/modules/email/templates";
import { RelatedEventsList } from "@/components/calendar/related-events-list";
import { listUpcomingEvents } from "@/modules/calendar/service";
import { RelatedTasksList } from "@/components/tasks/related-tasks-list";
import { listWorkspaceMembers } from "@/modules/business/members";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const opportunity = await getOpportunity(ctx.businessId, id);
  if (!opportunity) notFound();

  const [activities, assignedTags, allTags, members, upcomingEvents, emailTemplates] = await Promise.all([
    listActivitiesForEntity(ctx.businessId, "opportunity", id),
    listTagsForEntity(ctx.businessId, "opportunity", id),
    listTags(ctx.businessId),
    listWorkspaceMembers(ctx.businessId),
    listUpcomingEvents(ctx.businessId, { opportunityId: id }),
    listTemplates(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader
        title={opportunity.title}
        description={opportunity.company?.name}
        backHref="/dashboard/oportunidades"
        actions={
          <div className="flex items-center gap-2">
            <SendEmailAction entityType="opportunity" entityId={id} templates={emailTemplates.map((t) => ({ id: t.id, name: t.name }))} />
            <Link href={`/dashboard/oportunidades/${id}/editar`}>
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
                <dt className="text-slate-500">Valor</dt>
                <dd className="mt-0.5 text-slate-900">
                  {opportunity.amount !== null ? `$${opportunity.amount.toLocaleString("es-AR")}` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Pipeline</dt>
                <dd className="mt-0.5 text-slate-900">{opportunity.pipeline.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Etapa</dt>
                <dd className="mt-0.5">
                  <Badge>{opportunity.stage.label}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Contacto</dt>
                <dd className="mt-0.5">
                  {opportunity.contact ? (
                    <Link href={`/dashboard/contactos/${opportunity.contact.id}`} className="text-slate-900 underline">
                      {opportunity.contact.name}
                    </Link>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
                <StatusSelect
                  apiPath={`/api/opportunities/${id}`}
                  value={opportunity.status}
                  options={Object.entries(OPPORTUNITY_STATUS_LABELS).map(([key, label]) => ({ key, label }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Responsable</p>
                <OwnerAssign apiPath={`/api/opportunities/${id}`} ownerId={opportunity.ownerId} />
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Etiquetas</p>
              <TagPicker entityType="opportunity" entityId={id} assigned={assignedTags} allTags={allTags} />
            </div>
          </Card>

          {opportunity.convertedFromLead && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Origen</h2>
              <p className="text-sm text-slate-700">
                Lead convertido:{" "}
                <Link href={`/dashboard/leads/${opportunity.convertedFromLead.id}`} className="text-slate-900 underline">
                  {opportunity.convertedFromLead.name}
                </Link>
              </p>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Tareas relacionadas</h2>
            <RelatedTasksList tasks={opportunity.tasks} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximas actividades</h2>
            <RelatedEventsList events={upcomingEvents} entity="opportunityId" entityId={id} returnTo={`/dashboard/oportunidades/${id}`} />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
          <AddActivityForm relatedType="opportunity" relatedId={id} />
          <ActivityFeed activities={activities} memberNameById={memberNameById} />
        </div>
      </div>
    </div>
  );
}
