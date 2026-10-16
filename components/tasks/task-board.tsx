"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import { KanbanBoard, patchMove } from "@/components/board/kanban-board";
import { BellIcon } from "@/components/ui/icons";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_VARIANT } from "@/lib/labels";

const COLUMNS = Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({ key, label }));

interface TaskCard {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  ownerName: string | null;
  relatedLabel: string | null;
  hasReminder?: boolean;
}

function isOverdue(task: TaskCard): boolean {
  return !!task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "completed" && task.status !== "cancelled";
}

const COLUMN_COLORS: Record<string, string> = { todo: "slate", in_progress: "blue", completed: "emerald", cancelled: "red" };

// Mismo tablero compartido que Leads/Oportunidades (DnD + "Mover a…"),
// sobre el PATCH ya existente de /api/tasks/[id].
export function TaskBoard({ tasks }: { tasks: TaskCard[] }) {
  return (
    <KanbanBoard
      itemNoun="tareas"
      columns={COLUMNS.map((c) => ({ id: c.key, label: c.label, color: COLUMN_COLORS[c.key], emptyLabel: "Sin tareas" }))}
      items={tasks.map((t) => ({ ...t, columnId: t.status }))}
      onMove={(t, status) => patchMove(`/api/tasks/${t.id}`, { status })}
      renderCard={(t) => (
        <div>
          <Link href={`/dashboard/tareas/${t.id}`} draggable={false} className="flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:text-brand-700">
            {t.hasReminder && <BellIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-label="Con recordatorio" />}
            <span className="truncate">{t.title}</span>
          </Link>
          {t.relatedLabel && <p className="mt-0.5 truncate text-xs text-slate-500">{t.relatedLabel}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={TASK_PRIORITY_BADGE_VARIANT[t.priority] ?? "neutral"}>{TASK_PRIORITY_LABELS[t.priority] ?? t.priority}</Badge>
            {t.dueAt && (
              <span className={`text-xs ${isOverdue(t) ? "font-medium text-red-600" : "text-slate-500"}`}>
                {new Date(t.dueAt).toLocaleDateString("es-AR")}
              </span>
            )}
          </div>
          {t.ownerName && <p className="mt-1 truncate text-xs text-slate-500">{t.ownerName}</p>}
        </div>
      )}
    />
  );
}
