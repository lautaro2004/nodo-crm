import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { taskCreateSchema } from "@/lib/schemas";
import { createTask, listTasks } from "@/modules/tasks/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listTasks(ctx.businessId));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, taskCreateSchema);
  if (!data) return badRequest;

  const task = await createTask(ctx.businessId, { ...data, ownerId: data.ownerId ?? ctx.userId });
  return NextResponse.json(task, { status: 201 });
}
