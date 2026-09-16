import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listTasks } from "@/modules/tasks/service";
import { PageHeader, Card, Button, EmptyState } from "@/components/ui/primitives";
import { TaskRow } from "@/components/tasks/task-row";

export default async function TasksPage() {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const tasks = await listTasks(ctx.businessId);
  const now = new Date();
  const pending = tasks.filter((t) => t.status === "pending" && (!t.dueAt || t.dueAt >= now));
  const overdue = tasks.filter((t) => t.status === "pending" && t.dueAt && t.dueAt < now);
  const done = tasks.filter((t) => t.status === "done");

  return (
    <div>
      <PageHeader
        title="Tareas"
        actions={
          <Link href="/dashboard/tareas/nueva">
            <Button>Nueva tarea</Button>
          </Link>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          title="Sin tareas todavía"
          action={
            <Link href="/dashboard/tareas/nueva">
              <Button>Nueva tarea</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <TaskSection title={`Vencidas (${overdue.length})`} tasks={overdue} />
          <TaskSection title={`Pendientes (${pending.length})`} tasks={pending} />
          <TaskSection title={`Completadas (${done.length})`} tasks={done} />
        </div>
      )}
    </div>
  );
}

function TaskSection({ title, tasks }: { title: string; tasks: { id: string; title: string; status: string; dueAt: Date | null }[] }) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-900">{title}</h2>
      <Card>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </Card>
    </div>
  );
}
