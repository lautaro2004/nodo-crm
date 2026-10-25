import { NextResponse } from "next/server";

import { requireWorkspace, requireRecordAccess } from "@/lib/api-guard";
import { calendarErrorResponse } from "@/modules/calendar/errors";
import { addTaskToGoogleCalendar, getTaskGoogleLink, removeTaskFromGoogleCalendar } from "@/modules/tasks/google-calendar";

// El negocio y el usuario salen SIEMPRE de la sesión (requireWorkspace); el id
// de la tarea del path se valida contra ese negocio. El evento vive en el
// Google Calendar del propio usuario autenticado.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "view");
  if (denied) return denied;
  try {
    return NextResponse.json(await getTaskGoogleLink(ctx.businessId, ctx.userId, id));
  } catch (err) {
    return calendarErrorResponse(err);
  }
}

// Agrega la tarea a Google Calendar, o actualiza el evento si ya estaba.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "edit");
  if (denied) return denied;
  try {
    const { created } = await addTaskToGoogleCalendar(ctx.businessId, ctx.userId, id);
    return NextResponse.json({ linked: true, created }, { status: created ? 201 : 200 });
  } catch (err) {
    return calendarErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const denied = await requireRecordAccess(ctx, "task", id, "edit");
  if (denied) return denied;
  try {
    const removed = await removeTaskFromGoogleCalendar(ctx.businessId, ctx.userId, id);
    return NextResponse.json({ linked: false, removed });
  } catch (err) {
    return calendarErrorResponse(err);
  }
}
