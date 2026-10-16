import { resolveWorkspaceContext } from "@/lib/workspace";
import { getDashboardMetrics, getPipelineSummary, STALLED_DAYS } from "@/modules/dashboard/service";
import { StatusDot } from "@/components/status/status-badge";
import { resolveStatusColor } from "@/lib/status-colors";
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
      <PageHeader title="Inicio" description="Lo que necesita tu atención hoy." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Leads abiertos" value={metrics.openLeadsCount} href="/dashboard/leads" />
        <StatCard label={`${moduleLabel.labelPlural} abiertas`} value={metrics.openOpportunitiesCount} href="/dashboard/oportunidades" />
        <StatCard label="Tareas para hoy" value={metrics.dueTodayTasksCount} href="/dashboard/tareas" tone="brand" />
        <StatCard label="Tareas vencidas" value={metrics.overdueTasksCount} href="/dashboard/tareas" tone="danger" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={`${moduleLabel.labelPlural} sin movimiento (+${STALLED_DAYS} días)`}
          value={metrics.stalledOpportunitiesCount}
          href="/dashboard/oportunidades?display=list&stalled=1"
          tone="danger"
        />
        <StatCard label="Tareas pendientes" value={metrics.pendingTasksCount} href="/dashboard/tareas" />
        <StatCard label="Empresas / Clientes" value={metrics.companiesCount} href="/dashboard/empresas" />
        <StatCard label="Leads desde Nexo" value={metrics.leadsFromNexoCount} href="/dashboard/leads" />
      </div>

      {pipelineSummary && pipelineSummary.stages.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Pipeline abierto — {pipelineSummary.pipelineName}</h2>
            <Link href={`/dashboard/oportunidades?pipelineId=${pipelineSummary.pipelineId}`} className="text-xs font-medium text-brand-700 hover:underline">
              Ver tablero
            </Link>
          </div>
          <Card className="p-4">
            {(() => {
              const total = pipelineSummary.stages.reduce((n, s) => n + s.count, 0);
              return (
                <>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                    {total > 0 &&
                      pipelineSummary.stages.map((s) =>
                        s.count > 0 ? <div key={s.id} className={resolveStatusColor(s.color).bar} style={{ width: `${(s.count / total) * 100}%` }} /> : null
                      )}
                  </div>
                  <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
                    {pipelineSummary.stages.map((s) => (
                      <li key={s.id} className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                          <StatusDot color={s.color} />
                          {s.label}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">
                          {s.count}
                          {s.amount > 0 && <span className="ml-1.5 text-xs font-normal text-slate-500">${s.amount.toLocaleString("es-AR")}</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </Card>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Próximas actividades</h2>
          <Link href="/dashboard/calendario" className="text-xs font-medium text-brand-700 hover:underline">
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
