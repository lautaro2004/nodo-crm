import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, domainErrorResponse, requireRecordAccess } from "@/lib/api-guard";
import { taskUpdateSchema } from "@/lib/schemas";
import { updateTask, deleteTask } from "@/modules/tasks/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "edit");
  if (denied) return denied;
  const { data, response: badRequest } = await parseBody(request, taskUpdateSchema);
  if (!data) return badRequest;

  try {
    const task = await updateTask(ctx.businessId, id, data, ctx.userId);
    if (!task) return notFound();
    return NextResponse.json(task);
  } catch (err) {
    return domainErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "delete");
  if (denied) return denied;
  const ok = await deleteTask(ctx.businessId, id, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
