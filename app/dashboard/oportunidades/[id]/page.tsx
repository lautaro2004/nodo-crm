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
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const opportunity = await getOpportunity(ctx.businessId, id);
  if (!opportunity) notFound();

  const [activities, assignedTags, allTags] = await Promise.all([
    listActivitiesForEntity(ctx.businessId, "opportunity", id),
    listTagsForEntity(ctx.businessId, "opportunity", id),
    listTags(ctx.businessId),
  ]);

  return (
    <div>
      <PageHeader
        title={opportunity.title}
        description={opportunity.company?.name}
        actions={
          <Link href={`/dashboard/oportunidades/${id}/editar`}>
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
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Historial</h2>
          <AddActivityForm relatedType="opportunity" relatedId={id} />
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
