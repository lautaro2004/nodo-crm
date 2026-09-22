import Link from "next/link";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { listTasks } from "@/modules/tasks/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { PageHeader, Card, Button, EmptyState, ViewToggle } from "@/components/ui/primitives";
import { TaskRow } from "@/components/tasks/task-row";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskFilterBar } from "@/components/tasks/task-filter-bar";
import { TaskGroupSelect } from "@/components/tasks/task-group-select";
import { TASK_PRIORITY_LABELS } from "@/lib/labels";

const TABS = [
  { key: "all", label: "Todas" },
  { key: "mine", label: "Mis tareas" },
  { key: "overdue", label: "Vencidas" },
  { key: "today", label: "Hoy" },
  { key: "upcoming", label: "Próximas" },
  { key: "completed", label: "Completadas" },
] as const;

type GroupKey = "owner" | "priority" | "related" | "";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; priority?: string; display?: string; group?: string }>;
}) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { view, q, priority, display, group } = await searchParams;
  const activeView = (TABS.find((t) => t.key === view)?.key ?? "all") as (typeof TABS)[number]["key"];
  const isKanban = display === "kanban";
  const activeGroup = (["owner", "priority", "related"].includes(group ?? "") ? group : "") as GroupKey;

  const [tasks, members] = await Promise.all([
    listTasks(ctx.businessId, {
      view: activeView,
      search: q,
      priority: priority as never,
      currentUserId: ctx.userId,
    }),
    listWorkspaceMembers(ctx.businessId),
  ]);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  const params = new URLSearchParams(
    Object.entries({ view, q, priority }).filter((e): e is [string, string] => !!e[1])
  );

  const taskCards = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    company: t.company,
    opportunity: t.opportunity,
    ownerId: t.ownerId,
    ownerName: t.ownerId ? (memberNameById.get(t.ownerId) ?? null) : null,
    relatedLabel: [t.company?.name, t.contact?.name, t.lead?.name, t.opportunity?.title].filter(Boolean).join(" · ") || null,
    hasReminder: t.reminders.length > 0,
  }));

  const groups = groupTasks(taskCards, activeGroup, memberNameById);

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

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((tab) => {
          const tabParams = new URLSearchParams(params);
          if (tab.key === "all") tabParams.delete("view");
          else tabParams.set("view", tab.key);
          if (display) tabParams.set("display", display);
          if (activeGroup) tabParams.set("group", activeGroup);
          const qs = tabParams.toString();
          return (
            <Link
              key={tab.key}
              href={qs ? `/dashboard/tareas?${qs}` : "/dashboard/tareas"}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
                activeView === tab.key ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <TaskFilterBar searchPlaceholder="Buscar por título o descripción…" />
          {!isKanban && <TaskGroupSelect />}
        </div>
        <ViewToggle basePath="/dashboard/tareas" params={params} value={isKanban ? "kanban" : "list"} />
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title="Sin tareas en esta vista"
          action={
            <Link href="/dashboard/tareas/nueva">
              <Button>Nueva tarea</Button>
            </Link>
          }
        />
      ) : isKanban ? (
        <TaskBoard tasks={taskCards} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              {g.label !== "__all__" && (
                <h2 className="mb-2 text-sm font-semibold text-slate-900">
                  {g.label} <span className="font-normal text-slate-400">({g.items.length})</span>
                </h2>
              )}
              <Card>
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TaskCardData {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: Date | null;
  company: { id: string; name: string } | null;
  opportunity: { id: string; title: string } | null;
  ownerId: string | null;
  ownerName: string | null;
  relatedLabel: string | null;
  hasReminder: boolean;
}

function groupTasks(
  tasks: TaskCardData[],
  group: GroupKey,
  memberNameById: Map<string, string>
): { label: string; items: TaskCardData[] }[] {
  if (!group) return [{ label: "__all__", items: tasks }];

  const buckets = new Map<string, TaskCardData[]>();
  for (const task of tasks) {
    const key =
      group === "owner"
        ? (task.ownerId ? (memberNameById.get(task.ownerId) ?? "Sin asignar") : "Sin asignar")
        : group === "priority"
          ? (TASK_PRIORITY_LABELS[task.priority] ?? task.priority)
          : task.relatedLabel ?? "Sin relación";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(task);
    else buckets.set(key, [task]);
  }

  return Array.from(buckets.entries()).map(([label, items]) => ({ label, items }));
}
