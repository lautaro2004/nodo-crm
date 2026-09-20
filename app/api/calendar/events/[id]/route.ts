import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { calendarEventUpdateSchema } from "@/lib/schemas";
import { calendarErrorResponse } from "@/modules/calendar/errors";
import { getEvent, updateEvent, deleteEvent } from "@/modules/calendar/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const event = await getEvent(ctx.businessId, id);
  if (!event) return notFound();
  return NextResponse.json(event);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, calendarEventUpdateSchema);
  if (!data) return badRequest;

  try {
    const event = await updateEvent(ctx.businessId, id, data, ctx.userId);
    if (!event) return notFound();
    return NextResponse.json(event);
  } catch (err) {
    return calendarErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const ok = await deleteEvent(ctx.businessId, id, ctx.userId);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}
