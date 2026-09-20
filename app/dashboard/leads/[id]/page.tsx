import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getLead } from "@/modules/leads/service";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { listTags, listTagsForEntity } from "@/modules/tags/service";
import { getNexoAppointment } from "@/modules/nexo/appointments";
import { listContacts } from "@/modules/contacts/service";
import { listPipelines } from "@/modules/pipelines/service";
import { listWorkspaceMembers } from "@/modules/business/members";
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
import { ConvertLeadAction } from "@/components/leads/convert-lead-action";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const lead = await getLead(ctx.businessId, id);
  if (!lead) notFound();

  const [statuses, activities, assignedTags, allTags, nexoAppointment, contacts, pipelines, members, upcomingEvents, emailTemplates] = await Promise.all([
    listStatusDefinitions(ctx.businessId, "lead"),
    listActivitiesForEntity(ctx.businessId, "lead", id),
    listTagsForEntity(ctx.businessId, "lead", id),
    listTags(ctx.businessId),
    // Lectura EN VIVO del turno de Nexo (no un valor sincronizado/cacheado)
    // — si el turno se canceló o reprogramó después de crear el Lead, acá
    // se ve el estado real actual, nunca una copia desactualizada. Ver
    // docs/architecture/crm-fase4-nexo-leads.md, "Cancelación y
    // reprogramación".
    lead.source === "nexo_appointment" && lead.sourceRef
      ? getNexoAppointment(ctx.businessId, lead.sourceRef)
      : Promise.resolve(null),
    // Solo hacen falta para el wizard de conversión (Fase 5) — se piden
    // igual sin condicionar a `!lead.convertedAt`: son listados baratos y
    // mantiene el código simple; el componente que los consume ni se
    // renderiza si el Lead ya está convertido.
    listContacts(ctx.businessId),
    listPipelines(ctx.businessId),
    listWorkspaceMembers(ctx.businessId),
    listUpcomingEvents(ctx.businessId, { leadId: id }),
    listTemplates(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={lead.company?.name}
        backHref="/dashboard/leads"
        actions={
          <div className="flex items-center gap-2">
            <SendEmailAction entityType="lead" entityId={id} templates={emailTemplates.map((t) => ({ id: t.id, name: t.name }))} />
            {lead.convertedAt ? (
              <Badge variant="brand">Convertido</Badge>
            ) : (
              <ConvertLeadAction
                leadId={id}
                leadName={lead.name}
                contacts={contacts.map((c) => ({ id: c.id, name: c.name }))}
                pipelines={pipelines.map((p) => ({ id: p.id, name: p.name, stages: p.stages.map((s) => ({ id: s.id, label: s.label })) }))}
                members={members}
              />
            )}
            <Link href={`/dashboard/leads/${id}/editar`}>
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
                <dd className="mt-0.5 text-slate-900">{lead.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Teléfono</dt>
                <dd className="mt-0.5 text-slate-900">{lead.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Origen</dt>
                <dd className="mt-0.5 text-slate-900">{LEAD_SOURCE_LABELS[lead.source ?? "manual"] ?? lead.source}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Empresa</dt>
                <dd className="mt-0.5">
                  {lead.company ? (
                    <Link href={`/dashboard/empresas/${lead.company.id}`} className="text-slate-900 underline">
                      {lead.company.name}
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
                {lead.convertedAt ? (
                  <Badge variant="brand">Convertido</Badge>
                ) : (
                  <StatusSelect
                    apiPath={`/api/leads/${id}`}
                    value={lead.status}
                    options={statuses.map((s) => ({ key: s.key, label: s.label }))}
                  />
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Responsable</p>
                {lead.convertedAt ? (
                  <p className="text-sm text-slate-500">Un Lead convertido no se reasigna — el responsable ahora vive en el Contacto/Oportunidad resultante.</p>
                ) : (
                  <OwnerAssign apiPath={`/api/leads/${id}`} ownerId={lead.ownerId} />
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Etiquetas</p>
              <TagPicker entityType="lead" entityId={id} assigned={assignedTags} allTags={allTags} />
            </div>
          </Card>

          {nexoAppointment && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Origen — Nexo</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Servicio reservado</dt>
                  <dd className="mt-0.5 text-slate-900">{nexoAppointment.serviceName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Fecha de reserva</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {nexoAppointment.date} · {nexoAppointment.startTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Estado del turno en Nexo</dt>
                  <dd className="mt-0.5">
                    <Badge>{nexoAppointment.status}</Badge>
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-slate-400">
                Se lee en vivo desde Nexo — si el turno se cancela o reprograma ahí, se refleja acá al recargar la página.
              </p>
            </Card>
          )}

          {lead.convertedAt && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Convertido en</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-slate-500">Contacto</dt>
                  <dd className="mt-0.5">
                    {lead.convertedContact ? (
                      <Link href={`/dashboard/contactos/${lead.convertedContact.id}`} className="text-slate-900 underline">
                        {lead.convertedContact.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">Contacto eliminado</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Oportunidad</dt>
                  <dd className="mt-0.5">
                    {lead.convertedOpportunity ? (
                      <Link href={`/dashboard/oportunidades/${lead.convertedOpportunity.id}`} className="text-slate-900 underline">
                        {lead.convertedOpportunity.title}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-slate-400">Convertido el {lead.convertedAt.toLocaleDateString("es-AR")}.</p>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Tareas relacionadas</h2>
            <RelatedTasksList tasks={lead.tasks} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Próximas actividades</h2>
            <RelatedEventsList events={upcomingEvents} entity="leadId" entityId={id} returnTo={`/dashboard/leads/${id}`} />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
          <AddActivityForm relatedType="lead" relatedId={id} />
          <ActivityFeed activities={activities} memberNameById={memberNameById} />
        </div>
      </div>
    </div>
  );
}
