import { NextResponse } from "next/server";

import { requireWorkspace, parseBody } from "@/lib/api-guard";
import { pipelineCreateSchema } from "@/lib/schemas";
import { createPipeline, listPipelines } from "@/modules/pipelines/service";

export async function GET() {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;
  return NextResponse.json(await listPipelines(ctx.businessId));
}

export async function POST(request: Request) {
  const { ctx, response } = await requireWorkspace();
  if (!ctx) return response;

  const { data, response: badRequest } = await parseBody(request, pipelineCreateSchema);
  if (!data) return badRequest;

  const pipeline = await createPipeline(ctx.businessId, data);
  return NextResponse.json(pipeline, { status: 201 });
}
