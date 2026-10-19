"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/primitives";
import { BellIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { readApiError } from "@/lib/error-messages";
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
  const toast = useToast();
  const [, startTransition] = useTransition();
  // Optimista: el tilde y el tachado cambian al instante; si el servidor
  // rechaza, se revierte y se avisa.
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  useEffect(() => setStatus(task.status), [task.status]);
  const isDone = status === "completed";

  async function toggleComplete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    const previous = status;
    const next = isDone ? "todo" : "completed";
    setStatus(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        setStatus(previous);
        toast.error("No se pudo actualizar la tarea", await readApiError(res));
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setStatus(previous);
      toast.error("Sin conexión", "La tarea no se actualizó.");
    } finally {
      setSaving(false);
    }
  }

  const context = [task.company?.name, task.opportunity?.title].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/dashboard/tareas/${task.id}`}
      className="flex items-center gap-3 border-b border-slate-50 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50"
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => {}}
        onClick={toggleComplete}
        aria-label={isDone ? `Marcar “${task.title}” como pendiente` : `Completar “${task.title}”`}
        aria-busy={saving || undefined}
        className="h-4 w-4 cursor-pointer accent-brand-500 aria-busy:opacity-60"
      />

      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 truncate text-sm transition-colors ${isDone ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {task.hasReminder && <BellIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" aria-label="Con recordatorio" />}
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
