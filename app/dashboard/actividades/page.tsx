import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listRecentActivities } from "@/modules/activities/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/primitives";
import { ACTIVITY_TYPE_LABELS, RELATED_TYPE_LABELS } from "@/lib/labels";

const ENTITY_BASE_PATH: Record<string, string> = {
  company: "/dashboard/empresas",
  contact: "/dashboard/contactos",
  lead: "/dashboard/leads",
  opportunity: "/dashboard/oportunidades",
};

export default async function ActivitiesPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const activities = await listRecentActivities(ctx.businessId, 100);

  return (
    <div>
      <PageHeader title="Actividades" description="Historial de interacción de todo el Workspace." />

      {activities.length === 0 ? (
        <EmptyState title="Todavía no hay actividad registrada" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {activities.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                  {" · "}
                  <Link href={`${ENTITY_BASE_PATH[a.relatedType] ?? "/dashboard"}/${a.relatedId}`} className="text-slate-600 underline">
                    {RELATED_TYPE_LABELS[a.relatedType] ?? a.relatedType}
                  </Link>
                </p>
                {a.body && <p className="mt-0.5 text-sm text-slate-500">{a.body}</p>}
              </div>
              <span className="shrink-0 text-xs text-slate-400">{a.createdAt.toLocaleString("es-AR")}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
