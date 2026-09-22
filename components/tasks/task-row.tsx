"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/primitives";
import { BellIcon } from "@/components/ui/icons";
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_VARIANT } from "@/lib/labels";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  company: { id: string; name: string } | null;
  opportunity: { id: string; title: string } | null;
  ownerName: string | null;
  hasReminder?: boolean;
}

function isOverdue(task: TaskItem): boolean {
  return !!task.dueAt && task.dueAt < new Date() && task.status !== "completed" && task.status !== "cancelled";
}

export function TaskRow({ task }: { task: TaskItem }) {
  const router = useRouter();
  const isDone = task.status === "completed";

  async function toggleComplete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: isDone ? "todo" : "completed" }),
    });
    router.refresh();
  }

  const context = [task.company?.name, task.opportunity?.title].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/dashboard/tareas/${task.id}`}
      className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-slate-50"
    >
      <input type="checkbox" checked={isDone} onChange={() => {}} onClick={toggleComplete} className="h-4 w-4 accent-indigo-600" />

      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 truncate text-sm ${isDone ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {task.hasReminder && <BellIcon className="h-3.5 w-3.5 shrink-0 text-indigo-500" aria-label="Con recordatorio" />}
          <span className="truncate">{task.title}</span>
        </p>
        {context && <p className="truncate text-xs text-slate-400">{context}</p>}
      </div>

      <span className="hidden shrink-0 text-xs text-slate-500 sm:block">{task.ownerName ?? "Sin asignar"}</span>

      <Badge variant={TASK_PRIORITY_BADGE_VARIANT[task.priority] ?? "neutral"} className="shrink-0">
        {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
      </Badge>

      {task.dueAt && (
        <span className={`shrink-0 text-xs ${isOverdue(task) ? "font-medium text-red-600" : "text-slate-400"}`}>
          {task.dueAt.toLocaleDateString("es-AR")}
        </span>
      )}
    </Link>
  );
}
