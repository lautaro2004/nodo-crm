import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getDashboardMetrics } from "@/modules/dashboard/service";
import { listRecentActivities } from "@/modules/activities/service";
import { PageHeader, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { ACTIVITY_TYPE_LABELS, RELATED_TYPE_LABELS } from "@/lib/labels";

export default async function DashboardHomePage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null; // el layout ya redirige antes de llegar acá

  const [metrics, recentActivity] = await Promise.all([
    getDashboardMetrics(ctx.businessId),
    listRecentActivities(ctx.businessId, 10),
  ]);

  return (
    <div>
      <PageHeader title="Inicio" description="Vista general de tu Workspace." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Empresas / Clientes" value={metrics.companiesCount} />
        <StatCard label="Contactos" value={metrics.contactsCount} />
        <StatCard label="Leads abiertos" value={metrics.openLeadsCount} />
        <StatCard label="Oportunidades abiertas" value={metrics.openOpportunitiesCount} />
        <StatCard label="Tareas pendientes" value={metrics.pendingTasksCount} />
        <StatCard label="Leads desde Nexo" value={metrics.leadsFromNexoCount} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Actividad reciente</h2>
        {recentActivity.length === 0 ? (
          <EmptyState
            title="Todavía no hay actividad registrada"
            description="Las notas, llamadas y cambios de estado que registres van a aparecer acá."
          />
        ) : (
          <Card className="divide-y divide-slate-100">
            {recentActivity.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-slate-900">
                    <span className="font-medium">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                    {" · "}
                    <Link href={entityHref(a.relatedType, a.relatedId)} className="text-slate-600 underline">
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
    </div>
  );
}

function entityHref(relatedType: string, relatedId: string): string {
  const base: Record<string, string> = {
    company: "/dashboard/empresas",
    contact: "/dashboard/contactos",
    lead: "/dashboard/leads",
    opportunity: "/dashboard/oportunidades",
  };
  return `${base[relatedType] ?? "/dashboard"}/${relatedId}`;
}
