import Link from "next/link";

import { EmptyState } from "@/components/ui/primitives";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_DOT_COLOR, RELATED_TYPE_LABELS } from "@/lib/labels";

interface ActivityItem {
  id: string;
  type: string;
  body: string | null;
  createdAt: Date;
  ownerId?: string | null;
  relatedType?: string;
  relatedId?: string;
}

const ENTITY_BASE_PATH: Record<string, string> = {
  company: "/dashboard/empresas",
  contact: "/dashboard/contactos",
  lead: "/dashboard/leads",
  opportunity: "/dashboard/oportunidades",
  task: "/dashboard/tareas",
};

function dayLabel(date: Date): string {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) return "Hoy";
  if (startOfDate.getTime() === startOfYesterday.getTime()) return "Ayer";
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: startOfDate.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

// Timeline real (Fase de pulido UX): agrupado por día, con un punto de
// color por FAMILIA de evento (ver ACTIVITY_TYPE_DOT_COLOR) — reemplaza el
// listado plano anterior. Reutiliza Activity tal cual, sin ningún modelo
// ni endpoint nuevo: solo cambia cómo se renderiza lo que ya existía.
export function ActivityFeed({
  activities,
  memberNameById,
  showRelatedLink = false,
}: {
  activities: ActivityItem[];
  memberNameById?: Map<string, string>;
  showRelatedLink?: boolean;
}) {
  if (activities.length === 0) {
    return <EmptyState title="Sin actividad registrada todavía" description="Las notas y cambios de estado van a aparecer acá." />;
  }

  const groups: { label: string; items: ActivityItem[] }[] = [];
  for (const activity of activities) {
    const label = dayLabel(activity.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) lastGroup.items.push(activity);
    else groups.push({ label, items: [activity] });
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
          <ul className="space-y-3 border-l-2 border-slate-100 pl-4">
            {group.items.map((a) => {
              const actorName = a.ownerId ? memberNameById?.get(a.ownerId) : undefined;
              return (
                <li key={a.id} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${ACTIVITY_TYPE_DOT_COLOR[a.type] ?? "bg-slate-400"}`}
                  />
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-slate-900">
                      {actorName && <span className="font-medium">{actorName}</span>}
                      {actorName && " · "}
                      <span className={actorName ? "text-slate-600" : "font-medium"}>{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
                      {showRelatedLink && a.relatedType && a.relatedId && (
                        <>
                          {" · "}
                          <Link href={`${ENTITY_BASE_PATH[a.relatedType] ?? "/dashboard"}/${a.relatedId}`} className="text-slate-600 underline">
                            {RELATED_TYPE_LABELS[a.relatedType] ?? a.relatedType}
                          </Link>
                        </>
                      )}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">
                      {a.createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {a.body && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{a.type === "comment" ? `"${a.body}"` : a.body}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
