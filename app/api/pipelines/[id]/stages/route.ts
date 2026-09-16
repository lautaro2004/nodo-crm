import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { pipelineStageCreateSchema, pipelineStageReorderSchema } from "@/lib/schemas";
import { createStage, reorderStages } from "@/modules/pipelines/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, pipelineStageCreateSchema);
  if (!data) return badRequest;

  try {
    const stage = await createStage(ctx.businessId, id, data);
    return NextResponse.json(stage, { status: 201 });
  } catch {
    return notFound();
  }
}

// Reordenar: PATCH con { stageIds: [...] } en el orden final deseado.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, pipelineStageReorderSchema);
  if (!data) return badRequest;

  try {
    await reorderStages(ctx.businessId, id, data.stageIds);
    return NextResponse.json({ ok: true });
  } catch {
    return notFound();
  }
}
