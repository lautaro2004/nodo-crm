import { NextResponse } from "next/server";

import { requireWorkspace, parseBody, notFound } from "@/lib/api-guard";
import { pipelineUpdateSchema } from "@/lib/schemas";
import { getPipeline, updatePipeline, deletePipeline } from "@/modules/pipelines/service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const pipeline = await getPipeline(ctx.businessId, id);
  if (!pipeline) return notFound();
  return NextResponse.json(pipeline);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  const { data, response: badRequest } = await parseBody(request, pipelineUpdateSchema);
  if (!data) return badRequest;

  const ok = await updatePipeline(ctx.businessId, id, data);
  if (!ok) return notFound();
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { id } = await params;
  try {
    const ok = await deletePipeline(ctx.businessId, id);
    if (!ok) return notFound();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "pipeline_in_use" }, { status: 409 });
  }
}
