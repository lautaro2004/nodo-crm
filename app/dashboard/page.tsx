import { resolveWorkspaceContext } from "@/lib/workspace";
import { getDashboardMetrics, getPipelineSummary } from "@/modules/dashboard/service";
import { listRecentActivities } from "@/modules/activities/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { PageHeader, StatCard, Card } from "@/components/ui/primitives";
import Link from "next/link";
import { listUpcomingEvents } from "@/modules/calendar/service";
import { addDaysKey, dayKey, timeLabel } from "@/lib/calendar-dates";
import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/labels";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { getModuleLabel } from "@/modules/workspace/module-config";

export default async function DashboardHomePage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null; // el layout ya redirige antes de llegar acá

  const [metrics, recentActivity, members, pipelineSummary, upcoming, moduleLabel] = await Promise.all([
    getDashboardMetrics(ctx.businessId),
    listRecentActivities(ctx.businessId, 10),
    listWorkspaceMembers(ctx.businessId),
    getPipelineSummary(ctx.businessId),
    listUpcomingEvents(ctx.businessId, { limit: 8 }),
    getModuleLabel(ctx.businessId, "opportunity"),
  ]);
  const todayKey = dayKey(new Date());
  const tomorrowKey = addDaysKey(todayKey, 1);
  const dayLabel = (key: string) => (key === todayKey ? "Hoy" : key === tomorrowKey ? "Mañana" : key.split("-").reverse().slice(0, 2).join("/"));
  const upcomingByDay = new Map<string, typeof upcoming>();
  for (const e of upcoming) upcomingByDay.set(dayKey(e.startsAt), [...(upcomingByDay.get(dayKey(e.startsAt)) ?? []), e]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader title="Inicio" description="Vista general de tu Workspace." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Empresas / Clientes" value={metrics.companiesCount} />
        <StatCard label="Contactos" value={metrics.contactsCount} />
        <StatCard label="Leads abiertos" value={metrics.openLeadsCount} />
        <StatCard label={`${moduleLabel.labelPlural} abiertas`} value={metrics.openOpportunitiesCount} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Tareas pendientes" value={metrics.pendingTasksCount} />
        <StatCard label="Tareas vencidas" value={metrics.overdueTasksCount} />
        <StatCard label="Para hoy" value={metrics.dueTodayTasksCount} />
        <StatCard label="Leads desde Nexo" value={metrics.leadsFromNexoCount} />
      </div>

      {pipelineSummary && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Pipeline — {pipelineSummary.pipelineName}</h2>
          <Card className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
            {pipelineSummary.stages.map((s) => (
              <div key={s.id} className="p-4 text-center">
                <p className="text-2xl font-semibold text-slate-900">{s.count}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Próximas actividades</h2>
          <Link href="/dashboard/calendario" className="text-xs font-medium text-indigo-600 hover:underline">
            Ver calendario
          </Link>
        </div>
        <Card className="p-4">
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-400">No hay actividades programadas.</p>
          ) : (
            <div className="space-y-4">
              {Array.from(upcomingByDay.entries()).map(([key, items]) => (
                <div key={key}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{dayLabel(key)}</p>
                  <ul className="space-y-1">
                    {items.map((e) => (
                      <li key={e.id}>
                        <Link href={`/dashboard/calendario/${e.id}`} className="text-sm text-slate-800 hover:underline">
                          <span className="font-medium">{timeLabel(e.startsAt)}</span> {e.title}
                          <span className="text-slate-400"> · {CALENDAR_EVENT_TYPE_LABELS[e.type] ?? e.type}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Actividad reciente</h2>
        <ActivityFeed activities={recentActivity} memberNameById={memberNameById} showRelatedLink />
      </div>
    </div>
  );
}
