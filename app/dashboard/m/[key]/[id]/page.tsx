import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { hasRole } from "@/lib/permissions";
import { moduleEntityType } from "@/lib/custom-modules";
import { Badge, Card, InlineAlert, PageHeader } from "@/components/ui/primitives";
import { getModuleByKey } from "@/modules/custom-modules/service";
import { getRecord } from "@/modules/custom-modules/records";
import { loadRecordFormData } from "@/modules/custom-modules/view";
import { incomingLinks } from "@/modules/records/links";
import { listOpportunitiesForRecord } from "@/modules/opportunity-items/service";
import { RecordForm } from "@/components/custom-modules/record-form";
import { RecordActions } from "@/components/custom-modules/record-actions";
import { RelatedGroups } from "@/components/custom-modules/related-groups";
import { OPPORTUNITY_STATUS_LABELS } from "@/lib/labels";
import { nounFromLabels } from "@/lib/record-nouns";

type SP = Record<string, string | string[] | undefined>;

export default async function RecordDetailPage({ params, searchParams }: { params: Promise<{ key: string; id: string }>; searchParams: Promise<SP> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;
  const { key, id } = await params;
  const mod = await getModuleByKey(ctx.businessId, key);
  if (!mod) notFound();
  const record = await getRecord(ctx.businessId, mod.id, id);
  if (!record) notFound();
  const sp = await searchParams;

  const [data, incoming, opportunities] = await Promise.all([
    loadRecordFormData(ctx.businessId, mod.id, id),
    incomingLinks(ctx.businessId, moduleEntityType(mod.id), id),
    listOpportunitiesForRecord(ctx.businessId, id),
  ]);
  const basePath = `/dashboard/m/${mod.key}`;
  const editable = !mod.archivedAt;

  return (
    <div>
      <PageHeader
        title={record.title}
        description={mod.labelSingular}
        backHref={basePath}
        backLabel={mod.labelPlural}
        actions={
          <RecordActions
            moduleId={mod.id}
            recordId={id}
            basePath={basePath}
            archived={!!record.archivedAt}
            canDelete={hasRole(ctx.role, "admin")}
            disabled={!editable}
            noun={nounFromLabels(mod.labelSingular, mod.labelPlural)}
          />
        }
      />
      {sp.imageError === "1" && <InlineAlert>El registro se creó, pero alguna imagen no se pudo subir. Probá subirla de nuevo desde acá.</InlineAlert>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Datos</h2>
              {record.archivedAt && <Badge>Archivado</Badge>}
            </div>
            {editable ? (
              <RecordForm
                moduleId={mod.id}
                basePath={basePath}
                singular={mod.labelSingular.toLowerCase()}
                fields={data.fields}
                members={data.members}
                record={{ id, title: record.title, ownerId: record.ownerId, values: data.values, relations: data.relations, images: data.images }}
              />
            ) : (
              <p className="text-sm text-slate-500">El módulo está archivado: los registros se pueden ver pero no editar.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {opportunities.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Oportunidades</h2>
              <ul className="space-y-2 text-sm">
                {opportunities.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <Link href={`/dashboard/oportunidades/${o.id}`} className="min-w-0 truncate font-medium text-slate-800 hover:text-brand-700">
                      {o.title}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {o.quantity !== 1 ? `${o.quantity} × ` : ""}${o.unitPrice.toLocaleString("es-AR")} · {OPPORTUNITY_STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <RelatedGroups groups={incoming} emptyText={null} />
          <Card className="p-4 text-xs text-slate-500">
            Creado el {record.createdAt.toLocaleDateString("es-AR")} · actualizado el {record.updatedAt.toLocaleDateString("es-AR")}
          </Card>
        </div>
      </div>
    </div>
  );
}
