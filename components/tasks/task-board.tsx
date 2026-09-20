"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Card, Select } from "@/components/ui/primitives";
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
}

function isOverdue(task: TaskCard): boolean {
  return !!task.dueAt && task.dueAt < new Date() && task.status !== "completed" && task.status !== "cancelled";
}

// Mismo patrón que OpportunityBoard: sin drag-and-drop, un <select> de
// estado por tarjeta que dispara el PATCH ya existente y validado
// (/api/tasks/[id], mismo endpoint que usa el resto de la UI de Tareas) —
// el cambio de estado persiste de verdad, no es solo visual.
export function TaskBoard({ tasks }: { tasks: TaskCard[] }) {
  const router = useRouter();

  async function moveStatus(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((column) => {
        const cards = tasks.filter((t) => t.status === column.key);
        return (
          <div key={column.key} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-900">{column.label}</h3>
              <span className="text-xs text-slate-400">{cards.length}</span>
            </div>
            <div className="space-y-2">
              {cards.map((t) => (
                <Card key={t.id} className="p-3">
                  <Link href={`/dashboard/tareas/${t.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                    {t.title}
                  </Link>
                  {t.relatedLabel && <p className="mt-0.5 truncate text-xs text-slate-500">{t.relatedLabel}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant={TASK_PRIORITY_BADGE_VARIANT[t.priority] ?? "neutral"}>
                      {TASK_PRIORITY_LABELS[t.priority] ?? t.priority}
                    </Badge>
                    {t.dueAt && (
                      <span className={`text-xs ${isOverdue(t) ? "font-medium text-red-600" : "text-slate-400"}`}>
                        {t.dueAt.toLocaleDateString("es-AR")}
                      </span>
                    )}
                  </div>
                  {t.ownerName && <p className="mt-1 truncate text-xs text-slate-400">{t.ownerName}</p>}
                  <Select value={t.status} onChange={(e) => moveStatus(t.id, e.target.value)} className="mt-2 text-xs">
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Card>
              ))}
              {cards.length === 0 && <p className="px-1 text-xs text-slate-400">Sin tareas</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
