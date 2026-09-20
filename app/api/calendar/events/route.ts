import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { calendarEventCreateSchema } from "@/lib/schemas";
import { calendarErrorResponse } from "@/modules/calendar/errors";
import { createEvent, listEvents, EVENT_TYPES, EVENT_STATUSES, type EventType, type EventStatus } from "@/modules/calendar/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const sp = new URL(request.url).searchParams;
  const date = (v: string | null) => {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : undefined;
  };
  const owner = sp.get("owner");
  const type = sp.get("type");
  const status = sp.get("status");

  const events = await listEvents(ctx.businessId, {
    from: date(sp.get("from")),
    to: date(sp.get("to")),
    ownerId: owner === "me" ? ctx.userId : owner || undefined,
    type: (EVENT_TYPES as readonly string[]).includes(type ?? "") ? (type as EventType) : undefined,
    status: (EVENT_STATUSES as readonly string[]).includes(status ?? "") ? (status as EventStatus) : undefined,
    companyId: sp.get("companyId") || undefined,
    contactId: sp.get("contactId") || undefined,
    leadId: sp.get("leadId") || undefined,
    opportunityId: sp.get("opportunityId") || undefined,
  });
  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, calendarEventCreateSchema);
  if (!data) return badRequest;

  try {
    const event = await createEvent(ctx.businessId, data, ctx.userId);
    return NextResponse.json(event, { status: 201 });
  } catch (err) {
    return calendarErrorResponse(err);
  }
}
