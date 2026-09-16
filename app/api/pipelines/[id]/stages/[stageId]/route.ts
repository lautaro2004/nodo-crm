import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { pipelineStageUpdateSchema } from "@/lib/schemas";
import { updateStage, deleteStage } from "@/modules/pipelines/service";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id, stageId } = await params;
  const { data, response: badRequest } = await parseBody(request, pipelineStageUpdateSchema);
  if (!data) return badRequest;

  try {
    const ok = await updateStage(ctx.businessId, id, stageId, data);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id, stageId } = await params;
  try {
    const ok = await deleteStage(ctx.businessId, id, stageId);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "stage_in_use") {
      return NextResponse.json({ error: "stage_in_use" }, { status: 409 });
    }
    return notFound();
  }
}
