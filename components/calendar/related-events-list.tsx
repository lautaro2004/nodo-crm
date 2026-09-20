import Link from "next/link";

import { CALENDAR_EVENT_TYPE_LABELS } from "@/lib/labels";
import { dayKey, timeLabel } from "@/lib/calendar-dates";

interface RelatedEvent {
  id: string;
  title: string;
  type: string;
  startsAt: Date;
}

function formatDay(d: Date) {
  const [, m, day] = dayKey(d).split("-");
  return `${day}/${m}`;
}

// Sección "Próximas actividades" del detalle de Company/Contact/Lead/
// Opportunity. `entity` define qué query param prefija el formulario de
// creación, así el evento queda asociado automáticamente.
export function RelatedEventsList({
  events,
  entity,
  entityId,
  returnTo,
}: {
  events: RelatedEvent[];
  entity: "companyId" | "contactId" | "leadId" | "opportunityId";
  entityId: string;
  returnTo: string;
}) {
  const newHref = `/dashboard/calendario/nuevo?${entity}=${entityId}&returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div>
      {events.length === 0 ? (
        <p className="text-sm text-slate-400">Sin actividades programadas.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.map((e) => (
            <li key={e.id} className="py-2 first:pt-0 last:pb-0">
              <Link href={`/dashboard/calendario/${e.id}`} className="flex items-center justify-between gap-3 text-sm text-slate-900 hover:underline">
                <span className="truncate">{e.title}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {formatDay(e.startsAt)} {timeLabel(e.startsAt)} · {CALENDAR_EVENT_TYPE_LABELS[e.type] ?? e.type}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={newHref} className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
        + Programar actividad
      </Link>
    </div>
  );
}
