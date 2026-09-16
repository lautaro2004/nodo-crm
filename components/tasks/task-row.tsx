"use client";

import { useRouter } from "next/navigation";

interface TaskItem {
  id: string;
  title: string;
  status: string;
  dueAt: Date | null;
}

export function TaskRow({ task }: { task: TaskItem }) {
  const router = useRouter();

  async function toggle() {
    const nextStatus = task.status === "done" ? "pending" : "done";
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 last:border-0">
      <input type="checkbox" checked={task.status === "done"} onChange={toggle} className="h-4 w-4 accent-slate-900" />
      <div className="flex-1">
        <p className={`text-sm ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{task.title}</p>
      </div>
      {task.dueAt && <span className="text-xs text-slate-400">{task.dueAt.toLocaleDateString("es-AR")}</span>}
    </div>
  );
}
