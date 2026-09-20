import Link from "next/link";

import { Badge } from "@/components/ui/primitives";
import { TASK_STATUS_LABELS, TASK_STATUS_BADGE_VARIANT, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_VARIANT } from "@/lib/labels";

interface RelatedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
}

// Usado desde el detalle de Company/Contact/Lead/Opportunity — mismo
// criterio en las 4 páginas, ver docs/architecture/crm-fase-tareas.md,
// "Tareas relacionadas".
export function RelatedTasksList({ tasks }: { tasks: RelatedTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400">Sin tareas relacionadas.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <Link href={`/dashboard/tareas/${task.id}`} className="min-w-0 flex-1 text-sm text-slate-900 hover:underline">
            <span className="truncate">{task.title}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={TASK_PRIORITY_BADGE_VARIANT[task.priority] ?? "neutral"}>
              {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
            </Badge>
            <Badge variant={TASK_STATUS_BADGE_VARIANT[task.status] ?? "neutral"}>
              {TASK_STATUS_LABELS[task.status] ?? task.status}
            </Badge>
            {task.dueAt && <span className="text-xs text-slate-400">{task.dueAt.toLocaleDateString("es-AR")}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
