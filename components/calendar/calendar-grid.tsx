import Link from "next/link";

import { CALENDAR_EVENT_TYPE_CHIP } from "@/lib/labels";
import { timeLabel, type CalendarView } from "@/lib/calendar-dates";

export interface GridEvent {
  id: string;
  title: string;
  type: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  ownerName: string | null;
  relatedLabel: string | null;
}
// Evento de Google Calendar que Nodo solo muestra (no es de Nodo).
export interface GridExternal {
  id: string;
  title: string;
  startsAt: Date;
  allDay: boolean;
  htmlLink: string | null;
}
export interface GridTask {
  id: string;
  title: string;
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dayNumber(key: string) {
  return Number(key.slice(8));
}

function weekdayShort(key: string) {
  return WEEKDAYS[(new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7];
}

function EventChip({ event, detailed }: { event: GridEvent; detailed?: boolean }) {
  const cancelled = event.status === "cancelled";
  return (
    <Link
      href={`/dashboard/calendario/${event.id}`}
      title={event.title}
      className={`block rounded-md border px-2 py-1 text-xs leading-snug hover:brightness-95 ${
        CALENDAR_EVENT_TYPE_CHIP[event.type] ?? CALENDAR_EVENT_TYPE_CHIP.other
      } ${cancelled ? "line-through opacity-50" : ""} ${event.status === "completed" ? "opacity-70" : ""}`}
    >
      <span className="font-medium">{timeLabel(event.startsAt)}</span> <span className="break-words">{event.title}</span>
      {detailed && (
        <span className="mt-0.5 block text-[11px] opacity-80">
          {timeLabel(event.startsAt)}–{timeLabel(event.endsAt)}
          {event.ownerName ? ` · ${event.ownerName}` : ""}
          {event.location ? ` · ${event.location}` : ""}
          {event.relatedLabel ? ` · ${event.relatedLabel}` : ""}
        </span>
      )}
    </Link>
  );
}

function ExternalChip({ event }: { event: GridExternal }) {
  const label = (
    <>
      <span className="font-medium">{event.allDay ? "Todo el día" : timeLabel(event.startsAt)}</span>{" "}
      <span className="break-words">{event.title}</span>
      <span className="ml-1 rounded bg-white/70 px-1 text-[10px] font-medium text-emerald-700">Google</span>
    </>
  );
  const className = "block rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs leading-snug text-emerald-900";
  return event.htmlLink ? (
    <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" title={`Evento de Google Calendar: ${event.title}`} className={`${className} hover:brightness-95`}>
      {label}
    </a>
  ) : (
    <div className={className}>{label}</div>
  );
}

function TaskChip({ task }: { task: GridTask }) {
  return (
    <Link
      href={`/dashboard/tareas/${task.id}`}
      title={`Tarea con vencimiento: ${task.title}`}
      className="block truncate rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-50"
    >
      ☐ {task.title}
    </Link>
  );
}

export function CalendarGrid({
  view,
  days,
  anchor,
  todayKey,
  eventsByDay,
  tasksByDay,
  externalByDay,
  dayHref,
  newHref,
}: {
  view: CalendarView;
  days: string[];
  anchor: string;
  todayKey: string;
  eventsByDay: Map<string, GridEvent[]>;
  tasksByDay: Map<string, GridTask[]>;
  externalByDay?: Map<string, GridExternal[]>;
  dayHref: (key: string) => string;
  newHref: (key: string) => string;
}) {
  if (view === "month") {
    return (
      <div>
        <div className="hidden grid-cols-7 gap-px text-center text-xs font-medium text-slate-500 md:grid">
          {WEEKDAYS.map((d) => (
            <div key={d} className="pb-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-7">
          {days.map((key) => {
            const events = eventsByDay.get(key) ?? [];
            const tasks = tasksByDay.get(key) ?? [];
            const external = externalByDay?.get(key) ?? [];
            const outside = key.slice(0, 7) !== anchor.slice(0, 7);
            const shown = events.slice(0, 3);
            const extra = events.length - shown.length + Math.max(0, tasks.length - (events.length ? 0 : 2));
            if (outside && events.length === 0 && tasks.length === 0 && external.length === 0) {
              return <div key={key} className="hidden min-h-24 bg-slate-50 md:block" />;
            }
            return (
              <div key={key} className={`min-h-24 space-y-1 p-1.5 ${outside ? "bg-slate-50" : "bg-white"}`}>
                <div className="flex items-center justify-between">
                  <Link
                    href={dayHref(key)}
                    className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs ${
                      key === todayKey ? "bg-indigo-600 font-semibold text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="md:hidden">{weekdayShort(key)} </span>
                    {dayNumber(key)}
                  </Link>
                  <Link href={newHref(key)} className="text-xs text-slate-300 hover:text-indigo-600" aria-label="Programar en este día">
                    +
                  </Link>
                </div>
                {shown.map((e) => (
                  <EventChip key={e.id} event={e} />
                ))}
                {external.slice(0, 2).map((e) => (
                  <ExternalChip key={e.id} event={e} />
                ))}
                {tasks.slice(0, events.length ? 1 : 2).map((t) => (
                  <TaskChip key={t.id} task={t} />
                ))}
                {extra > 0 && (
                  <Link href={dayHref(key)} className="block px-1 text-[11px] text-slate-500 hover:underline">
                    +{extra} más
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const cols = view === "week" ? "lg:grid-cols-7" : "";
  return (
    <div className={`grid grid-cols-1 gap-3 ${cols}`}>
      {days.map((key) => {
        const events = eventsByDay.get(key) ?? [];
        const tasks = tasksByDay.get(key) ?? [];
        const external = externalByDay?.get(key) ?? [];
        return (
          <div key={key} className="min-h-28 rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <Link
                href={dayHref(key)}
                className={`text-sm font-medium ${key === todayKey ? "text-indigo-600" : "text-slate-700"} hover:underline`}
              >
                {weekdayShort(key)} {dayNumber(key)}
              </Link>
              <Link href={newHref(key)} className="text-xs text-slate-400 hover:text-indigo-600">
                + Programar
              </Link>
            </div>
            <div className="space-y-1.5">
              {events.length === 0 && tasks.length === 0 && external.length === 0 && <p className="text-xs text-slate-300">Sin actividades</p>}
              {events.map((e) => (
                <EventChip key={e.id} event={e} detailed={view === "day"} />
              ))}
              {external.map((e) => (
                <ExternalChip key={e.id} event={e} />
              ))}
              {tasks.map((t) => (
                <TaskChip key={t.id} task={t} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
