import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getLead } from "@/modules/leads/service";
import { listStatusDefinitions } from "@/modules/status-definitions/service";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { listTags, listTagsForEntity } from "@/modules/tags/service";
import { getNexoAppointment } from "@/modules/nexo/appointments";
import { Badge, Button, Card, PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { AddActivityForm } from "@/components/activities/add-activity-form";
import { TagPicker } from "@/components/tags/tag-picker";
import { StatusSelect } from "@/components/shared/status-select";
import { OwnerAssign } from "@/components/shared/owner-assign";
import { LEAD_SOURCE_LABELS } from "@/lib/labels";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const lead = await getLead(ctx.businessId, id);
  if (!lead) notFound();

  const [statuses, activities, assignedTags, allTags, nexoAppointment] = await Promise.all([
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
  ]);

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={lead.company?.name}
        actions={
          <Link href={`/dashboard/leads/${id}/editar`}>
            <Button variant="secondary">Editar</Button>
          </Link>
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
                <StatusSelect
                  apiPath={`/api/leads/${id}`}
                  value={lead.status}
                  options={statuses.map((s) => ({ key: s.key, label: s.label }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Responsable</p>
                <OwnerAssign apiPath={`/api/leads/${id}`} ownerId={lead.ownerId} />
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
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
          <AddActivityForm relatedType="lead" relatedId={id} />
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
