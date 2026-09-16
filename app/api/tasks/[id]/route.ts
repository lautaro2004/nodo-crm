import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { taskUpdateSchema } from "@/lib/schemas";
import { updateTask, deleteTask } from "@/modules/tasks/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, taskUpdateSchema);
  if (!data) return badRequest;

  const task = await updateTask(ctx.businessId, id, data);
  if (!task) return notFound();
  return NextResponse.json(task);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteTask(ctx.businessId, id);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
