import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { can, canAdminister, canSeeRecord, resolveAccess } from "@/modules/access/service";
import { hasRole } from "@/lib/permissions";
import { getModuleLabel } from "@/modules/workspace/module-config";
import { DeleteRecordButton } from "@/components/records/delete-record-button";
import { RECORD_NOUNS, nounFromLabels } from "@/lib/record-nouns";
import { getCustomFieldsForEntity } from "@/modules/custom-fields/service";
import { CustomFieldsCard } from "@/components/custom-fields/custom-fields-card";
import { RelatedGroups } from "@/components/custom-modules/related-groups";
import { incomingLinks } from "@/modules/records/links";
import { OpportunityItemsCard } from "@/components/opportunities/opportunity-items-card";
import { loadOpportunityItemsView } from "@/modules/opportunity-items/view";
import { getOpportunity } from "@/modules/opportunities/service";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { listTags, listTagsForEntity } from "@/modules/tags/service";
import { Button, Card, PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { AddActivityForm } from "@/components/activities/add-activity-form";
import { TagPicker } from "@/components/tags/tag-picker";
import { StatusSelect } from "@/components/shared/status-select";
import { stageColorKey } from "@/lib/status-colors";
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
  // Permisos: ver el módulo y el registro (alcance todos/equipo/propios).
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (!canSeeRecord(access, "opportunity", opportunity)) notFound();
  const canEdit = can(access, "opportunity", "edit");

  const [activities, assignedTags, allTags, members, upcomingEvents, emailTemplates, customFields, itemsView, relatedGroups] = await Promise.all([
    listActivitiesForEntity(ctx.businessId, "opportunity", id),
    listTagsForEntity(ctx.businessId, "opportunity", id),
    listTags(ctx.businessId),
    listWorkspaceMembers(ctx.businessId),
    listUpcomingEvents(ctx.businessId, { opportunityId: id }),
    listTemplates(ctx.businessId),
    getCustomFieldsForEntity(ctx.businessId, "opportunity", id),
    loadOpportunityItemsView(ctx.businessId, id),
    incomingLinks(ctx.businessId, "opportunity", id, (t) => can(access, t, "view")),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  const moduleLabel = hasRole(ctx.role, "admin") ? await getModuleLabel(ctx.businessId, "opportunity") : null;

  return (
    <div>
      <PageHeader
        title={opportunity.title}
        description={opportunity.company?.name}
        backHref="/dashboard/oportunidades"
        actions={
          <div className="flex items-center gap-2">
            <SendEmailAction entityType="opportunity" entityId={id} templates={emailTemplates.map((t) => ({ id: t.id, name: t.name }))} />
            {canEdit && (
              <Link href={`/dashboard/oportunidades/${id}/editar`}>
                <Button variant="secondary">Editar</Button>
              </Link>
            )}
            {can(access, "opportunity", "delete") && (
              <DeleteRecordButton
                entityType="opportunity"
                id={id}
                noun={moduleLabel ? nounFromLabels(moduleLabel.labelSingular, moduleLabel.labelPlural) : RECORD_NOUNS.opportunity}
                redirectTo="/dashboard/oportunidades"
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 2xl:grid-cols-4">
        <div className="space-y-6 lg:col-span-2 2xl:col-span-3">
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
                  <StatusSelect
                    apiPath={`/api/opportunities/${id}`}
                    field="stageId"
                    label="Etapa"
                    value={opportunity.stageId}
                    options={opportunity.pipeline.stages.map((s) => ({ key: s.id, label: s.label, color: stageColorKey(s) }))}
                  />
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
                <OwnerAssign apiPath={`/api/opportunities/${id}`} ownerId={opportunity.ownerId} members={members} />
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Etiquetas</p>
              <TagPicker entityType="opportunity" entityId={id} assigned={assignedTags} allTags={allTags} />
            </div>
          </Card>

          <OpportunityItemsCard
            opportunityId={id}
            open={opportunity.status === "open"}
            amount={opportunity.amount}
            items={itemsView.items}
            modules={itemsView.modules}
          />

          <CustomFieldsCard entityId={id} fields={customFields} canManage={canAdminister(access, "fields")} readOnly={!canEdit} />

          <RelatedGroups groups={relatedGroups} emptyText={null} />

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
