import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { taskCreateSchema } from "@/lib/schemas";
import { createTask, listTasks, TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority } from "@/modules/tasks/service";

const VIEWS = ["all", "mine", "overdue", "today", "upcoming", "completed"] as const;

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const viewParam = searchParams.get("view");
  const view = (VIEWS as readonly string[]).includes(viewParam ?? "") ? (viewParam as (typeof VIEWS)[number]) : undefined;
  const statusParam = searchParams.get("status");
  const status = (TASK_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as TaskStatus) : undefined;
  const priorityParam = searchParams.get("priority");
  const priority = (TASK_PRIORITIES as readonly string[]).includes(priorityParam ?? "") ? (priorityParam as TaskPriority) : undefined;
  const search = searchParams.get("q") ?? undefined;

  const tasks = await listTasks(ctx.businessId, {
    view,
    status,
    priority,
    search,
    currentUserId: ctx.userId,
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, taskCreateSchema);
  if (!data) return badRequest;

  const task = await createTask(ctx.businessId, data, ctx.userId);
  return NextResponse.json(task, { status: 201 });
}
