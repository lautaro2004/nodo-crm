import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { can, canAdminister, canSeeRecord, resolveAccess } from "@/modules/access/service";
import { getCompany } from "@/modules/companies/service";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { listTags, listTagsForEntity } from "@/modules/tags/service";
import { getCustomFieldsForEntity } from "@/modules/custom-fields/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { Button, Card, PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { AddActivityForm } from "@/components/activities/add-activity-form";
import { TagPicker } from "@/components/tags/tag-picker";
import { CustomFieldsCard } from "@/components/custom-fields/custom-fields-card";
import { RelatedGroups } from "@/components/custom-modules/related-groups";
import { incomingLinks } from "@/modules/records/links";
import { DeleteRecordButton } from "@/components/records/delete-record-button";
import { RECORD_NOUNS } from "@/lib/record-nouns";
import { RelatedEventsList } from "@/components/calendar/related-events-list";
import { listUpcomingEvents } from "@/modules/calendar/service";
import { RelatedTasksList } from "@/components/tasks/related-tasks-list";
import { listStatusOptions, findStatusOption } from "@/modules/status-definitions/service";
import { StatusBadge } from "@/components/status/status-badge";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const company = await getCompany(ctx.businessId, id);
  if (!company) notFound();
  // Permisos: ver el módulo y el registro (alcance todos/equipo/propios).
  const access = await resolveAccess(ctx.businessId, ctx.userId, ctx.role);
  if (!canSeeRecord(access, "company", company)) notFound();
  const canEdit = can(access, "company", "edit");

  const [activities, assignedTags, allTags, customFields, members, upcomingEvents, statusOptions, relatedGroups] = await Promise.all([
    listActivitiesForEntity(ctx.businessId, "company", id),
    listTagsForEntity(ctx.businessId, "company", id),
    listTags(ctx.businessId),
    getCustomFieldsForEntity(ctx.businessId, "company", id),
    listWorkspaceMembers(ctx.businessId),
    listUpcomingEvents(ctx.businessId, { companyId: id }),
    listStatusOptions(ctx.businessId, "company"),
    incomingLinks(ctx.businessId, "company", id, (t) => can(access, t, "view")),
  ]);
  const status = findStatusOption(statusOptions, company.status);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader
        title={company.name}
        description={company.domain ?? undefined}
        backHref="/dashboard/empresas"
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href={`/dashboard/empresas/${id}/editar`}>
                <Button variant="secondary">Editar</Button>
              </Link>
            )}
            {can(access, "company", "delete") && <DeleteRecordButton entityType="company" id={id} noun={RECORD_NOUNS.company} redirectTo="/dashboard/empresas" />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 2xl:grid-cols-4">
        <div className="space-y-6 lg:col-span-2 2xl:col-span-3">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Información</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Estado</dt>
                <dd className="mt-0.5">
                  <StatusBadge label={status.label} color={status.color} />
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Teléfono</dt>
                <dd className="mt-0.5 text-slate-900">{company.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Creada</dt>
                <dd className="mt-0.5 text-slate-900">{company.createdAt.toLocaleDateString("es-AR")}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Etiquetas</p>
              <TagPicker entityType="company" entityId={id} assigned={assignedTags} allTags={allTags} />
            </div>
          </Card>

          <CustomFieldsCard entityId={id} fields={customFields} canManage={canAdminister(access, "fields")} readOnly={!canEdit} />

          <RelatedGroups groups={relatedGroups} emptyText={null} />

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Relaciones</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
              <RelationList title="Contactos" items={company.contacts.map((c) => ({ id: c.id, label: c.name }))} basePath="/dashboard/contactos" />
              <RelationList title="Leads" items={company.leads.map((l) => ({ id: l.id, label: l.name }))} basePath="/dashboard/leads" />
              <RelationList
                title="Oportunidades"
                items={company.opportunities.map((o) => ({ id: o.id, label: o.title }))}
                basePath="/dashboard/oportunidades"
              />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Tareas relacionadas</h2>
            <RelatedTasksList tasks={company.tasks} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximas actividades</h2>
            <RelatedEventsList events={upcomingEvents} entity="companyId" entityId={id} returnTo={`/dashboard/empresas/${id}`} />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Actividad</h2>
          <AddActivityForm relatedType="company" relatedId={id} />
          <ActivityFeed activities={activities} memberNameById={memberNameById} />
        </div>
      </div>
    </div>
  );
}

function RelationList({ title, items, basePath }: { title: string; items: { id: string; label: string }[]; basePath: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-slate-400">—</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`${basePath}/${item.id}`} className="text-slate-700 hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
