import { Card, EmptyState } from "@/components/ui/primitives";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";

interface ActivityItem {
  id: string;
  type: string;
  body: string | null;
  createdAt: Date;
}

// Historial de una entidad puntual — Fase 3J: "cuando abramos una ficha de
// cliente podamos entender qué ocurrió, cuándo, y quién lo hizo". El
// "quién" (ownerId) se resuelve en una fase posterior con nombres de
// usuario reales; por ahora se muestra la fecha, que ya es información
// real de la base.
export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return <EmptyState title="Sin actividad registrada todavía" description="Las notas y cambios de estado van a aparecer acá." />;
  }

  return (
    <Card className="divide-y divide-slate-100">
      {activities.map((a) => (
        <div key={a.id} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">{ACTIVITY_TYPE_LABELS[a.type] ?? a.type}</span>
            <span className="text-xs text-slate-400">{a.createdAt.toLocaleString("es-AR")}</span>
          </div>
          {a.body && <p className="mt-1 text-sm text-slate-600">{a.body}</p>}
        </div>
      ))}
    </Card>
  );
}
