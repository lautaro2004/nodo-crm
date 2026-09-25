import Link from "next/link";
import { notFound } from "next/navigation";

import { resolveWorkspaceContext } from "@/lib/workspace";
import { getTask } from "@/modules/tasks/service";
import { listWorkspaceMembers } from "@/modules/business/members";
import { listTaskAttachments } from "@/modules/tasks/attachments";
import { listActivitiesForEntity } from "@/modules/activities/service";
import { Badge, Button, Card, PageHeader } from "@/components/ui/primitives";
import { ActivityFeed } from "@/components/activities/activity-feed";
import { TaskCommentForm } from "@/components/tasks/task-comment-form";
import { TaskAssigneeSelect } from "@/components/tasks/task-assignee-select";
import { TaskAttachments } from "@/components/tasks/task-attachments";
import { TaskReminderStatus } from "@/components/tasks/task-reminder-status";
import { StatusSelect } from "@/components/shared/status-select";
import { TaskGoogleCalendarAction } from "@/components/tasks/task-google-calendar-action";
import { getConnectionStatus } from "@/lib/google/connection";
import { getTaskGoogleLink } from "@/modules/tasks/google-calendar";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, TASK_PRIORITY_BADGE_VARIANT } from "@/lib/labels";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await resolveWorkspaceContext();
  if (ctx.status !== "ok") return null;

  const { id } = await params;
  const task = await getTask(ctx.businessId, id);
  if (!task) notFound();

  const [members, activities, attachments] = await Promise.all([
    listWorkspaceMembers(ctx.businessId),
    listActivitiesForEntity(ctx.businessId, "task", id),
    listTaskAttachments(ctx.businessId, id),
  ]);
  const googleStatus = await getConnectionStatus({ businessId: ctx.businessId, userId: ctx.userId }).catch(() => null);
  const googleLink = googleStatus?.features.calendar
    ? await getTaskGoogleLink(ctx.businessId, ctx.userId, id).catch(() => ({ linked: false }))
    : { linked: false };
  const createdByMember = members.find((m) => m.userId === task.createdById);
  const memberNameById = new Map(members.map((m) => [m.userId, m.name || m.email]));

  return (
    <div>
      <PageHeader
        title={task.title}
        backHref="/dashboard/tareas"
        actions={
          <Link href={`/dashboard/tareas/${id}/editar`}>
            <Button variant="secondary">Editar</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Estado</p>
                <StatusSelect
                  apiPath={`/api/tasks/${id}`}
                  value={task.status}
                  options={Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({ key, label }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Prioridad</p>
                <Badge variant={TASK_PRIORITY_BADGE_VARIANT[task.priority] ?? "neutral"}>
                  {TASK_PRIORITY_LABELS[task.priority] ?? task.priority}
                </Badge>
              </div>
            </div>

            {task.description && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Descripción</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Inicio</dt>
                <dd className="mt-0.5 text-slate-900">{task.startDate ? task.startDate.toLocaleDateString("es-AR") : "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Vencimiento</dt>
                <dd className="mt-0.5 text-slate-900">
                  {task.dueAt
                    ? `${task.dueAt.toLocaleDateString("es-AR")} ${task.dueAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Completada</dt>
                <dd className="mt-0.5 text-slate-900">{task.completedAt ? task.completedAt.toLocaleDateString("es-AR") : "—"}</dd>
              </div>
              <div>
                <dt className="mb-0.5 text-slate-500">Recordatorio</dt>
                <dd className="mt-0.5">
                  <TaskReminderStatus taskId={id} remindAt={task.reminders[0]?.remindAt ?? null} />
                </dd>
              </div>
              <div>
                <dt className="mb-0.5 text-slate-500">Google Calendar</dt>
                <dd className="mt-0.5">
                  <TaskGoogleCalendarAction
                    taskId={id}
                    calendarConnected={!!googleStatus?.features.calendar}
                    hasDueDate={!!task.dueAt}
                    linked={googleLink.linked}
                  />
                </dd>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Responsable</p>
                <TaskAssigneeSelect taskId={id} ownerId={task.ownerId} members={members} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Creada por</p>
                <p className="text-slate-900">{createdByMember?.name || createdByMember?.email || "—"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Relacionado con</h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <RelatedChip label="Empresa" href={task.company && `/dashboard/empresas/${task.company.id}`} name={task.company?.name} />
              <RelatedChip label="Contacto" href={task.contact && `/dashboard/contactos/${task.contact.id}`} name={task.contact?.name} />
              <RelatedChip label="Lead" href={task.lead && `/dashboard/leads/${task.lead.id}`} name={task.lead?.name} />
              <RelatedChip
                label="Oportunidad"
                href={task.opportunity && `/dashboard/oportunidades/${task.opportunity.id}`}
                name={task.opportunity?.title}
              />
              {!task.company && !task.contact && !task.lead && !task.opportunity && (
                <p className="text-sm text-slate-400">Sin relaciones.</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Archivos</h2>
            <TaskAttachments taskId={id} attachments={attachments} />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Comentarios e historial</h2>
          <TaskCommentForm taskId={id} />
          <ActivityFeed activities={activities} memberNameById={memberNameById} />
        </div>
      </div>
    </div>
  );
}

function RelatedChip({ label, href, name }: { label: string; href?: string | null; name?: string }) {
  if (!href || !name) return null;
  return (
    <Link href={href} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50">
      <span className="text-slate-400">{label}:</span> {name}
    </Link>
  );
}
