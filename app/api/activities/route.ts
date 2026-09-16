import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { activityCreateSchema } from "@/lib/schemas";
import { createActivity, listActivitiesForEntity } from "@/modules/activities/service";

export async function GET(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { searchParams } = new URL(request.url);
  const relatedType = searchParams.get("relatedType");
  const relatedId = searchParams.get("relatedId");
  if (!relatedType || !relatedId) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const activities = await listActivitiesForEntity(ctx.businessId, relatedType as never, relatedId);
  return NextResponse.json(activities);
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, activityCreateSchema);
  if (!data) return badRequest;

  const activity = await createActivity(ctx.businessId, { ...data, ownerId: ctx.userId });
  return NextResponse.json(activity, { status: 201 });
}
