import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound, requireRecordAccess } from "@/lib/api-guard";
import { taskReminderSchema } from "@/lib/schemas";
import { reminderErrorResponse } from "@/modules/reminders/errors";
import { deleteReminder, getReminderForTask, upsertTaskReminder } from "@/modules/reminders/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "view");
  if (denied) return denied;
  return NextResponse.json(await getReminderForTask(ctx.businessId, id));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "edit");
  if (denied) return denied;

  const { data, response: badRequest } = await parseBody(request, taskReminderSchema);
  if (!data) return badRequest;
  try {
    const reminder = await upsertTaskReminder(ctx.businessId, id, ctx.userId, data.remindAt);
    return NextResponse.json(reminder);
  } catch (err) {
    return reminderErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "edit");
  if (denied) return denied;

  const reminder = await getReminderForTask(ctx.businessId, id);
  if (!reminder) return notFound();
  const ok = await deleteReminder(ctx.businessId, reminder.id);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
