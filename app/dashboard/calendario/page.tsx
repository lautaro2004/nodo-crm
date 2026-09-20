import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listEvents, listTaskDueDates, EVENT_TYPES, type EventType } from "@/modules/calendar/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { PageHeader, Button } from "@/components/ui/primitives";
import { CalendarGrid, type GridEvent, type GridTask } from "@/components/calendar/calendar-grid";
import { CalendarFilters } from "@/components/calendar/calendar-filters";
import {
  addDaysKey,
  dayKey,
  isDayKey,
  shiftAnchor,
  startOfDayInstant,
  visibleDays,
  type CalendarView,
} from "@/lib/calendar-dates";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: "Mes" },
  { key: "week", label: "Semana" },
  { key: "day", label: "Día" },
];

function titleFor(view: CalendarView, anchor: string, days: string[]) {
  const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC", ...opts });
  if (view === "month") return fmt(anchor, { month: "long", year: "numeric" });
  if (view === "day") return fmt(anchor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${fmt(days[0], { day: "numeric", month: "short" })} – ${fmt(days[6], { day: "numeric", month: "short", year: "numeric" })}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; owner?: string; type?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const sp = await searchParams;
  const view = (VIEWS.find((v) => v.key === sp.view)?.key ?? "month") as CalendarView;
  const todayKey = dayKey(new Date());
  const anchor = isDayKey(sp.date) ? sp.date : todayKey;
  const type = (EVENT_TYPES as readonly string[]).includes(sp.type ?? "") ? (sp.type as EventType) : undefined;
  const ownerId = sp.owner === "me" ? ctx.userId : sp.owner || undefined;

  const days = visibleDays(view, anchor);
  const from = startOfDayInstant(days[0]);
  const to = startOfDayInstant(addDaysKey(days[days.length - 1], 1));

  const [events, tasks, members] = await Promise.all([
    listEvents(ctx.businessId, { from, to, ownerId, type }),
    listTaskDueDates(ctx.businessId, from, to, ownerId),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const memberName = new Map(members.map((m) => [m.userId, m.name || m.email]));

  const eventsByDay = new Map<string, GridEvent[]>();
  for (const e of events) {
    const key = dayKey(e.startsAt);
    const item: GridEvent = {
      id: e.id,
      title: e.title,
      type: e.type,
      status: e.status,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location,
      ownerName: e.ownerId ? (memberName.get(e.ownerId) ?? null) : null,
      relatedLabel: e.opportunity?.title ?? e.company?.name ?? e.contact?.name ?? e.lead?.name ?? null,
    };
    eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), item]);
  }
  const tasksByDay = new Map<string, GridTask[]>();
  for (const t of tasks) {
    if (!t.dueAt) continue;
    const key = dayKey(t.dueAt);
    tasksByDay.set(key, [...(tasksByDay.get(key) ?? []), { id: t.id, title: t.title }]);
  }

  const href = (over: { view?: CalendarView; date?: string }) => {
    const p = new URLSearchParams();
    p.set("view", over.view ?? view);
    p.set("date", over.date ?? anchor);
    if (sp.owner) p.set("owner", sp.owner);
    if (type) p.set("type", type);
    return `/dashboard/calendario?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Calendario"
        description="Reuniones, llamadas y seguimientos. Las líneas punteadas son tareas con vencimiento."
        actions={
          <Link href={`/dashboard/calendario/nuevo?date=${anchor}`}>
            <Button>Programar actividad</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={href({ date: shiftAnchor(view, anchor, -1) })}>
            <Button variant="secondary" size="sm" aria-label="Anterior">
              ‹
            </Button>
          </Link>
          <Link href={href({ date: todayKey })}>
            <Button variant="secondary" size="sm">
              Hoy
            </Button>
          </Link>
          <Link href={href({ date: shiftAnchor(view, anchor, 1) })}>
            <Button variant="secondary" size="sm" aria-label="Siguiente">
              ›
            </Button>
          </Link>
          <h2 className="ml-2 text-base font-semibold capitalize text-slate-900">{titleFor(view, anchor, days)}</h2>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href({ view: v.key })}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                view === v.key ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <CalendarFilters members={members} />
      </div>

      <CalendarGrid
        view={view}
        days={days}
        anchor={anchor}
        todayKey={todayKey}
        eventsByDay={eventsByDay}
        tasksByDay={tasksByDay}
        dayHref={(key) => href({ view: "day", date: key })}
        newHref={(key) => `/dashboard/calendario/nuevo?date=${key}`}
      />
    </div>
  );
}
